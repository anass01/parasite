#!/usr/bin/env python3
"""
migrate_duckdb_to_pg.py
-----------------------
Migrates all data from the local DuckDB files into PostgreSQL.
Run ONCE before starting the Next.js app with the new pg backend.

Usage:
    python scripts/migrate_duckdb_to_pg.py

Requirements:
    pip install duckdb psycopg2-binary

Environment:
    Set PG_URL to your connection string, or edit the defaults below.
"""

import os
import sys
import duckdb
import psycopg2
from psycopg2.extras import execute_values

# ── Config ────────────────────────────────────────────────────────────────────
DUCKDB_CHAT_PATH    = os.path.join(os.path.dirname(__file__), '..', 'db', 'chat.duckdb')
DUCKDB_CACHE_PATH   = os.path.join(os.path.dirname(__file__), '..', 'db', 'profiler_cache.duckdb')
PG_URL              = os.environ.get('PG_URL', 'postgresql://postgres:postgres@localhost:5432/parasite')
BATCH_SIZE          = 10_000

# ── Helpers ───────────────────────────────────────────────────────────────────
def pg_connect():
    print(f"  Connecting to PostgreSQL: {PG_URL.split('@')[-1]}")
    conn = psycopg2.connect(PG_URL)
    conn.autocommit = False
    return conn

def duck_connect(path, read_only=True):
    mode = {"access_mode": "READ_ONLY"} if read_only else {}
    return duckdb.connect(path, config=mode)

# ── Schema ────────────────────────────────────────────────────────────────────
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS chat_messages (
    id              BIGSERIAL PRIMARY KEY,
    author_name     TEXT,
    message         TEXT,
    timestamp       TIMESTAMPTZ,
    purchase_amount TEXT
);

CREATE TABLE IF NOT EXISTS extracted_triplets (
    id       BIGSERIAL PRIMARY KEY,
    subject  TEXT,
    relation TEXT,
    object   TEXT
);

CREATE TABLE IF NOT EXISTS user_insights (
    username   TEXT PRIMARY KEY,
    insights   TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
"""

INDEXES_SQL = """
CREATE INDEX IF NOT EXISTS idx_chat_author  ON chat_messages(author_name);
CREATE INDEX IF NOT EXISTS idx_chat_amount  ON chat_messages(purchase_amount) WHERE purchase_amount IS NOT NULL AND purchase_amount <> '';
CREATE INDEX IF NOT EXISTS idx_trip_subject ON extracted_triplets(subject);
CREATE INDEX IF NOT EXISTS idx_trip_object  ON extracted_triplets(object);
"""

# ── Migration Functions ───────────────────────────────────────────────────────
def migrate_chat_messages(duck, pg_cur):
    print("\n[1/3] Migrating chat_messages...")
    total = duck.execute("SELECT COUNT(*) FROM chat_messages").fetchone()[0]
    print(f"      Found {total:,} rows in DuckDB")

    pg_cur.execute("TRUNCATE chat_messages RESTART IDENTITY CASCADE")

    offset = 0
    inserted = 0
    while True:
        rows = duck.execute(
            "SELECT author_name, message, timestamp, purchase_amount "
            "FROM chat_messages ORDER BY rowid "
            f"LIMIT {BATCH_SIZE} OFFSET {offset}"
        ).fetchall()
        if not rows:
            break
        execute_values(
            pg_cur,
            "INSERT INTO chat_messages (author_name, message, timestamp, purchase_amount) VALUES %s",
            rows,
        )
        inserted += len(rows)
        offset   += BATCH_SIZE
        print(f"      ... {inserted:,}/{total:,}", end='\r')
    print(f"      Done: {inserted:,} rows inserted.         ")

def migrate_extracted_triplets(duck, pg_cur):
    print("\n[2/3] Migrating extracted_triplets...")
    total = duck.execute("SELECT COUNT(*) FROM extracted_triplets").fetchone()[0]
    print(f"      Found {total:,} rows in DuckDB")

    pg_cur.execute("TRUNCATE extracted_triplets RESTART IDENTITY CASCADE")

    offset = 0
    inserted = 0
    while True:
        rows = duck.execute(
            "SELECT subject, relation, object FROM extracted_triplets "
            f"LIMIT {BATCH_SIZE} OFFSET {offset}"
        ).fetchall()
        if not rows:
            break
        execute_values(
            pg_cur,
            "INSERT INTO extracted_triplets (subject, relation, object) VALUES %s",
            rows,
        )
        inserted += len(rows)
        offset   += BATCH_SIZE
        print(f"      ... {inserted:,}/{total:,}", end='\r')
    print(f"      Done: {inserted:,} rows inserted.         ")

def migrate_user_insights(duck_cache, pg_cur):
    print("\n[3/3] Migrating user_insights (profiler cache)...")
    try:
        rows = duck_cache.execute("SELECT userName, insights FROM user_insights").fetchall()
    except Exception as e:
        print(f"      Skipped (table missing or error): {e}")
        return
    if not rows:
        print("      No cached insights found, skipping.")
        return
    # Normalize column name: DuckDB used 'userName' (camelCase)
    execute_values(
        pg_cur,
        "INSERT INTO user_insights (username, insights) VALUES %s ON CONFLICT (username) DO NOTHING",
        rows,
    )
    print(f"      Done: {len(rows)} rows inserted.")

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  DuckDB → PostgreSQL Migration")
    print("=" * 60)

    # Connect
    duck_chat  = duck_connect(DUCKDB_CHAT_PATH, read_only=True)
    duck_cache = duck_connect(DUCKDB_CACHE_PATH, read_only=False)
    pg_conn    = pg_connect()
    pg_cur     = pg_conn.cursor()

    try:
        # Create schema
        print("\n[0] Creating schema and indexes...")
        pg_cur.execute(SCHEMA_SQL)
        pg_cur.execute(INDEXES_SQL)
        pg_conn.commit()
        print("    Schema ready.")

        # Migrate data
        migrate_chat_messages(duck_chat, pg_cur)
        pg_conn.commit()

        migrate_extracted_triplets(duck_chat, pg_cur)
        pg_conn.commit()

        migrate_user_insights(duck_cache, pg_cur)
        pg_conn.commit()

        # Verify
        print("\n[✓] Verification:")
        for table in ["chat_messages", "extracted_triplets", "user_insights"]:
            pg_cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = pg_cur.fetchone()[0]
            print(f"    {table}: {count:,} rows")

        print("\n[✓] Migration complete! You can now start the app.")
        print("    Don't forget to set DATABASE_URL in next_parasite_app/.env")

    except Exception as e:
        pg_conn.rollback()
        print(f"\n[✗] Migration FAILED: {e}")
        sys.exit(1)
    finally:
        duck_chat.close()
        duck_cache.close()
        pg_cur.close()
        pg_conn.close()

if __name__ == "__main__":
    main()
