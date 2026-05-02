import os
import duckdb
import psycopg2
from psycopg2.extras import execute_values
from tqdm import tqdm
import sys

# --- CONFIGURATION ---
# DuckDB path
DUCKDB_PATH = './db/chat.duckdb'

# Supabase PostgreSQL Connection String
# Example: postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres
SUPABASE_CONN_STRING = "postgresql://postgres:6RVf9oAXAQ9d0faU@db.nlmczjlnlzifzffevpww.supabase.co:5432/postgres"

# Batch size for migration
BATCH_SIZE = 5000

def migrate_table(con_duck, con_pg, table_name, columns, pg_schema=None):
    """
    Migrates data from a DuckDB table to a PostgreSQL table.
    """
    print(f"📦 Migrating table: {table_name}...")
    
    # Create table in PostgreSQL if it doesn't exist
    cur_pg = con_pg.cursor()
    if pg_schema:
        cur_pg.execute(pg_schema)
        con_pg.commit()
    
    # Get total count from DuckDB
    total_rows = con_duck.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    if total_rows == 0:
        print(f"ℹ️ Table {table_name} is empty, skipping.")
        return

    # Extract and Load in batches
    col_str = ", ".join(columns)
    placeholder_str = ", ".join(["%s"] * len(columns))
    
    pbar = tqdm(total=total_rows, desc=f"Transferring {table_name}")
    
    # Use a cursor for streaming from DuckDB if possible, 
    # but DuckDB's python client fetchmany is usually enough for local DBs
    rows_iter = con_duck.execute(f"SELECT {col_str} FROM {table_name}")
    
    while True:
        rows = rows_iter.fetchmany(BATCH_SIZE)
        if not rows:
            break
            
        execute_values(cur_pg, f"INSERT INTO {table_name} ({col_str}) VALUES %s ON CONFLICT DO NOTHING", rows)
        con_pg.commit()
        pbar.update(len(rows))
        
    pbar.close()
    
    # Verification
    cur_pg.execute(f"SELECT COUNT(*) FROM {table_name}")
    pg_count = cur_pg.fetchone()[0]
    print(f"✅ Migrated {table_name}: DuckDB={total_rows}, Supabase={pg_count}")

def main():
    if SUPABASE_CONN_STRING == "YOUR_SUPABASE_CONNECTION_STRING_HERE":
        print("❌ Error: Please update SUPABASE_CONN_STRING in the script with your actual connection string.")
        sys.exit(1)

    print("🚀 Starting Migration: DuckDB -> Supabase")
    
    try:
        # Connect to databases
        con_duck = duckdb.connect(DUCKDB_PATH)
        con_pg = psycopg2.connect(SUPABASE_CONN_STRING)
        
        # 1. Table: processed_files
        migrate_table(
            con_duck, con_pg, "processed_files",
            ["file_name", "video_id", "processed_at"],
            """
            CREATE TABLE IF NOT EXISTS processed_files (
                file_name TEXT PRIMARY KEY,
                video_id TEXT,
                processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        # 2. Table: chat_messages
        # Note: We don't have a unique key in DuckDB for chat_messages, 
        # but message_id is usually unique from YouTube.
        migrate_table(
            con_duck, con_pg, "chat_messages",
            ["video_id", "video_title", "message_id", "timestamp_usec", "timestamp", "author_name", "author_id", "message", "message_type", "purchase_amount"],
            """
            CREATE TABLE IF NOT EXISTS chat_messages (
                video_id TEXT,
                video_title TEXT,
                message_id TEXT PRIMARY KEY,
                timestamp_usec BIGINT,
                timestamp TIMESTAMP,
                author_name TEXT,
                author_id TEXT,
                message TEXT,
                message_type TEXT,
                purchase_amount TEXT
            )
            """
        )

        # 3. Table: processed_messages
        migrate_table(
            con_duck, con_pg, "processed_messages",
            ["message_id"],
            """
            CREATE TABLE IF NOT EXISTS processed_messages (
                message_id TEXT PRIMARY KEY
            )
            """
        )

        # 4. Table: extracted_triplets
        # This table doesn't have a natural PK in the DuckDB schema, so we create it without one
        # but we add an ID for convenience in Postgres.
        migrate_table(
            con_duck, con_pg, "extracted_triplets",
            ["subject", "relation", "object"],
            """
            CREATE TABLE IF NOT EXISTS extracted_triplets (
                id SERIAL PRIMARY KEY,
                subject TEXT,
                relation TEXT,
                object TEXT
            )
            """
        )

        print("\n🎉 Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
    finally:
        if 'con_duck' in locals():
            con_duck.close()
        if 'con_pg' in locals():
            con_pg.close()

if __name__ == "__main__":
    main()
