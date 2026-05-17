import { useEffect, useRef, useState } from "react";
import FileUploader from "./components/FileUploader";
import JobStatusCard from "./components/JobStatusCard";
import { startSignalR } from "./services/signalr";
import "./App.css";

function App() {
  const [job, setJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [signalRStatus, setSignalRStatus] = useState("disconnected");
  const jobIdRef = useRef(null);
  const connectionRef = useRef(null);

  // Open the SignalR connection once, when the app mounts.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const connection = await startSignalR((evt) => {
          // Only react to events that target the current document.
          if (!jobIdRef.current || evt.documentId !== jobIdRef.current) return;

          setJob((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: evt.status,
              message: evt.message,
              tags: evt.tags || prev.tags,
              error: evt.error || (evt.status === "ERROR" ? evt.message : null)
            };
          });
          setHistory((prev) => [...prev, evt]);
        });
        if (cancelled) {
          connection?.stop?.();
          return;
        }
        connectionRef.current = connection;
        setSignalRStatus(connection ? "connected" : "disabled");
      } catch (err) {
        console.error("[signalR] start failed", err);
        setSignalRStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      connectionRef.current?.stop?.();
    };
  }, []);

  const handleCreated = ({ jobId, status, fileName }) => {
    jobIdRef.current = jobId;
    setHistory([]);
    setJob({
      jobId,
      status,
      fileName,
      message: "Job créé, upload en cours...",
      tags: [],
      error: null
    });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Cloud Document Processing</h1>
        <span className={`signalr-pill signalr-${signalRStatus}`}>
          SignalR : {signalRStatus}
        </span>
      </header>

      <main>
        <FileUploader onCreated={handleCreated} />
        <JobStatusCard job={job} history={history} />
      </main>

      <footer className="muted">
        Pipeline : Blob Trigger → Service Bus → IA tagging → SignalR
      </footer>
    </div>
  );
}

export default App;