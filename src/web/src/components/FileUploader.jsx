import { useState } from "react";
import api from "../services/api";
import { uploadFileToBlob } from "../services/blob";

/**
 * FileUploader
 * - Calls POST /jobs to create a Cosmos document + receive an upload SAS URL.
 * - PUTs the file directly to Blob Storage using that SAS URL.
 * - Reports the created jobId back to the parent through onCreated().
 */
export default function FileUploader({ onCreated, disabled }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleUpload = async () => {
        if (!file) {
            setError("Veuillez sélectionner un fichier.");
            return;
        }

        setError("");
        setLoading(true);

        try {
            const { data } = await api.post("/jobs", {
                fileName: file.name,
                contentType: file.type || "application/octet-stream"
            });

            onCreated?.({
                jobId: data.jobId,
                status: data.status,
                fileName: file.name,
                size: file.size
            });

            await uploadFileToBlob(data.uploadUrl, file);
        } catch (err) {
            console.error(err);
            setError(
                err?.response?.data?.detail ||
                err?.message ||
                "Erreur pendant l'initialisation ou l'upload."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="uploader">
            <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={loading || disabled}
            />
            <button
                onClick={handleUpload}
                disabled={!file || loading || disabled}
                className="primary"
            >
                {loading ? "Envoi en cours..." : "Envoyer le document"}
            </button>
            {error && <p className="error">{error}</p>}
        </div>
    );
}
