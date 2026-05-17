from fastapi import FastAPI
from .routes_jobs import router as jobs_router
from fastapi.middleware.cors import CORSMiddleware

origins = ["*"]

app = FastAPI(title="Doc processing API", description="API de génération de documents", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,      # domaines autorisés
    allow_credentials=False,
    allow_methods=["*"],        # GET, POST, PUT, DELETE...
    allow_headers=["*"],
)

app.include_router(jobs_router)


@app.get("/health")
def health():
    return {"status":"ok"}




#@app.get("/")
#def root():
#    return {"message": "API fonctionne"}

# pip install fastapi uvicorn[standard] azure-cosmos pydantic-settings python-dotenv
# python -m uvicorn app.main:app --reload
# pip install azure-storage-blob
