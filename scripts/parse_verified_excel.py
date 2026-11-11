import openpyxl
import json
import csv
import re

excel_path = r'c:\Users\lipca\Downloads\UZEE_TECH_HANDWRITTEN_LIST_VERIFIED_2026.xlsx'
wb = openpyxl.load_workbook(excel_path, data_only=True)
ws = wb['Verified Box Mapping']

# Load old seed for display sizes
with open('new_screenguard_seed.json', 'r', encoding='utf-8') as f:
    old_seed = json.load(f)
old_display_map = {item['boxNumber'].upper(): item.get('displaySize') for item in old_seed}

boxes = []

for r in range(2, ws.max_row + 1):
    box_num = ws.cell(r, 1).value
    primary = ws.cell(r, 2).value
    total_models = ws.cell(r, 3).value
    models_str = ws.cell(r, 4).value

    if not box_num:
        continue

    box_clean = str(box_num).strip().upper()
    primary_clean = str(primary).strip() if primary else ""
    models = [m.strip() for m in str(models_str).split('|') if m.strip()]

    # Extract digits for standard box id
    digits = re.sub(r'\D', '', box_clean)
    box_id = f"box-{int(digits):03d}"

    # Determine display size
    display_size = old_display_map.get(box_clean)
    if not display_size or display_size == "Unknown":
        if box_clean == "BOX 098":
            display_size = '6.4"'
        else:
            display_size = 'Unknown'

    box_obj = {
        "id": box_id,
        "groupId": box_id,
        "boxNumber": box_clean,
        "displaySize": display_size,
        "title": primary_clean,
        "compatibleModels": models,
        "stockQuantity": 0,
        "unitsSold": 0,
        "stockStatus": "NOT COUNTED",
        "stockCountVerified": False,
        "source": "Verified Handwritten Master",
        "verification": "Handwritten List Verified 2026",
        "category": "Super-D",
        "notes": None,
        "variants": {
            "super_d": 0,
            "privacy": 0,
            "matte": 0,
            "borderless": 0
        }
    }
    boxes.append(box_obj)

print(f"Parsed {len(boxes)} boxes from Verified Box Mapping.")

# Save to new_screenguard_seed.json
with open('new_screenguard_seed.json', 'w', encoding='utf-8') as f:
    json.dump(boxes, f, indent=2, ensure_ascii=False)
print("Saved new_screenguard_seed.json successfully.")

# Save to new_screenguard_seed.csv
with open('new_screenguard_seed.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow([
        "Box ID", "Box Number", "Display Size", "Title",
        "Compatible Models", "Stock Quantity", "Super-D",
        "Privacy", "Matte", "Borderless", "Category"
    ])
    for b in boxes:
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
print("Saved new_screenguard_seed.csv successfully.")

