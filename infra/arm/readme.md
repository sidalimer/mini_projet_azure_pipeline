# Infrastructure ARM

`main.json` provisions the resources needed by the asynchronous pipeline:

- Storage account (used by the Function App for its own runtime needs).
- Service Bus namespace + queue `documents-queue` with **maxDeliveryCount=3** and **DLQ enabled**.
- SignalR Service in **Serverless** mode (required for Function output bindings).
- App Service Plan (Consumption Y1) + Linux Function App (Node 20).
- Application Insights for logs.

The existing FastAPI service, the document Storage Account and the Cosmos DB account
are **not recreated**: their connection strings / endpoints are passed as parameters.

## Deploy manually

```bash
az group create -n m2devcloud-rg -l francecentral

az deployment group create \
  --resource-group m2devcloud-rg \
  --template-file main.json \
  --parameters @parameters.sample.json \
  --parameters cosmosKey="$COSMOS_KEY" \
               blobConnectionString="$BLOB_CONNECTION_STRING" \
               azureOpenAiKey="$AZURE_OPENAI_KEY"
```

Outputs (functionAppName, functionAppUrl, serviceBusName, signalRName) are then
fed to the GitLab CI/CD pipeline through CI/CD variables.

## Tear down

```bash
az group delete -n m2devcloud-rg --yes
```
