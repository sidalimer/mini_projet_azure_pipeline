'use strict';

const { ServiceBusClient } = require('@azure/service-bus');

let _client = null;

function getClient() {
    if (_client) return _client;
    const conn = process.env.SERVICE_BUS_CONNECTION_STRING;
    if (!conn) throw new Error('SERVICE_BUS_CONNECTION_STRING is not configured.');
    _client = new ServiceBusClient(conn);
    return _client;
}

async function sendMessage(body) {
    const queue = process.env.SERVICE_BUS_QUEUE || 'documents-queue';
    const sender = getClient().createSender(queue);
    try {
        await sender.sendMessages({
            body,
            contentType: 'application/json',
            messageId: body?.documentId
                ? `${body.documentId}-${Date.now()}`
                : undefined
        });
    } finally {
        await sender.close();
    }
}

module.exports = { sendMessage };
