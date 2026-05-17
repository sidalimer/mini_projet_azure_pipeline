'use strict';

const { app, output } = require('@azure/functions');
const { STATUS, SIGNALR_HUB } = require('../shared/constants');
const { patchDocument, getDocument } = require('../shared/cosmos');
const { generateTags } = require('../shared/ai');
const { buildSignalRMessage } = require('../shared/notify');

const signalRMessages = output.generic({
    type: 'signalR',
    name: 'signalRMessages',
    hubName: SIGNALR_HUB,
    connectionStringSetting: 'AzureSignalRConnectionString'
});

/**
 * Service Bus Queue Trigger Function - IA tagging.
 *
 * Reads a JSON message from the documents queue. If processing fails, the
 * exception is thrown so the message is retried. After maxDeliveryCount
 * attempts the Service Bus broker moves the message to the DLQ
 * (handled by dlqAlert.js).
 */
app.serviceBusQueue('processDocument', {
    queueName: '%SERVICE_BUS_QUEUE%',
    connection: 'SERVICE_BUS_CONNECTION_STRING',
    extraOutputs: [signalRMessages],
    handler: async (message, context) => {
        const notifications = [];
        const pushNotification = (payload) => {
            notifications.push(...buildSignalRMessage(payload));
        };

        // Validate message shape - any structural problem causes a throw
        // which will retry then end up in DLQ.
        if (!message || typeof message !== 'object' || !message.documentId || !message.fileName) {
            context.log.error('[processDocument] Malformed message:', JSON.stringify(message));
            throw new Error('Malformed Service Bus message: missing documentId or fileName.');
        }

        const { documentId, fileName, blobName, size } = message;
        context.log(`[processDocument] start documentId=${documentId}`);

        // Ensure the document exists in Cosmos. If not, raise -> will go to DLQ.
        const existing = await getDocument(documentId);
        if (!existing) {
            context.log.error(`[processDocument] Document ${documentId} not found.`);
            throw new Error(`Document not found in Cosmos: ${documentId}`);
        }

        // 1. PROCESSING
        await patchDocument(documentId, {
            status: STATUS.PROCESSING,
            blobName: blobName || existing.blobName,
            size: typeof size === 'number' ? size : existing.size
        });
        pushNotification({ documentId, status: STATUS.PROCESSING, message: 'Traitement IA en cours' });

        // 2. IA tagging
        const { tags, source } = await generateTags(fileName, context.log);
        context.log(`[processDocument] tags(${source})=${JSON.stringify(tags)}`);

        // 3. Persist PROCESSED + tags
        const processedAt = new Date().toISOString();
        await patchDocument(documentId, {
            status: STATUS.PROCESSED,
            tags,
            tagSource: source,
            processedAt,
            errorMessage: null,
            errorAt: null
        });

        // 4. Notify React
        pushNotification({
            documentId,
            status: STATUS.PROCESSED,
            message: 'Tagging terminé',
            tags
        });

        context.extraOutputs.set(signalRMessages, notifications);
        context.log(`[processDocument] done documentId=${documentId} PROCESSED.`);
    }
});
