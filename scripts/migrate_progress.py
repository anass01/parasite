#!/usr/bin/env python3
"""
migrate_progress.py
--------------------
Migrates the three pipeline progress tables from DuckDB → PostgreSQL so that
the scripts in `pipeline/` can resume from where the old DuckDB-based tools
left off, without reprocessing any data.

Tables migrated
---------------
  processed_files    (import_chat.py  tracks which .live_chat.json files are done)
  processed_messages (generate_graph.py tracks which message_ids have been sent to LLM)
  extracted_triplets (generate_graph.py stores subject→relation→object triplets)

Safe to run multiple times — all inserts use ON CONFLICT DO NOTHING.

Usage
-----
  # from the repo root:
  python scripts/migrate_progress.py

  # or with a custom DB URL:
  PG_URL=postgresql://user:pass@host:5432/db python scripts/migrate_progress.py

Requirements
------------
  pip install duckdb psycopg2-binary
"""

import os
import sys

import duckdb
import psycopg2
from psycopg2.extras import execute_values

# ---------------------------------------------------------------------------
# Config — mirrors pipeline/config.py so both are always in sync
# ---------------------------------------------------------------------------
_HERE             = os.path.dirname(os.path.abspath(__file__))
_ROOT             = os.path.join(_HERE, "..")

DUCKDB_CHAT_PATH  = os.path.join(_ROOT, "db", "chat.duckdb")

# Reads DATABASE_URL (same var as Next.js / pipeline/config.py), then PG_URL,
# then falls back to the local dev default that was set in pipeline/config.py.
PG_URL = (
    os.environ.get("DATABASE_URL")
    or os.environ.get("PG_URL")
    or "postgresql://postgres:postgres@localhost:5432/parasite"
)

BATCH_SIZE = 10_000   # rows per execute_values call


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def duck_connect(path: str):
    if not os.path.exists(path):
        print(f"[✗] DuckDB file not found: {path}")
        sys.exit(1)
    print(f"  Opening DuckDB (read-only): {os.path.abspath(path)}")
    return duckdb.connect(path, config={"access_mode": "READ_ONLY"})


def pg_connect():
    host_part = PG_URL.split("@")[-1] if "@" in PG_URL else PG_URL
    print(f"  Connecting to PostgreSQL  : {host_part}")
    conn = psycopg2.connect(PG_URL)
    conn.autocommit = False
    return conn


def table_exists_duck(con, table_name: str) -> bool:
    try:
        con.execute(f"SELECT 1 FROM {table_name} LIMIT 0")
        return True
    except Exception:
        return False


def count_duck(con, table_name: str) -> int:
    return con.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]


def count_pg(cur, table_name: str) -> int:
    cur.execute(f"SELECT COUNT(*) FROM {table_name}")
    return cur.fetchone()[0]


# ---------------------------------------------------------------------------
# Per-table migration functions
# ---------------------------------------------------------------------------

def migrate_processed_files(duck, pg_cur) -> int:
    """
    processed_files — one row per .live_chat.json file already imported.
    Schema expected by pipeline/import_chat.py:
        file_name TEXT PRIMARY KEY,
        video_id  TEXT,
        processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    """
    print("\n[1/3] processed_files")

    pg_cur.execute("""
        CREATE TABLE IF NOT EXISTS processed_files (
            file_name    TEXT PRIMARY KEY,
            video_id     TEXT,
            processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)

    if not table_exists_duck(duck, "processed_files"):
        print("      ⚠️  Table not found in DuckDB — skipping.")
        return 0

    total = count_duck(duck, "processed_files")
    print(f"      DuckDB rows  : {total:,}")

    if total == 0:
        print("      Nothing to migrate.")
        return 0

    # DuckDB schema: file_name VARCHAR PK, video_id VARCHAR, processed_at TIMESTAMP
    rows = duck.execute(
        "SELECT file_name, video_id, processed_at FROM processed_files"
    ).fetchall()

    execute_values(
        pg_cur,
        """
        INSERT INTO processed_files (file_name, video_id, processed_at)
        VALUES %s
        ON CONFLICT (file_name) DO NOTHING
        """,
        rows,
    )

    inserted = count_pg(pg_cur, "processed_files")
    print(f"      PostgreSQL rows after: {inserted:,}")
    return len(rows)


def migrate_processed_messages(duck, pg_cur) -> int:
    """
    processed_messages — one row per message_id already sent to the LLM.
    Schema expected by pipeline/generate_graph.py:
        message_id TEXT PRIMARY KEY
    """
    print("\n[2/3] processed_messages")

    pg_cur.execute("""
        CREATE TABLE IF NOT EXISTS processed_messages (
            message_id TEXT PRIMARY KEY
        )
    """)

    if not table_exists_duck(duck, "processed_messages"):
        print("      ⚠️  Table not found in DuckDB — skipping.")
        return 0

    total = count_duck(duck, "processed_messages")
    print(f"      DuckDB rows  : {total:,}")

    if total == 0:
        print("      Nothing to migrate.")
        return 0

    inserted_total = 0
    offset = 0
    while True:
        rows = duck.execute(
            f"SELECT message_id FROM processed_messages LIMIT {BATCH_SIZE} OFFSET {offset}"
        ).fetchall()
        if not rows:
            break

        execute_values(
            pg_cur,
            "INSERT INTO processed_messages (message_id) VALUES %s "
            "ON CONFLICT (message_id) DO NOTHING",
            rows,
        )
        inserted_total += len(rows)
        offset         += BATCH_SIZE
        print(f"      ... {min(offset, total):,}/{total:,}", end="\r")

    pg_count = count_pg(pg_cur, "processed_messages")
    print(f"      PostgreSQL rows after: {pg_count:,}          ")
    return inserted_total


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 60)
    print("  Pipeline Progress Migration: DuckDB → PostgreSQL")
    print("=" * 60)

    duck   = duck_connect(DUCKDB_CHAT_PATH)
    pg_conn = pg_connect()
    pg_cur  = pg_conn.cursor()

    try:
        n1 = migrate_processed_files(duck, pg_cur)
        pg_conn.commit()

        n2 = migrate_processed_messages(duck, pg_cur)
        pg_conn.commit()

        print("\n" + "=" * 60)
        print("  Verification")
        print("=" * 60)
        for table in ["processed_files", "processed_messages"]:
            pg_cur.execute(f"SELECT COUNT(*) FROM {table}")
            print(f"  {table:<25} {pg_cur.fetchone()[0]:>10,} rows")

        print("\n[✓] Progress migration complete!")
        print("    You can now run pipeline/import_chat.py and pipeline/generate_graph.py")
        print("    — they will resume from where DuckDB left off.")

    except Exception as exc:
        pg_conn.rollback()
        print(f"\n[✗] Migration FAILED: {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        duck.close()
        pg_cur.close()
        pg_conn.close()


if __name__ == "__main__":
    main()
