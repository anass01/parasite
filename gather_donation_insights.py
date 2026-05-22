import os
import json
import psycopg2
import urllib.request
import urllib.error

from config import POSTGRES_CONN_STRING

REPORT_DIR = os.path.join("reports", "user_profiles")
MAX_MESSAGE_CHARS = 300000  # Safe character limit to stay under LM Studio token limit

def gather_top_donators():
    print(f"Connecting to PostgreSQL database...")
    try:
        conn = psycopg2.connect(POSTGRES_CONN_STRING)
    except Exception as e:
        print(f"Error: Could not connect to PostgreSQL database: {e}")
        return None

    query = """
    WITH donators AS (
        SELECT 
            author_name,
            COUNT(message_id) AS total_donations_count,
            string_agg(purchase_amount, ',' ORDER BY timestamp DESC) AS donation_history
        FROM 
            chat_messages
        WHERE 
            purchase_amount IS NOT NULL AND TRIM(purchase_amount) <> ''
        GROUP BY 
            author_name
        ORDER BY
            total_donations_count DESC
    )
    SELECT author_name, total_donations_count, donation_history FROM donators LIMIT 10
    """
    
    try:
        print("Fetching top 10 donators from PostgreSQL...")
        with conn.cursor() as cur:
            cur.execute(query)
            result = cur.fetchall()
        donators = []
        for row in result:
            donators.append({
                "author_name": row[0],
                "total_donations_count": row[1],
                "donation_history": row[2]
            })
        return donators
    except Exception as e:
        print(f"Query failed: {e}")
        return None
    finally:
        conn.close()

def fetch_user_messages(author_name):
    try:
        conn = psycopg2.connect(POSTGRES_CONN_STRING)
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        return []
    query = """
    SELECT timestamp, message, purchase_amount 
    FROM chat_messages 
    WHERE author_name = %s 
    ORDER BY timestamp ASC
    """
    try:
        with conn.cursor() as cur:
            cur.execute(query, [author_name])
            result = cur.fetchall()
        messages = []
        for row in result:
            timestamp = row[0]
            text = row[1]
            amount = row[2]
            
            messages.append({
                "timestamp": timestamp,
                "text": text,
                "amount": amount
            })
        return messages
    except Exception as e:
        print(f"Failed to fetch messages for {author_name}: {e}")
        return []
    finally:
        conn.close()

def generate_user_report(author_name, donations_count, donation_history, messages):
    print(f"Contacting LM Studio for {author_name}...")
    
    # 1. Deduplicate and Format messages compactly
    processed_messages = []
    if messages:
        last_msg = None
        count = 1
        
        for i, m in enumerate(messages):
            # Simple deduplication: same text and same amount
            msg_key = (m['text'].strip() if m['text'] else "", m['amount'])
            
            if last_msg and msg_key == last_msg:
                count += 1
            else:
                if last_msg:
                    # Append previous message with its count
                    prev_m = messages[i-1]
                    ts = str(prev_m['timestamp'])[5:16] # "MM-DD HH:MM"
                    amt = f" ({prev_m['amount']})" if prev_m['amount'] else ""
                    cnt = f" (x{count})" if count > 1 else ""
                    msg_str = f"[{ts}]{amt} {prev_m['text']}{cnt}"
                    processed_messages.append({
                        "text": msg_str,
                        "len": len(msg_str),
                        "is_donation": bool(prev_m['amount']),
                        "timestamp": prev_m['timestamp']
                    })
                
                last_msg = msg_key
                count = 1
        
        # Add the final message
        final_m = messages[-1]
        ts = str(final_m['timestamp'])[5:16]
        amt = f" ({final_m['amount']})" if final_m['amount'] else ""
        cnt = f" (x{count})" if count > 1 else ""
        msg_str = f"[{ts}]{amt} {final_m['text']}{cnt}"
        processed_messages.append({
            "text": msg_str,
            "len": len(msg_str),
            "is_donation": bool(final_m['amount']),
            "timestamp": final_m['timestamp']
        })

    total_chars = sum(m['len'] for m in processed_messages)
    
    if total_chars <= MAX_MESSAGE_CHARS:
        selected = processed_messages
    else:
        print(f"  Warning: Compressed messages total {total_chars} chars. Truncating to {MAX_MESSAGE_CHARS}.")
        # Prioritize donations, then most recent messages
        donations = [m for m in processed_messages if m['is_donation']]
        others = [m for m in processed_messages if not m['is_donation']]
        
        selected = []
        current_len = 0
        
        # Fill with donations first (most recent)
        for d in reversed(donations):
            if current_len + d['len'] <= MAX_MESSAGE_CHARS:
                selected.append(d)
                current_len += d['len']
            else: break
            
        # Fill remaining with recent others
        for o in reversed(others):
            if current_len + o['len'] <= MAX_MESSAGE_CHARS:
                selected.append(o)
                current_len += o['len']
            else: break
        
        selected.sort(key=lambda x: x['timestamp'])

    msg_lines = [m['text'] for m in selected]
    print(f"  Selected {len(msg_lines)} processed blocks ({sum(len(m) for m in msg_lines)} chars) from {len(messages)} original messages.")

    prompt = f"Analyze the wealth profile of **{author_name}**.\n"
    prompt += f"Stats: {donations_count} donations. "
    # Note: We omit donation_history here as it's redundant with the messages provided below.
    prompt += f"Below is the chat log (compressed, donations in brackets):\n\n"
    prompt += "\n".join(msg_lines)
    prompt += "\n\nProvide a 'Wealth Intelligence' report covering:\n"
    prompt += "1. **Financial Profile**: Estimated spending power (based on donation frequency/amounts).\n"
    prompt += "2. **Expertise**: Professional field (based on question complexity/topics).\n"
    prompt += "3. **Wealth Origin**: How did they likely acquire wealth? Provide reasoning.\n"
    prompt += "4. **Investment Mindset**: Current interests and motivations.\n"
    prompt += "Be analytical and concise. Focus on economic status and professional background."

    url = "http://localhost:1234/v1/chat/completions"
    headers = {"Content-Type": "application/json"}
    payload = {
        "model": "local-model",
        "messages": [
            {"role": "system", "content": "You are an expert financial analyst and wealth intelligence specialist."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7
    }
    
    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers)
        with urllib.request.urlopen(req, timeout=600) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            content = res_data['choices'][0]['message']['content']
            return content
    except urllib.error.HTTPError as e:
        if e.code == 400:
            return f"LM Studio returned 400 Bad Request. The prompt might still be too large or contains invalid characters. Error: {e}"
        return f"HTTP Error {e.code}: {e.reason}"
    except urllib.error.URLError as e:
        return f"Error connecting to LM Studio: {e}."
    except Exception as e:
        return f"An error occurred: {e}"

def main():
    top_donators = gather_top_donators()
    if not top_donators:
        print("No donators found or query failed.")
        return
        
    os.makedirs(REPORT_DIR, exist_ok=True)
    
    print(f"\nStarting processing for {len(top_donators)} users...")
    
    for i, user in enumerate(top_donators, 1):
        name = user['author_name']
        count = user['total_donations_count']
        history = user['donation_history']
        
        print(f"\n[{i}/{len(top_donators)}] Processing user: {name} ({count} donations)")
        
        messages = fetch_user_messages(name)
        print(f"  Fetched {len(messages)} messages.")
        
        if not messages:
            print(f"  Skipping {name} due to no messages found.")
            continue
            
        report = generate_user_report(name, count, history, messages)
        
        # Save individual report
        safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '_', '-')).rstrip()
        if not safe_name:
            safe_name = f"user_{i}"
            
        file_path = os.path.join(REPORT_DIR, f"{safe_name}.md")
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(report)
            
        print(f"  Report saved to: {file_path}")
        
    print(f"\nAll reports completed. Check the '{REPORT_DIR}' directory.")

if __name__ == "__main__":
    main()
