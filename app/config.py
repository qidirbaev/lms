import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
STATIC_DIR = BASE_DIR / "static"

# AI provider: "gemma" or "mock"
AI_PROVIDER = os.getenv("AI_PROVIDER", "mock").lower()

# Vertex AI / Gemma config
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT", "diplom-tuit")
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "global")
VERTEX_MODEL = os.getenv("VERTEX_MODEL", "gemini-3.1-flash-lite-preview")
GOOGLE_SERVICE_ACCOUNT_JSON = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")

# Processing config
BATCH_CONCURRENCY = int(os.getenv("BATCH_CONCURRENCY", "3"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "2"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "90"))
FALLBACK_TO_MOCK = os.getenv("FALLBACK_TO_MOCK", "true").lower() == "true"

# Model params
MODEL_TEMPERATURE = float(os.getenv("MODEL_TEMPERATURE", "0.2"))
MODEL_MAX_TOKENS = int(os.getenv("MODEL_MAX_TOKENS", "2048"))

# Auth
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

# Data files
SEED_FILE = DATA_DIR / "seed_1600.json"
BATCH_FILE = DATA_DIR / "batch_30.json"
RESULTS_FILE = DATA_DIR / "processed_results.json"
LOGS_FILE = DATA_DIR / "app_logs.json"

# Vertex AI endpoint template
VERTEX_ENDPOINT = (
    "https://aiplatform.googleapis.com/v1/projects/{project}/locations/{location}"
    "/endpoints/openapi/chat/completions"
)