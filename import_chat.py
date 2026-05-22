"""
import_chat.py  (PostgreSQL edition)
=====================================
Reads YouTube live-chat JSON files from CHAT_DIR and inserts them into
the Supabase / PostgreSQL database.

Progress is tracked in the `processed_files` table so that you can stop
and resume at any time — already-imported files are always skipped.

Tables managed by this script
------------------------------
  chat_messages   — one row per chat event (text or superchat)
  processed_files — one row per .live_chat.json file that was fully imported
"""

import os
import sys
import json
import glob
from datetime import datetime, timezone

import psycopg2
from psycopg2.extras import execute_values

from config import POSTGRES_CONN_STRING, CHAT_DIR

# Configure output encoding for Windows terminal
sys.stdout.reconfigure(encoding='utf-8')


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_connection() -> psycopg2.extensions.connection:
    return psycopg2.connect(POSTGRES_CONN_STRING)


def ensure_tables(cur) -> None:
    """Create progress/data tables if they do not already exist."""

    # -- chat_messages: create if brand-new ------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            video_id        TEXT,
            video_title     TEXT,
            message_id      TEXT PRIMARY KEY,
            timestamp_usec  BIGINT,
            timestamp       TIMESTAMP WITH TIME ZONE,
            author_name     TEXT,
            author_id       TEXT,
            message         TEXT,
            message_type    TEXT,
            purchase_amount TEXT
        )
    """)

    # Ensure columns exist in case table was created with an old schema
    _missing_cols = [
        ("video_id",        "TEXT"),
        ("video_title",     "TEXT"),
        ("message_id",      "TEXT"),
        ("timestamp_usec",  "BIGINT"),
        ("author_id",       "TEXT"),
        ("message_type",    "TEXT"),
    ]
    for col, dtype in _missing_cols:
        cur.execute(f"ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS {col} {dtype}")

    # Ensure a unique constraint on message_id so ON CONFLICT works.
    cur.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE tablename = 'chat_messages'
                  AND indexdef ILIKE '%message_id%'
            ) THEN
                CREATE UNIQUE INDEX idx_chat_messages_message_id
                    ON chat_messages (message_id);
            END IF;
        END $$;
    """)

    # -- processed_files -------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS processed_files (
            file_name    TEXT PRIMARY KEY,
            video_id     TEXT,
            processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)


def parse_filename(filename: str) -> tuple[str, str]:
    """
    Extracts (video_title, video_id) from a YouTube chat filename.

    Expected format: [Title]-[VideoID]-[Date].live_chat.json
    """
    basename  = os.path.basename(filename)
    name_part = basename.replace(".live_chat.json", "")

    parts = name_part.rsplit("-", 2)
    if len(parts) >= 3:
        title, video_id = parts[0], parts[1]
    elif len(parts) == 2:
        title, video_id = parts[0], parts[1]
    else:
        title, video_id = name_part, "unknown"

    return title, video_id


def extract_message_text(renderer: dict) -> str:
    """Concatenates text runs (including emoji shortcuts) into a plain string."""
    if "message" not in renderer:
        return ""

    text_parts = []
    for run in renderer["message"].get("runs", []):
        if "text" in run:
            text_parts.append(run["text"])
        elif "emoji" in run:
            emoji = run["emoji"]
            if "shortcuts" in emoji and emoji["shortcuts"]:
                text_parts.append(emoji["shortcuts"][0])
            elif "emojiId" in emoji:
                text_parts.append(emoji["emojiId"])

    return "".join(text_parts)


def parse_file(file_path: str, title: str, video_id: str) -> list[tuple]:
    """Parses one .live_chat.json file and returns a list of row tuples."""
    rows: list[tuple] = []

    with open(file_path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue

            actions = data.get("replayChatItemAction", {}).get("actions", [])
            for action in actions:
                item = action.get("addChatItemAction", {}).get("item", {})
                if not item:
                    continue

                renderer      = None
                msg_type      = None
                purchase_amount = None

                if "liveChatTextMessageRenderer" in item:
                    renderer = item["liveChatTextMessageRenderer"]
                    msg_type = "text"
                elif "liveChatPaidMessageRenderer" in item:
                    renderer = item["liveChatPaidMessageRenderer"]
                    msg_type = "paid"
                    purchase_amount = renderer.get(
                        "purchaseAmountText", {}
                    ).get("simpleText")

                if renderer is None:
                    continue

                msg_id         = renderer.get("id")
                timestamp_usec = int(renderer.get("timestampUsec", 0))
                author_name    = renderer.get("authorName", {}).get("simpleText")
                author_id      = renderer.get("authorExternalChannelId")
                message        = extract_message_text(renderer)

                dt = None
                if timestamp_usec:
                    try:
                        dt = datetime.fromtimestamp(
                            timestamp_usec / 1_000_000, tz=timezone.utc
                        )
                    except (ValueError, OSError):
                        dt = None

                rows.append((
                    video_id,
                    title,
                    msg_id,
                    timestamp_usec,
                    dt,
                    author_name,
                    author_id,
                    message,
                    msg_type,
                    purchase_amount,
                ))

    return rows


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print(f"🔌 Connecting to PostgreSQL…")
    conn = get_connection()

    with conn:
        with conn.cursor() as cur:
            ensure_tables(cur)
            conn.commit()

            # Fetch already-processed files
            cur.execute("SELECT file_name FROM processed_files")
            processed_files: set[str] = {row[0] for row in cur.fetchall()}

    if processed_files:
        print(f"⏭️  Skipping {len(processed_files)} already-processed file(s).")

    # Discover all chat JSON files
    search_path = os.path.join(CHAT_DIR, "*.live_chat.json")
    all_files   = glob.glob(search_path)
    print(f"📂 Found {len(all_files)} chat file(s) in {CHAT_DIR}")

    pending = [f for f in all_files if os.path.basename(f) not in processed_files]
    print(f"🗂️  {len(pending)} file(s) to process\n")

    total_inserted = 0
    BATCH = 5000  # rows to upsert per execute_values call

    for file_path in pending:
        file_name          = os.path.basename(file_path)
        title, video_id    = parse_filename(file_path)
        print(f"  → {ascii(file_name)}", end=" ", flush=True)

        try:
            rows = parse_file(file_path, title, video_id)

            if rows:
                with conn:
                    with conn.cursor() as cur:
                        # Upsert in chunks to keep memory usage bounded
                        for i in range(0, len(rows), BATCH):
                            chunk = rows[i : i + BATCH]
                            execute_values(
                                cur,
                                """
                                INSERT INTO chat_messages
                                    (video_id, video_title, message_id,
                                     timestamp_usec, timestamp,
                                     author_name, author_id,
                                     message, message_type, purchase_amount)
                                VALUES %s
                                ON CONFLICT (message_id) DO NOTHING
                                """,
                                chunk,
                            )

                        # Mark file as done
                        cur.execute(
                            "INSERT INTO processed_files (file_name, video_id) VALUES (%s, %s) "
                            "ON CONFLICT (file_name) DO NOTHING",
                            (file_name, video_id),
                        )

                total_inserted += len(rows)
                print(f"✅ {len(rows):,} messages")
            else:
                # Empty file — still mark as processed so we skip it next time
                with conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "INSERT INTO processed_files (file_name, video_id) VALUES (%s, %s) "
                            "ON CONFLICT (file_name) DO NOTHING",
                            (file_name, video_id),
                        )
                print("⚠️  0 messages (empty or no parseable actions)")

        except Exception as exc:
            print(f"\n❌ Error: {exc}")

    # Final summary
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM chat_messages")
        db_count = cur.fetchone()[0]

    conn.close()

    print(f"\n🎉 Import complete!")
    print(f"   Messages inserted this run : {total_inserted:,}")
    print(f"   Total rows in chat_messages: {db_count:,}")


if __name__ == "__main__":
    main()
