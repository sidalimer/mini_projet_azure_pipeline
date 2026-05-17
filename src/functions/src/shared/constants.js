'use strict';

const STATUS = Object.freeze({
    CREATED: 'CREATED',
    UPLOADED: 'UPLOADED',
    QUEUED: 'QUEUED',
    PROCESSING: 'PROCESSING',
    PROCESSED: 'PROCESSED',
    ERROR: 'ERROR'
});

const SIGNALR_HUB = process.env.SIGNALR_HUB_NAME || 'documents';
const SIGNALR_EVENT = 'documentUpdate';

const COSMOS_PARTITION_KEY = 'JOB';

module.exports = { STATUS, SIGNALR_HUB, SIGNALR_EVENT, COSMOS_PARTITION_KEY };
