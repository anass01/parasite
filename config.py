import os

# --- CONFIGURATION ---
POSTGRES_CONN_STRING = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/parasite",
)
CHAT_DIR = os.getenv("CHAT_DIR", "./chat")
LLM_BASE_URL = "http://localhost:1234/v1"
LLM_MODEL = "google/gemma-4-e2b"
BATCH_SIZE = 200  # Number of messages per LLM prompt
