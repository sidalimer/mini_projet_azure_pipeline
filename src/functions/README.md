# Azure Functions — pipeline asynchrone

Quatre Functions Node.js v4 :

| Function | Trigger | Rôle |
|----------|---------|------|
| `blobTriggerUploaded` | Blob (`%BLOB_CONTAINER%/input/{documentId}/{fileName}`) | UPLOADED → publie sur Service Bus → QUEUED + SignalR |
| `processDocument`     | Service Bus queue (`%SERVICE_BUS_QUEUE%`) | PROCESSING → tagging IA → PROCESSED + SignalR. Throw ⇒ retry, puis DLQ après `maxDeliveryCount`. |
| `dlqAlert`            | Service Bus queue (`%SERVICE_BUS_QUEUE%/$DeadLetterQueue`) | ERROR (Cosmos + SignalR) |
| `negotiate` + `health`| HTTP                                  | Authentification SignalR / sonde santé |

Modules partagés dans `src/shared/` :
- `cosmos.js` — accès et patch sur le container Cosmos
- `serviceBus.js` — envoi de messages depuis le Blob Trigger
- `ai.js` — Azure OpenAI + fallback règles
- `notify.js` — fabrication des payloads SignalR
- `constants.js` — statuts métier + constantes

## Lancer en local

```bash
cp local.settings.sample.json local.settings.json
# Renseigner les valeurs réelles
npm install
func start
```

La Function App expose alors :
- `http://localhost:7071/api/health`
- `http://localhost:7071/api/negotiate`
- Triggers en arrière-plan pour Blob et Service Bus.

## Variables nécessaires

Voir `local.settings.sample.json`.
