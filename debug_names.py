import duckdb
con = duckdb.connect('./db/chat.duckdb')
authors = con.execute('SELECT DISTINCT author_name FROM chat_messages LIMIT 100').fetchall()
triplets = con.execute('SELECT subject FROM extracted_triplets LIMIT 100').fetchall()

with open('debug_names.txt', 'w', encoding='utf-8') as f:
    f.write("--- SAMPLE AUTHORS ---\n")
    for a in authors:
        f.write(f"'{a[0]}'\n")
    f.write("\n--- SAMPLE TRIPLET SUBJECTS ---\n")
    for t in triplets:
        f.write(f"'{t[0]}'\n")
