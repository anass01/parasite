import duckdb
import json
from openai import OpenAI
import networkx as nx

import sys

# Connect to your local LM Studio instance
sys.stdout.reconfigure(encoding='utf-8')
client = OpenAI(base_url="http://localhost:1234/v1", api_key="not-needed")
con = duckdb.connect('./db/chat.duckdb')

# 1. Fetch a batch of messages
messages = con.execute("SELECT author_name, message FROM chat_messages LIMIT 1000").fetchall()
chat_text = "\n".join([f"{row[0]}: {row[1]}" for row in messages])

# 2. Ask the LLM to extract relationships
prompt = f"""
You are an expert Data Scientist extracting Knowledge Graph triplets from a livestream chat. 
The chat contains a mix of English, Moroccan Darija, and other languages.

Your task is to extract relationships and output them STRICTLY as a JSON array of objects. 

KNOWLEGDE:
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
    
    
CRITICAL RULES:
1. NORMALIZE TO ENGLISH: Translate all underlying topics and actions into English. If someone speaks in Darija, extract the meaning and write the JSON in English to maintain graph consistency.
2. STRICT ONTOLOGY: The "relation" key MUST be exactly one of the following uppercase terms: 
   [ASKED_QUESTION_TO, ANSWERED, AGREED_WITH, DISAGREED_WITH, SHARED_ADVICE, ADMITTED_FAILURE, CELEBRATED_WIN, MENTIONED_TOOL, DISCUSSED_TOPIC, DONATED_TO, CRITICIZED, GREETED, CONGRATULATED]
3. CLEAN ENTITIES: Keep the "object" names concise (1-3 words). 
4. NO PROSE: Output nothing but the raw JSON array. No markdown formatting, no conversational text before or after.

### Example Input:
User_A: chabab kifash nkhdem b React f Nextjs?
User_B: @User_A khassk tdir 'use client' flfoq
User_C: I agree with User_B, that fixed my hydration error yesterday.

### Example Output:
[
  {{ "subject": "User_A", "relation": "DISCUSSED_TOPIC", "object": "React in Next.js" }},
  {{ "subject": "User_B", "relation": "ANSWERED", "object": "User_A" }},
  {{ "subject": "User_B", "relation": "DISCUSSED_TOPIC", "object": "Client Components" }},
  {{ "subject": "User_C", "relation": "AGREED_WITH", "object": "User_B" }},
  {{ "subject": "User_C", "relation": "DISCUSSED_TOPIC", "object": "Hydration Error" }}
]

Format strictly as a list of triplets: {{"subject": "...", "relation": "...", "object": "..."}}

Chat Log:
{chat_text}
"""

response = client.chat.completions.create(
    model="google/gemma-4-e2b",
    messages=[{"role": "user", "content": prompt}],
    temperature=0.1,
    seed = 42
)

# Parse the JSON string returned by the LLM
triplets = json.loads(response.choices[0].message.content)
G = nx.Graph()

for triplet in triplets:
    # Add nodes (e.g., "User_A" and "DuckDB")
    G.add_node(triplet["subject"])
    G.add_node(triplet["object"])
    
    # Add the edge connecting them
    G.add_edge(triplet["subject"], triplet["object"], relation=triplet["relation"])

print(f"Graph created with {G.number_of_nodes()} nodes and {G.number_of_edges()} edges.")

import community.community_louvain as louvain

# 1. Detect clusters in your graph
partition = louvain.best_partition(G)

# 2. Group nodes by their community ID
communities = {}
for node, community_id in partition.items():
    if community_id not in communities:
        communities[community_id] = []
    communities[community_id].append(node)

nx.write_graphml(G, "my_graph.graphml")

# 3. Generate a summary for each community using the LLM
for comm_id, nodes in communities.items():
    # Find all edges (relationships) within this community
    subgraph = G.subgraph(nodes)
    edges = nx.get_edge_attributes(subgraph, 'relation')
    
    # Feed it back to the LLM
    summary_prompt = f"Summarize what this community is discussing based on these relationships: {edges}"
    
    summary_response = client.chat.completions.create(
        model="google/gemma-4-e2b",
        messages=[{"role": "user", "content": summary_prompt}]
    )
    print(f"Community {comm_id} Summary: {summary_response.choices[0].message.content}")