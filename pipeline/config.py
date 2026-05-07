"""
Pipeline Configuration
======================
Shared settings for import_chat.py and generate_graph.py.

Set the DATABASE_URL environment variable (same one used by next_parasite_app)
or edit POSTGRES_CONN_STRING below directly.

  Windows PowerShell:
    $env:DATABASE_URL = "postgresql://postgres:PASS@db.PROJECT.supabase.co:5432/postgres"

  Linux / macOS:
    export DATABASE_URL="postgresql://postgres:PASS@db.PROJECT.supabase.co:5432/postgres"
"""
import os

# ---------------------------------------------------------------------------
# PostgreSQL connection
# ---------------------------------------------------------------------------
# Reads from the environment first, then falls back to the hard-coded string.
POSTGRES_CONN_STRING: str = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/parasite",
)

# ---------------------------------------------------------------------------
# Source data
# ---------------------------------------------------------------------------
# Directory that holds the YouTube live-chat JSON files.
CHAT_DIR: str = r"F:\projects\parasite\chat"

# ---------------------------------------------------------------------------
# LLM / graph settings
# ---------------------------------------------------------------------------
LLM_BASE_URL: str = "http://localhost:1234/v1"
LLM_MODEL: str = "google/gemma-4-e2b"

# Number of chat messages sent to the LLM in a single prompt.
BATCH_SIZE: int = 200

# Output paths for the generated graph artefacts.
GRAPHML_PATH: str = "../graph_map.graphml"
OUTPUT_HTML: str  = "../graph_map.html"
