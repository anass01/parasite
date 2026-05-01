import time
import duckdb
import json
import os
import sys
import networkx as nx
from openai import OpenAI
from tqdm import tqdm
from config import DB_PATH, LLM_BASE_URL, LLM_MODEL, BATCH_SIZE, GRAPHML_PATH

# Configure output encoding for Windows terminal
sys.stdout.reconfigure(encoding='utf-8')

# --- KNOWLEDGE CONTEXT ---
KNOWLEDGE = """
comunity is for people who want to be rich
zouhir is the host of the stream
parasite is someone who works online but not super profesional 
dragonball is a succesfull parasite
yajoura means brick used in this commnity to describe consistency and hard work (brick by brick)
mauritania is used as a alias when they want to talk about morocco
dela7 means watermelon and is used as a synonym for women in multiple ways not derogatory
subhuman means someone who doesnt make money or isnt a channel member
labubu means burnout in this comunity
HMH is a greeting used in this comunity (health money heaven)
"""

# --- SYSTEM PROMPT ---
SYSTEM_PROMPT = f"""
You are an expert Data Scientist extracting Knowledge Graph triplets from a livestream chat. 
The chat contains a mix of English, Moroccan Darija, and other languages.

Your task is to extract relationships and output them STRICTLY as a JSON array of objects. 

KNOWLEDGE BASE:
{KNOWLEDGE}

CRITICAL RULES:
1. NORMALIZE TO ENGLISH: Translate all underlying topics and actions into English. If someone speaks in Darija, extract the meaning and write the JSON in English to maintain graph consistency.
2. STRICT ONTOLOGY: The "relation" key MUST be exactly one of the following uppercase terms: 
   [ASKED_QUESTION_TO, ANSWERED, AGREED_WITH, DISAGREED_WITH, SHARED_ADVICE, ADMITTED_FAILURE, CELEBRATED_WIN, MENTIONED_TOOL, DISCUSSED_TOPIC, DONATED_TO, CRITICIZED, GREETED, CONGRATULATED]
3. CLEAN ENTITIES: Keep the "subject" and "object" names concise (1-3 words). 
4. NO PROPORTIONAL PROSE: Output nothing but the raw JSON array. No markdown formatting, no conversational text before or after.
5. CONTEXTUAL ACCURACY: Use the Knowledge Base provided to correctly interpret community-specific slang.

Example Output:
[
  {{ "subject": "User_A", "relation": "DISCUSSED_TOPIC", "object": "React in Next.js" }},
  {{ "subject": "User_B", "relation": "ANSWERED", "object": "User_A" }}
]
"""

def extract_triplets(client, chat_text):
    prompt = f"### Chat Log:\n{chat_text}\n\n### Extraction (JSON ONLY):"
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1,
        seed=42
    )
    content = response.choices[0].message.content.strip()
    
    # Remove potential markdown code blocks
    if content.startswith("```json"):
        content = content[7:-3].strip()
    elif content.startswith("```"):
        content = content[3:-3].strip()
    
    try:
        data = json.loads(content)
        if not isinstance(data, list):
            raise ValueError("LLM output is not a JSON array/list")
        return data
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON format: {e}")

def main():
    print("🚀 Initializing Chat Graph Map Generator...")
    
    # 1. Setup Connections and Persistence Tables
    client = OpenAI(base_url=LLM_BASE_URL, api_key="not-needed")
    con = duckdb.connect(DB_PATH)
    
    # Create tables for persistence if they don't exist
    con.execute("""
        CREATE TABLE IF NOT EXISTS extracted_triplets (
            subject VARCHAR,
            relation VARCHAR,
            object VARCHAR
        )
    """)
    con.execute("""
        CREATE TABLE IF NOT EXISTS processed_messages (
            message_id VARCHAR PRIMARY KEY
        )
    """)
    
    # 2. Get Count of Remaining Messages
    total_remaining = con.execute("""
        SELECT COUNT(*) FROM chat_messages 
        WHERE message_id NOT IN (SELECT message_id FROM processed_messages)
    """).fetchone()[0]
    
    if total_remaining == 0:
        print("🎉 All messages have already been processed!")
    else:
        print(f"📊 Remaining messages to process: {total_remaining}")
        
        # 3. Process in Batches
        pbar = tqdm(total=total_remaining, desc="Processing New Messages")
        
        while True:
            batch_query = f"""
                SELECT message_id, author_name, message 
                FROM chat_messages 
                WHERE message_id NOT IN (SELECT message_id FROM processed_messages)
                ORDER BY timestamp_usec ASC
                LIMIT {BATCH_SIZE}
            """
            messages = con.execute(batch_query).fetchall()
            
            if not messages:
                break
                
            msg_ids = [row[0] for row in messages]
            chat_text = "\n".join([f"{row[1]}: {row[2]}" for row in messages])
            
            # Extract triplets with retries
            triplets = None
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    triplets = extract_triplets(client, chat_text)
                    break
                except Exception as e:
                    if attempt < max_retries - 1:
                        time.sleep(1)
                    else:
                        triplets = []
            
            # Save to database
            if triplets:
                triplet_data = [
                    (t["subject"], t["relation"], t["object"]) 
                    for t in triplets 
                    if all(k in t for k in ("subject", "relation", "object")) 
                    and t["subject"] is not None 
                    and t["object"] is not None
                ]
                
                if triplet_data:
                    con.executemany("INSERT INTO extracted_triplets VALUES (?, ?, ?)", triplet_data)
            
            # Mark messages as processed
            processed_data = [(mid,) for mid in msg_ids]
            con.executemany("INSERT INTO processed_messages VALUES (?)", processed_data)
            
            pbar.update(len(messages))
            
        pbar.close()
    
    # 4. Final Graph Summary
    node_count = con.execute("SELECT COUNT(DISTINCT subject) + COUNT(DISTINCT object) FROM extracted_triplets").fetchone()[0]
    edge_count = con.execute("SELECT COUNT(*) FROM extracted_triplets").fetchone()[0]
    print(f"✅ Processing complete. Unified graph has approximately {node_count} nodes and {edge_count} edges.")
    print("💡 Run 'visualize_graph.py' to generate the HTML visualization.")

if __name__ == "__main__":
    main()
