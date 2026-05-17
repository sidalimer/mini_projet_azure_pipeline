'use strict';

const { CosmosClient } = require('@azure/cosmos');
const { COSMOS_PARTITION_KEY } = require('./constants');

let _client = null;
let _container = null;

function getContainer() {
    if (_container) return _container;

    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    const databaseId = process.env.COSMOS_DATABASE || 'db-doc';
    const containerId = process.env.COSMOS_CONTAINER || 'jobs';

    if (!endpoint || !key) {
        throw new Error('COSMOS_ENDPOINT or COSMOS_KEY is not configured.');
    }

    if (!_client) {
        _client = new CosmosClient({ endpoint, key });
    }
    _container = _client.database(databaseId).container(containerId);
    return _container;
}

async function getDocument(documentId) {
    const container = getContainer();
    try {
        const { resource } = await container.item(documentId, COSMOS_PARTITION_KEY).read();
        return resource || null;
    } catch (err) {
        if (err && err.code === 404) return null;
        throw err;
    }
}

async function patchDocument(documentId, fields) {
    const container = getContainer();
    const existing = await getDocument(documentId);
    if (!existing) {
        throw new Error(`Document not found in Cosmos: ${documentId}`);
    }
    const updated = {
        ...existing,
        ...fields,
        updatedAt: new Date().toISOString()
    };
    const { resource } = await container.item(documentId, COSMOS_PARTITION_KEY).replace(updated);
    return resource;
}

module.exports = { getContainer, getDocument, patchDocument };
