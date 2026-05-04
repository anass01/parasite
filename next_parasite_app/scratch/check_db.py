import duckdb
import os

db_path = '../db/chat.duckdb'
if not os.path.exists(db_path):
    print(f"Error: {db_path} not found")
    exit(1)

con = duckdb.connect(db_path)
try:
    res = con.execute("""
        SELECT 
            author_name as name, 
            COUNT(*) as message_count,
            MAX(timestamp_usec) as last_seen
        FROM chat_messages 
        GROUP BY author_name 
        ORDER BY message_count DESC
        LIMIT 5
    """).fetchall()
    print("Success:", res)
except Exception as e:
    print("Error:", e)
finally:
    con.close()
