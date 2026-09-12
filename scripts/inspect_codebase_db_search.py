import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

print("=== 1. Inspecting src/data/screenguards.json ===")
with open('src/data/screenguards.json', 'r', encoding='utf-8') as f:
    sg = json.load(f)

print(f"Version: {sg.get('version')}")
print(f"Total boxes/groups: {len(sg.get('boxes', []))}")
if sg.get('boxes'):
    print("Sample box 0:", sg['boxes'][0])

print("\n=== 2. Inspecting seed-data.sql sample ===")
with open('seed-data.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

print("SQL length:", len(sql))
print("First 300 chars of SQL:")
print(sql[:300])

print("\n=== 3. Inspecting src/lib/db.ts ===")
if os.path.exists('src/lib/db.ts'):
    with open('src/lib/db.ts', 'r', encoding='utf-8') as f:
        print(f.read()[:500])

print("\n=== 4. Inspecting src/lib/search.ts ===")
if os.path.exists('src/lib/search.ts'):
    with open('src/lib/search.ts', 'r', encoding='utf-8') as f:
        print(f.read()[:600])
