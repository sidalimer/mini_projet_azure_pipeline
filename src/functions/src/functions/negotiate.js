'use strict';

const { app, input } = require('@azure/functions');
const { SIGNALR_HUB } = require('../shared/constants');

const connectionInfo = input.generic({
    type: 'signalRConnectionInfo',
    name: 'connectionInfo',
    hubName: SIGNALR_HUB,
    connectionStringSetting: 'AzureSignalRConnectionString'
});

/**
 * SignalR negotiate endpoint.
 *
 * The React client calls this URL to retrieve a SignalR access token + URL
 * before opening the WebSocket connection.
 */
app.http('negotiate', {
    route: 'negotiate',
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    extraInputs: [connectionInfo],
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, x-ms-signalr-userid'
                }
            };
        }

        const info = context.extraInputs.get(connectionInfo);
        return {
            status: 200,
            jsonBody: info,
            headers: {
                'Access-Control-Allow-Origin': '*'
            }
        };
    }
});

/**
 * Health endpoint for the Function App.
 */
app.http('health', {
    route: 'health',
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async () => ({
        status: 200,
        jsonBody: { status: 'ok', service: 'm2devcloud-functions' }
    })
});
