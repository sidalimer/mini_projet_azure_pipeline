'use strict';

const { SIGNALR_EVENT } = require('./constants');

/**
 * Build a SignalR output binding payload that targets all connected clients
 * on the "documents" hub. The frontend filters events by documentId.
 *
 * Returns an array (SignalR output binding accepts one or more messages).
 */
function buildSignalRMessage({ documentId, status, message, tags, error }) {
    const payload = {
        documentId,
        status,
        message: message || statusToMessage(status),
        timestamp: new Date().toISOString()
    };
    if (Array.isArray(tags)) payload.tags = tags;
    if (error) payload.error = String(error);

    return [
        {
            target: SIGNALR_EVENT,
            arguments: [payload]
        }
    ];
}

function statusToMessage(status) {
    switch (status) {
        case 'UPLOADED':   return 'Fichier reçu';
        case 'QUEUED':     return 'Mis en file de traitement';
        case 'PROCESSING': return 'Traitement IA en cours';
        case 'PROCESSED':  return 'Tagging terminé';
        case 'ERROR':      return 'Erreur de traitement';
        default:           return `Statut: ${status}`;
    }
}

module.exports = { buildSignalRMessage, statusToMessage };
