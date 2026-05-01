import json
import re
from collections import Counter

with open('graph_map.html', 'r', encoding='utf-8') as f:
    content = f.read()

match = re.search(r'const gData = (\{.*?\});', content, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    nodes = data['nodes']
    ids = [n['id'] for n in nodes]
    unique_ids = set(ids)
    print(f"Total nodes: {len(nodes)}")
    print(f"Unique IDs: {len(unique_ids)}")
    
    non_normalized = [i for i in ids if i != i.lower().lstrip('@')]
    print(f"Non-normalized IDs count: {len(non_normalized)}")
    if non_normalized:
        print(f"Sample non-normalized IDs: {non_normalized[:10]}")
        
    # Check for casing duplicates or @ duplicates that SHOULD have been merged
    clean_ids = [i.lower().lstrip('@') for i in ids]
    if len(clean_ids) != len(set(clean_ids)):
        print("Casing or @ duplicates still exist in the IDs!")
        from collections import Counter
        dupes = [item for item, count in Counter(clean_ids).items() if count > 1]
        for d in dupes[:10]:
            matches = [i for i in ids if i.lower().lstrip('@') == d]
            print(f"  Conflict for '{d}': {matches}")
    else:
        print("All IDs are correctly normalized.")

    # Check labels
    labels = [n['name'] for n in nodes]
    label_counts = Counter(labels)
    dupe_labels = [l for l, c in label_counts.items() if c > 1]
    print(f"Exact duplicate labels count: {len(dupe_labels)}")
    
    # Check case-insensitive duplicate labels
    lower_labels = [l.lower() for l in labels]
    lower_label_counts = Counter(lower_labels)
    case_dupe_labels = [l for l, c in lower_label_counts.items() if c > 1]
    case_dupe_labels_count = len(case_dupe_labels)
    print(f"Case-insensitive duplicate labels count: {case_dupe_labels_count}")
    if case_dupe_labels_count > 0:
        print(f"Sample case-insensitive duplicate labels:")
        for l in case_dupe_labels[:10]:
            matches = [lab for lab in labels if lab.lower() == l]
            print(f"  Conflict for '{l}': {matches}")
else:
    print("Could not find gData in HTML")
