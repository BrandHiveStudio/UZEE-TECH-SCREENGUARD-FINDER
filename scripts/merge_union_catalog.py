import json
import openpyxl
import re
from collections import OrderedDict

# 1. Load Master Retail Catalog Snapshot (148 boxes, 976 models)
master_snapshot_path = 'data/backups/db_backup_20261111_073103.json'
with open(master_snapshot_path, 'r', encoding='utf-8') as f:
    master_data = json.load(f)

master_boxes = master_data.get('boxes', [])
master_map = {b['boxNumber'].upper().strip(): b for b in master_boxes}

# 2. Load 143-box baseline snapshot (075519) to get the authoritative 143 consolidated box list
baseline_143_path = 'data/backups/db_backup_20261111_075519.json'
with open(baseline_143_path, 'r', encoding='utf-8') as f:
    baseline_143_data = json.load(f)

baseline_143_boxes = baseline_143_data.get('boxes', [])
baseline_143_box_nums = [b['boxNumber'].upper().strip() for b in baseline_143_boxes]
print(f"Authoritative consolidated baseline boxes count: {len(baseline_143_box_nums)}")

# 3. Load Verified Handwritten Excel Sheet (76 boxes)
excel_path = r'c:\Users\lipca\Downloads\UZEE_TECH_HANDWRITTEN_LIST_VERIFIED_2026.xlsx'
wb = openpyxl.load_workbook(excel_path, data_only=True)
ws = wb['Verified Box Mapping']

verified_map = {}
for r in range(2, ws.max_row + 1):
    box_num = ws.cell(r, 1).value
    primary = ws.cell(r, 2).value
    models_str = ws.cell(r, 4).value
    if not box_num:
        continue
    box_clean = str(box_num).strip().upper()
    primary_clean = str(primary).strip() if primary else ""
    models = [m.strip() for m in str(models_str).split('|') if m.strip()]
    verified_map[box_clean] = {
        'boxNumber': box_clean,
        'primary': primary_clean,
        'models': models
    }

print(f"Loaded {len(verified_map)} verified boxes from handwritten sheet.")

# 4. Perform Intelligent Union Merge for the 143 consolidated boxes
merged_boxes = []

for box_num in baseline_143_box_nums:
    master_b = master_map.get(box_num)
    verified_b = verified_map.get(box_num)

    digits = re.findall(r'\d+', box_num)
    num_digits = digits[0] if digits else "0"
    std_id = f"box-{int(num_digits):03d}"

    # Determine Title
    if verified_b and verified_b['primary']:
        title = verified_b['primary']
    elif master_b and master_b.get('title'):
        title = master_b['title']
    else:
        title = f"Screen Guard {box_num}"

    # Determine Display Size
    display_size = "Unknown"
    if master_b and master_b.get('displaySize') and master_b['displaySize'] != "Unknown":
        display_size = master_b['displaySize']
    if box_num == "BOX 098":
        display_size = '6.4"'

    # Union Models: Verified first, then Master retail models
    seen_lower = set()
    unified_models = []

    def add_model(m):
        m_clean = m.strip()
        if m_clean and m_clean.lower() not in seen_lower:
            seen_lower.add(m_clean.lower())
            unified_models.append(m_clean)

    # Add verified models
    if verified_b:
        for m in verified_b['models']:
            add_model(m)

    # Add master retail models
    if master_b:
        m_models = master_b.get('compatibleModels', [])
        if isinstance(m_models, str):
            m_models = [x.strip() for x in m_models.split('|') if x.strip()]
        for m in m_models:
            add_model(m)

    # Special rules per user prompt:
    # 1. BOX 048: Specifically ensure Samsung Galaxy A05, Samsung Galaxy A05s, A05, A05s
    if box_num == "BOX 048":
        for req in ["Samsung Galaxy A05", "Samsung Galaxy A05s", "A05", "A05s"]:
            add_model(req)

    # 2. BOX 029: Google Pixel 9a
    if box_num == "BOX 029":
        title = "Google Pixel 9a"
        if "google pixel 9a" not in seen_lower:
            seen_lower.add("google pixel 9a")
            unified_models.insert(0, "Google Pixel 9a")

    # 3. BOX 085: Google Pixel 6 redirected here
    if box_num == "BOX 085":
        add_model("Google Pixel 6")

    # 4. BOX 098: OPPO F17
    if box_num == "BOX 098":
        title = "OPPO F17"
        display_size = '6.4"'
        if "oppo f17" not in seen_lower:
            seen_lower.add("oppo f17")
            unified_models.insert(0, "OPPO F17")

    category = (master_b and master_b.get('category')) or "Super-D"
    notes = (master_b and master_b.get('notes')) or None

    box_item = {
        "id": std_id,
        "groupId": std_id,
        "boxNumber": box_num,
        "displaySize": display_size,
        "title": title,
        "compatibleModels": unified_models,
        "stockQuantity": 0,
        "unitsSold": 0,
        "stockStatus": "NOT COUNTED",
        "stockCountVerified": False,
        "source": "Intelligent Union Master 2026",
        "verification": "Handwritten Audit & Master Retail Union",
        "category": category,
        "notes": notes,
        "variants": {
            "super_d": 0,
            "privacy": 0,
            "matte": 0,
            "borderless": 0
        }
    }
    merged_boxes.append(box_item)

# Ensure Google Pixel 6 is only in BOX 085 (remove from other boxes if present)
for b in merged_boxes:
    if b["boxNumber"] != "BOX 085":
        b["compatibleModels"] = [m for m in b["compatibleModels"] if m.lower() != "google pixel 6"]

print(f"Total merged boxes: {len(merged_boxes)}")
total_models = sum(len(b['compatibleModels']) for b in merged_boxes)
print(f"Total unified models: {total_models}")

# Print key verification items
for b in merged_boxes:
    if b["boxNumber"] in ["BOX 001", "BOX 002", "BOX 020", "BOX 024", "BOX 029", "BOX 048", "BOX 085", "BOX 098"]:
        print(f"\n{b['boxNumber']} ({b['title']}, {b['displaySize']}): {len(b['compatibleModels'])} models")
        print(f"  First 8: {b['compatibleModels'][:8]}")

# Write to files
with open('new_screenguard_seed.json', 'w', encoding='utf-8') as f:
    json.dump(merged_boxes, f, indent=2, ensure_ascii=False)
print("\n✓ Written to new_screenguard_seed.json")

import csv
with open('new_screenguard_seed.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow([
        "Box ID", "Box Number", "Display Size", "Title",
        "Compatible Models", "Stock Quantity", "Super-D",
        "Privacy", "Matte", "Borderless", "Category"
    ])
    for b in merged_boxes:
        writer.writerow([
            b["id"],
            b["boxNumber"],
            b["displaySize"],
            b["title"],
            " | ".join(b["compatibleModels"]),
            b["stockQuantity"],
            b["variants"]["super_d"],
            b["variants"]["privacy"],
            b["variants"]["matte"],
            b["variants"]["borderless"],
            b["category"]
        ])
print("✓ Written to new_screenguard_seed.csv")

# Also write to src/data/screenguards.json
with open('src/data/screenguards.json', 'w', encoding='utf-8') as f:
    json.dump({"boxes": merged_boxes}, f, indent=2, ensure_ascii=False)
print("✓ Written to src/data/screenguards.json")
