import { HubConnectionBuilder, LogLevel, HttpTransportType } from "@microsoft/signalr";

const FUNCTIONS_BASE_URL =
    import.meta.env.VITE_FUNCTIONS_BASE_URL || "";

const NEGOTIATE_URL = `${FUNCTIONS_BASE_URL.replace(/\/+$/, "")}/api`;

/**
 * Opens a SignalR connection to the Azure Functions negotiate endpoint.
 * The Functions app emits events on target "documentUpdate" with payload:
 *   { documentId, status, message, timestamp, tags?, error? }
 *
 * @param {(evt: object) => void} onDocumentUpdate - callback for each event
 * @returns {Promise<import("@microsoft/signalr").HubConnection>}
 */
export async function startSignalR(onDocumentUpdate) {
    if (!FUNCTIONS_BASE_URL) {
        console.warn(
            "[signalR] VITE_FUNCTIONS_BASE_URL is not set; real-time notifications disabled."
        );
        return null;
    }

    const connection = new HubConnectionBuilder()
        .withUrl(NEGOTIATE_URL, {
            transport:
                HttpTransportType.WebSockets |
                HttpTransportType.ServerSentEvents |
                HttpTransportType.LongPolling
        })
        .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
        .configureLogging(LogLevel.Information)
        .build();

    connection.on("documentUpdate", (payload) => {
        try {
            onDocumentUpdate?.(payload);
        } catch (err) {
            console.error("[signalR] handler failed", err);
        }
    });

    connection.onreconnected(() => console.info("[signalR] reconnected"));
    connection.onclose((err) =>
        console.warn("[signalR] connection closed", err)
    );

    await connection.start();
    console.info("[signalR] connected to", NEGOTIATE_URL);
    return connection;
}
