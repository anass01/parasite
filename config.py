# --- CONFIGURATION ---
DB_PATH = './db/chat.duckdb'
LLM_BASE_URL = "http://localhost:1234/v1"
LLM_MODEL = "google/gemma-4-e2b"
BATCH_SIZE = 200  # Number of messages per LLM prompt
OUTPUT_HTML = "graph_map.html"
GRAPHML_PATH = "graph_map.graphml"
