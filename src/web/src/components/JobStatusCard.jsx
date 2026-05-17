const STATUS_LABEL = {
    CREATED: "Créé",
    UPLOADED: "Uploadé",
    QUEUED: "En file",
    PROCESSING: "Traitement IA",
    PROCESSED: "Terminé",
    ERROR: "Erreur"
};

const STATUS_CLASS = {
    CREATED: "status status-created",
    UPLOADED: "status status-uploaded",
    QUEUED: "status status-queued",
    PROCESSING: "status status-processing",
    PROCESSED: "status status-processed",
    ERROR: "status status-error"
};

/**
 * JobStatusCard
 * Displays the current state of a document: status badge, file name, tags,
 * the full history of received SignalR events, and any error message.
 */
export default function JobStatusCard({ job, history }) {
    if (!job) return null;

    const status = job.status || "CREATED";

    return (
        <div className="card">
            <div className="card-header">
                <h2>{job.fileName || "Document"}</h2>
                <span className={STATUS_CLASS[status] || "status"}>
                    {STATUS_LABEL[status] || status}
                </span>
            </div>

            <p className="muted">Job ID : <code>{job.jobId}</code></p>

            {job.message && <p className="message">{job.message}</p>}

            {Array.isArray(job.tags) && job.tags.length > 0 && (
                <div className="tags">
                    {job.tags.map((tag) => (
                        <span key={tag} className="tag">{tag}</span>
                    ))}
                </div>
            )}

            {job.error && (
                <div className="error-box">
                    <strong>Erreur :</strong> {job.error}
                </div>
            )}

            {history && history.length > 0 && (
                <details className="history">
                    <summary>Historique ({history.length})</summary>
                    <ul>
                        {history.map((evt, idx) => (
                            <li key={idx}>
                                <span className="muted">
                                    {new Date(evt.timestamp).toLocaleTimeString()}
                                </span>
                                {" "}
                                <strong>{evt.status}</strong>
                                {" — "}
                                {evt.message}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
    );
}
