import os
import json
import glob
from datetime import datetime
import duckdb

# Path to the directory containing YouTube chat JSON files
CHAT_DIR = r"F:\projects\parasite\chat"
# Path to the DuckDB database folder
DB_FOLDER = "./db"
os.makedirs(DB_FOLDER, exist_ok=True)
DB_PATH = os.path.join(DB_FOLDER, "chat.duckdb")

def parse_filename(filename):
    """
    Parses the filename to extract the video title and ID.
    Expected format: [Title]-[VideoID]-[Date].live_chat.json
    """
    basename = os.path.basename(filename)
    name_part = basename.replace(".live_chat.json", "")
    
    # Split by '-' from the right to get date and video_id
    parts = name_part.rsplit("-", 2)
    if len(parts) >= 3:
        title = parts[0]
        video_id = parts[1]
    elif len(parts) == 2:
        title = parts[0]
        video_id = parts[1]
    else:
        title = name_part
        video_id = "unknown"
        
    return title, video_id

def extract_message_text(renderer):
    """
    Extracts and concatenates text from message runs, including emojis.
    """
    if "message" not in renderer:
        return ""
    runs = renderer["message"].get("runs", [])
    text_parts = []
    for run in runs:
        if "text" in run:
            text_parts.append(run["text"])
        elif "emoji" in run:
            emoji = run["emoji"]
            if "shortcuts" in emoji and emoji["shortcuts"]:
                text_parts.append(emoji["shortcuts"][0])
            elif "emojiId" in emoji:
                text_parts.append(emoji["emojiId"])
    return "".join(text_parts)

def main():
    print(f"Connecting to DuckDB at: {DB_PATH}")
    con = duckdb.connect(DB_PATH)
    
    # Create tables if they don't exist
    con.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            video_id VARCHAR,
            video_title VARCHAR,
            message_id VARCHAR,
            timestamp_usec BIGINT,
            timestamp TIMESTAMP,
            author_name VARCHAR,
            author_id VARCHAR,
            message VARCHAR,
            message_type VARCHAR,
            purchase_amount VARCHAR
        )
    """)
    
    con.execute("""
        CREATE TABLE IF NOT EXISTS processed_files (
            file_name VARCHAR PRIMARY KEY,
            video_id VARCHAR,
            processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Find all JSON files in the chat directory
    search_path = os.path.join(CHAT_DIR, "*.live_chat.json")
    files = glob.glob(search_path)
    
    print(f"Found {len(files)} chat files in {CHAT_DIR}")
    
    # Get list of already processed files
    processed_files = set(row[0] for row in con.execute("SELECT file_name FROM processed_files").fetchall())
    if processed_files:
        print(f"Already processed {len(processed_files)} files. They will be skipped.")
    
    batch_size = 10000
    rows_to_insert = []
    total_inserted = 0
    
    for file_path in files:
        file_name = os.path.basename(file_path)
        if file_name in processed_files:
            continue
            
        title, video_id = parse_filename(file_path)
        print(f"Processing: {ascii(file_name)}")
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                for line in f:
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    
                    replay_action = data.get("replayChatItemAction", {})
                    actions = replay_action.get("actions", [])
                    
                    for action in actions:
                        add_chat_item = action.get("addChatItemAction", {})
                        item = add_chat_item.get("item", {})
                        
                        if not item:
                            continue
                        
                        renderer = None
                        msg_type = None
                        purchase_amount = None
                        
                        if "liveChatTextMessageRenderer" in item:
                            renderer = item["liveChatTextMessageRenderer"]
                            msg_type = "text"
                        elif "liveChatPaidMessageRenderer" in item:
                            renderer = item["liveChatPaidMessageRenderer"]
                            msg_type = "paid"
                            purchase_amount = renderer.get("purchaseAmountText", {}).get("simpleText")
                        
                        if renderer:
                            msg_id = renderer.get("id")
                            timestamp_usec = int(renderer.get("timestampUsec", 0))
                            author_name = renderer.get("authorName", {}).get("simpleText")
                            author_id = renderer.get("authorExternalChannelId")
                            message = extract_message_text(renderer)
                            
                            # Convert timestamp_usec to datetime
                            dt = None
                            if timestamp_usec:
                                try:
                                    dt = datetime.fromtimestamp(timestamp_usec / 1000000)
                                except (ValueError, OSError):
                                    # Handle potential timestamp range issues
                                    dt = None
                            
                            rows_to_insert.append((
                                video_id,
                                title,
                                msg_id,
                                timestamp_usec,
                                dt,
                                author_name,
                                author_id,
                                message,
                                msg_type,
                                purchase_amount
                            ))
                            
                            if len(rows_to_insert) >= batch_size:
                                con.executemany("""
                                    INSERT INTO chat_messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                """, rows_to_insert)
                                total_inserted += len(rows_to_insert)
                                rows_to_insert = []
            # Flush any remaining messages for this file
            if rows_to_insert:
                con.executemany("INSERT INTO chat_messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows_to_insert)
                total_inserted += len(rows_to_insert)
                rows_to_insert = []

            # Record file as processed
            con.execute("INSERT INTO processed_files (file_name, video_id) VALUES (?, ?)", (file_name, video_id))
            
        except Exception as e:
            print(f"Error processing file {file_path}: {e}")
            
        
    print("\nImport completed!")
    print(f"Total messages inserted: {total_inserted}")
    
    # Verify database content
    db_count = con.execute("SELECT COUNT(*) FROM chat_messages").fetchone()[0]
    print(f"Total records verified in DuckDB: {db_count}")
    
    con.close()

if __name__ == "__main__":
    main()
