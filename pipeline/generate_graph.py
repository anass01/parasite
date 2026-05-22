"""
generate_graph.py  (PostgreSQL edition)
========================================
Reads unprocessed chat messages from PostgreSQL, calls a local LLM to
extract knowledge-graph triplets, and persists results back to PostgreSQL.

Progress is tracked per-message in `processed_messages` so the script can
be stopped and resumed at any time without re-processing messages.

Tables managed by this script
------------------------------
  processed_messages  — one row per message_id that has been sent to the LLM
  extracted_triplets  — one row per subject→relation→object triplet found
"""

import json
import os
import sys
import time

import psycopg2
from psycopg2.extras import execute_values
from openai import OpenAI
from tqdm import tqdm

from config import (
    POSTGRES_CONN_STRING,
    LLM_BASE_URL,
    LLM_MODEL,
    BATCH_SIZE,
)

# Configure stdout to handle UTF-8 on Windows terminals
sys.stdout.reconfigure(encoding="utf-8")


# ---------------------------------------------------------------------------
# Community knowledge context (fed to the LLM)
# ---------------------------------------------------------------------------
KNOWLEDGE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "knowledge.md")
KNOWLEDGE = ""
if os.path.exists(KNOWLEDGE_PATH):
    try:
        with open(KNOWLEDGE_PATH, "r", encoding="utf-8") as f:
            KNOWLEDGE = f.read().strip()
    except Exception as e:
        print(f"⚠️ Warning: Could not read {KNOWLEDGE_PATH}: {e}")
else:
    print(f"⚠️ Warning: {KNOWLEDGE_PATH} not found.")

SYSTEM_PROMPT = f"""
You are an expert Data Scientist extracting Knowledge Graph triplets from a livestream chat.
The chat contains a mix of English, Moroccan Darija, and other languages.

Your task is to extract relationships and output them STRICTLY as a JSON array of objects.

KNOWLEDGE BASE:
{KNOWLEDGE}

CRITICAL RULES:
1. NORMALIZE TO ENGLISH: Translate all underlying topics and actions into English. If someone
   speaks in Darija, extract the meaning and write the JSON in English to maintain graph
   consistency.
2. STRICT ONTOLOGY: The "relation" key MUST be exactly one of the following uppercase terms:
   [ASKED_QUESTION_TO, ANSWERED, AGREED_WITH, DISAGREED_WITH, SHARED_ADVICE, ADMITTED_FAILURE,
    CELEBRATED_WIN, MENTIONED_TOOL, DISCUSSED_TOPIC, DONATED_TO, CRITICIZED, GREETED,
    CONGRATULATED]
3. CLEAN ENTITIES: Keep the "subject" and "object" names concise (1–3 words).
4. NO PROSE: Output nothing but the raw JSON array. No markdown, no conversational text.
5. CONTEXTUAL ACCURACY: Use the Knowledge Base to correctly interpret community-specific slang.

Example Output:
[
  {{ "subject": "User_A", "relation": "DISCUSSED_TOPIC", "object": "React in Next.js" }},
  {{ "subject": "User_B", "relation": "ANSWERED", "object": "User_A" }}
]
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_connection() -> psycopg2.extensions.connection:
    return psycopg2.connect(POSTGRES_CONN_STRING)


def ensure_tables(cur) -> None:
    """Create progress/result tables if they do not already exist."""

    cur.execute("""
        CREATE TABLE IF NOT EXISTS processed_messages (
            message_id TEXT PRIMARY KEY
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS extracted_triplets (
            id       BIGSERIAL PRIMARY KEY,
            subject  TEXT NOT NULL,
            relation TEXT NOT NULL,
            object   TEXT NOT NULL
        )
    """)


def extract_triplets(client: OpenAI, chat_text: str) -> list[dict]:
    """Calls the local LLM and returns a list of triplet dicts."""
    prompt = f"### Chat Log:\n{chat_text}\n\n### Extraction (JSON ONLY):"

    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": prompt},
        ],
        temperature=0.1,
        seed=42,
    )

    content = response.choices[0].message.content.strip()

    # Strip optional markdown code fences
    if content.startswith("```json"):
        content = content[7:-3].strip()
    elif content.startswith("```"):
        content = content[3:-3].strip()

    data = json.loads(content)
    if not isinstance(data, list):
        raise ValueError("LLM output is not a JSON array")

    return data


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("🚀 Initializing Chat Graph Generator (PostgreSQL)…")

    client = OpenAI(base_url=LLM_BASE_URL, api_key="not-needed")
    conn   = get_connection()

    with conn:
        with conn.cursor() as cur:
            ensure_tables(cur)
            conn.commit()

    # How many messages remain?
    with conn.cursor() as cur:
        cur.execute("""
            SELECT COUNT(*)
            FROM chat_messages
            WHERE message_id NOT IN (SELECT message_id FROM processed_messages)
        """)
        total_remaining: int = cur.fetchone()[0]

    if total_remaining == 0:
        print("🎉 All messages have already been processed!")
    else:
        print(f"📊 Messages remaining to process: {total_remaining:,}")

        pbar = tqdm(total=total_remaining, desc="Processing messages", unit="msg")

        while True:
            # Fetch next unprocessed batch
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT message_id, author_name, message
                    FROM chat_messages
                    WHERE message_id NOT IN (SELECT message_id FROM processed_messages)
                    ORDER BY timestamp_usec ASC
                    LIMIT %s
                """, (BATCH_SIZE,))
                messages = cur.fetchall()

            if not messages:
                break

            msg_ids   = [row[0] for row in messages]
            chat_text = "\n".join(f"{row[1]}: {row[2]}" for row in messages)

            # Extract triplets with retry logic
            triplets: list[dict] = []
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    triplets = extract_triplets(client, chat_text)
                    break
                except Exception as exc:
                    if attempt < max_retries - 1:
                        print(f"\n  ⚠️  Retry {attempt + 1}/{max_retries - 1}: {exc}")
                        time.sleep(1)
                    else:
                        print(f"\n  ❌ All retries failed for this batch: {exc}")
                        triplets = []

            # Persist results to PostgreSQL in a single transaction
            with conn:
                with conn.cursor() as cur:
                    # Insert valid triplets
                    valid = [
                        (t["subject"], t["relation"], t["object"])
                        for t in triplets
                        if all(k in t for k in ("subject", "relation", "object"))
                        and t["subject"] and t["object"]
                    ]
                    if valid:
                        execute_values(
                            cur,
                            "INSERT INTO extracted_triplets (subject, relation, object) VALUES %s",
                            valid,
                        )

                    # Mark all messages in this batch as processed
                    execute_values(
                        cur,
                        "INSERT INTO processed_messages (message_id) VALUES %s "
                        "ON CONFLICT (message_id) DO NOTHING",
                        [(mid,) for mid in msg_ids],
                    )

            pbar.update(len(messages))

        pbar.close()

    # Summary
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                (SELECT COUNT(DISTINCT subject) FROM extracted_triplets)
                + (SELECT COUNT(DISTINCT object)  FROM extracted_triplets),
                (SELECT COUNT(*) FROM extracted_triplets)
        """)
        node_count, edge_count = cur.fetchone()

    conn.close()

    print(f"\n✅ Processing complete.")
    print(f"   ~{node_count:,} unique nodes | {edge_count:,} edges in extracted_triplets")


if __name__ == "__main__":
    main()
