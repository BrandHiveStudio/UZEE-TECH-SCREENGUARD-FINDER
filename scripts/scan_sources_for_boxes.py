import fitz # PyMuPDF
import json
import re
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

print("==================================================")
print("SCANNING ALL PROJECT SOURCE FILES FOR BOX NUMBERS")
print("==================================================")

# 1. SCAN compatible-lists.pdf
print("\n--- 1. FILE: compatible-lists.pdf ---")
pdf_path = 'compatible-lists.pdf'
doc = fitz.open(pdf_path)

pdf_box_numbers = []

for page_num in range(len(doc)):
    page = doc[page_num]
    text = page.get_text()
    matches = re.findall(r'(?:BOX|BOX\s*NO\.?|BOX\s*#?)\s*(\d+)', text, re.IGNORECASE)
    lines = text.split('\n')
    
    print(f"\nPage {page_num + 1}: {len(lines)} lines")
    box_lines = [l for l in lines if 'BOX' in l.upper()]
    if box_lines:
        print(f"  Box lines found on page {page_num + 1}: {box_lines}")
    else:
        print(f"  No lines containing 'BOX' found on page {page_num + 1}.")
        
    for m in matches:
        pdf_box_numbers.append((int(m), page_num + 1))

print(f"\nTotal explicit 'BOX N' occurrences found in compatible-lists.pdf: {len(pdf_box_numbers)}")

# Print sample text from page 1 and page 2 of compatible-lists.pdf
for pnum in range(len(doc)):
    print(f"\n--- Page {pnum + 1} Raw Text Snippet (first 400 chars) ---")
    print(doc[pnum].get_text()[:400])

# 2. SCAN screenguards.json & seed-data.sql
print("\n--- 2. FILE: src/data/screenguards.json ---")
with open('src/data/screenguards.json', 'r', encoding='utf-8') as f:
    sg_json = json.load(f)

json_boxes = sg_json['boxes']
json_numbers = []
json_models_map = {}
for b in json_boxes:
    bnum_str = b['boxNumber']
    num_match = re.search(r'\d+', bnum_str)
    if num_match:
        num = int(num_match.group(0))
        json_numbers.append(num)
        json_models_map[num] = b['compatibleModels']

print(f"Total boxes in screenguards.json: {len(json_numbers)}")
print(f"Min Box Number in screenguards.json: BOX {min(json_numbers):02d}")
print(f"Max Box Number in screenguards.json: BOX {max(json_numbers):02d}")
print(f"Are all 1-106 present? {sorted(json_numbers) == list(range(1, 107))}")

# 3. SCAN seed-data.sql
print("\n--- 3. FILE: seed-data.sql ---")
with open('seed-data.sql', 'r', encoding='utf-8') as f:
    sql_text = f.read()

sql_box_matches = re.findall(r"BOX\s*(\d+)", sql_text, re.IGNORECASE)
sql_numbers = [int(m) for m in sql_box_matches]
print(f"Total box number references in seed-data.sql: {len(sql_numbers)}")
print(f"Max Box Number in seed-data.sql: BOX {max(sql_numbers) if sql_numbers else 0:02d}")

# 4. Check if any other PDFs or source files exist in directory
print("\n--- 4. OTHER PROJECT FILES ---")
all_files = os.listdir('.')
print("Root files:", all_files)
