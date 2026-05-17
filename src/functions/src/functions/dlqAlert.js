'use strict';

const { app, output } = require('@azure/functions');
const { STATUS, SIGNALR_HUB } = require('../shared/constants');
const { patchDocument } = require('../shared/cosmos');
const { buildSignalRMessage } = require('../shared/notify');

const signalRMessages = output.generic({
    type: 'signalR',
    name: 'signalRMessages',
    hubName: SIGNALR_HUB,
    connectionStringSetting: 'AzureSignalRConnectionString'
});

/**
 * Dead Letter Queue Alert Function.
 *
 * Listens to the sub-queue "<queue>/$DeadLetterQueue" and converts any
 * dead-lettered message into:
 *   - an ERROR status in Cosmos DB (with errorMessage + errorAt)
 *   - a SignalR ERROR notification to React
 */
app.serviceBusQueue('dlqAlert', {
    queueName: '%SERVICE_BUS_QUEUE%/$DeadLetterQueue',
    connection: 'SERVICE_BUS_CONNECTION_STRING',
    extraOutputs: [signalRMessages],
    handler: async (message, context) => {
        const errorAt = new Date().toISOString();

        // The message body may be the original JSON, but it could also be
        // malformed (that's actually one of the reasons it ended up in DLQ).
        let documentId = null;
        let originalBody = message;

        try {
            if (typeof message === 'string') {
                originalBody = JSON.parse(message);
            }
            if (originalBody && typeof originalBody === 'object') {
                documentId = originalBody.documentId || null;
            }
        } catch (_) {
            // not JSON, keep raw
        }

        const deadLetterReason =
            context.triggerMetadata?.deadLetterReason ||
            context.triggerMetadata?.DeadLetterReason ||
            'MaxDeliveryCountExceeded';
        const deadLetterDescription =
            context.triggerMetadata?.deadLetterErrorDescription ||
            context.triggerMetadata?.DeadLetterErrorDescription ||
            'Message envoyé en DLQ après plusieurs échecs';

        context.log.error(
            `[dlqAlert] documentId=${documentId} reason=${deadLetterReason} desc=${deadLetterDescription}`
        );

        if (documentId) {
            try {
                await patchDocument(documentId, {
                    status: STATUS.ERROR,
                    errorMessage: `${deadLetterReason}: ${deadLetterDescription}`,
                    errorAt
                });
            } catch (err) {
                context.log.error('[dlqAlert] Failed to update Cosmos:', err?.message);
            }

            context.extraOutputs.set(signalRMessages, buildSignalRMessage({
                documentId,
                status: STATUS.ERROR,
                message: 'Erreur de traitement (DLQ)',
                error: `${deadLetterReason}: ${deadLetterDescription}`
            }));
        } else {
            // Unknown document - still emit a global error notification so the
            // UI can surface it (broadcast).
            context.extraOutputs.set(signalRMessages, buildSignalRMessage({
                documentId: 'unknown',
                status: STATUS.ERROR,
                message: 'Message DLQ sans documentId',
                error: `${deadLetterReason}: ${deadLetterDescription}`
            }));
        }
    }
});
