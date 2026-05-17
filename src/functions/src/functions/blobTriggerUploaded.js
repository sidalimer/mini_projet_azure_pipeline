'use strict';

const { app, output } = require('@azure/functions');
const { STATUS, SIGNALR_HUB } = require('../shared/constants');
const { patchDocument, getDocument } = require('../shared/cosmos');
const { sendMessage } = require('../shared/serviceBus');
const { buildSignalRMessage } = require('../shared/notify');

const signalRMessages = output.generic({
    type: 'signalR',
    name: 'signalRMessages',
    hubName: SIGNALR_HUB,
    connectionStringSetting: 'AzureSignalRConnectionString'
});

/**
 * Blob Trigger Function
 * Fires when a blob is created in the "input/" virtual folder of the
 * configured documents container. Expected path: input/{documentId}/{fileName}.
 *
 * Flow:
 *   1. Mark document as UPLOADED in Cosmos DB
 *   2. Notify React (status=UPLOADED)
 *   3. Publish a JSON message to the Service Bus queue
 *   4. Mark document as QUEUED in Cosmos DB
 *   5. Notify React (status=QUEUED)
 */
app.storageBlob('blobTriggerUploaded', {
    path: '%BLOB_CONTAINER%/input/{documentId}/{fileName}',
    connection: 'BLOB_CONNECTION_STRING',
    extraOutputs: [signalRMessages],
    handler: async (blob, context) => {
        const documentId = context.triggerMetadata?.documentId;
        const fileName = context.triggerMetadata?.fileName;
        const blobName = `input/${documentId}/${fileName}`;
        const size = Buffer.isBuffer(blob) ? blob.length : (blob?.length || 0);

        context.log(`[blobTrigger] documentId=${documentId} fileName=${fileName} size=${size}`);

        if (!documentId || !fileName) {
            context.log.error('[blobTrigger] Missing documentId or fileName in trigger metadata.');
            return;
        }

        // Defensive: skip empty files - mark as ERROR right away.
        if (size === 0) {
            try {
                await patchDocument(documentId, {
                    status: STATUS.ERROR,
                    errorMessage: 'Uploaded file is empty (0 bytes).',
                    errorAt: new Date().toISOString()
                });
            } catch (err) {
                context.log.error('[blobTrigger] Failed to mark empty file as ERROR:', err?.message);
            }
            context.extraOutputs.set(signalRMessages, buildSignalRMessage({
                documentId,
                status: STATUS.ERROR,
                message: 'Fichier vide, traitement annulé.',
                error: 'EMPTY_FILE'
            }));
            return;
        }

        // 1. Verify document exists, mark UPLOADED
        const existing = await getDocument(documentId);
        if (!existing) {
            context.log.error(`[blobTrigger] Document ${documentId} not found in Cosmos.`);
            context.extraOutputs.set(signalRMessages, buildSignalRMessage({
                documentId,
                status: STATUS.ERROR,
                message: 'Document introuvable en base.',
                error: 'DOC_NOT_FOUND'
            }));
            return;
        }

        const uploadedAt = new Date().toISOString();

        await patchDocument(documentId, {
            status: STATUS.UPLOADED,
            blobName,
            size,
            uploadedAt
        });

        // 2. Service Bus message
        const message = { documentId, fileName, blobName, size, uploadedAt };

        try {
            await sendMessage(message);
        } catch (err) {
            context.log.error('[blobTrigger] Service Bus send failed:', err?.message);
            await patchDocument(documentId, {
                status: STATUS.ERROR,
                errorMessage: `Service Bus send failed: ${err?.message || err}`,
                errorAt: new Date().toISOString()
            });
            context.extraOutputs.set(signalRMessages, buildSignalRMessage({
                documentId,
                status: STATUS.ERROR,
                message: 'Impossible de mettre en file de traitement.',
                error: err?.message
            }));
            return;
        }

        // 3. Mark QUEUED
        await patchDocument(documentId, { status: STATUS.QUEUED });

        // 4. Push 2 SignalR notifications (UPLOADED, then QUEUED)
        context.extraOutputs.set(signalRMessages, [
            ...buildSignalRMessage({ documentId, status: STATUS.UPLOADED, message: 'Fichier reçu' }),
            ...buildSignalRMessage({ documentId, status: STATUS.QUEUED, message: 'Mis en file de traitement' })
        ]);

        context.log(`[blobTrigger] documentId=${documentId} pushed to Service Bus and marked QUEUED.`);
    }
});
