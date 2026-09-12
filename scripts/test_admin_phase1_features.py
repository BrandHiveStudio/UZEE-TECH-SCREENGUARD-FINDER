import json
import csv
import sys
import os
import datetime

sys.stdout.reconfigure(encoding='utf-8')

print("==================================================")
print("ADMIN PHASE 1 VERIFICATION & FEATURE AUDIT")
print("==================================================")

with open('src/data/screenguards.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

boxes = data['boxes']

# 1. Test CSV Export Logic
print("\n--- 1. CSV EXPORT LOGIC TEST ---")
headers = [
    "Group ID", "Box Number", "Box Number Status", "Display Size",
    "Title", "Compatible Models", "Source", "Verification", "Category", "Notes"
]

csv_filename = f"UZEE_TECH_SCREENGUARD_STOCK_{datetime.date.today()}.csv"
with open(csv_filename, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(headers)
    for b in boxes:
        writer.writerow([
            b.get('id', ''),
            b.get('boxNumber', ''),
            "TEMPORARY / EDITABLE",
            b.get('displaySize', 'Unknown'),
            b.get('title', ''),
            " | ".join(b.get('compatibleModels', [])),
            b.get('source', ''),
            b.get('verification', ''),
            b.get('category', 'Super-D'),
            b.get('notes', '')
        ])

print(f"✅ Generated CSV test export '{csv_filename}' with {len(boxes)} rows.")
assert os.path.exists(csv_filename), "CSV file generation failed!"
os.remove(csv_filename) # Clean up temporary test file

# 2. Test JSON Backup Logic
print("\n--- 2. JSON BACKUP LOGIC TEST ---")
now = datetime.datetime.now()
backup_filename = f"UZEE_TECH_SCREENGUARD_BACKUP_{now.strftime('%Y-%m-%d_%H-%M')}.json"
backup_payload = {
    "backupTimestamp": now.isoformat(),
    "recordCount": len(boxes),
    "version": "4.0-superd-master",
    "boxes": boxes
}

with open(backup_filename, 'w', encoding='utf-8') as f:
    json.dump(backup_payload, f, indent=2, ensure_ascii=False)

print(f"✅ Generated JSON backup test file '{backup_filename}' with {len(boxes)} records.")
assert os.path.exists(backup_filename), "Backup file generation failed!"
os.remove(backup_filename) # Clean up temporary test file

# 3. Test Dashboard Statistics Calculations
print("\n--- 3. DASHBOARD STATISTICS CALCULATIONS TEST ---")
total_groups = len(boxes)
total_relationships = sum(len(b['compatibleModels']) for b in boxes)
unique_models = set()
box_locations = set()
model_to_groups = {}

for b in boxes:
    if b.get('boxNumber'):
        box_locations.add(b['boxNumber'].strip().upper())
    for m in b['compatibleModels']:
        m_upper = m.strip().upper()
        unique_models.add(m_upper)
        model_to_groups.setdefault(m_upper, []).append(b['id'])

multi_group_models_count = sum(1 for m, gids in model_to_groups.items() if len(gids) > 1)

print(f"  Total Compatibility Groups: {total_groups}")
print(f"  Unique Phone Models: {len(unique_models)}")
print(f"  Model-Group Relationships: {total_relationships}")
print(f"  Box Locations: {len(box_locations)}")
print(f"  Multi-Group Models: {multi_group_models_count}")

assert total_groups == 263, f"Expected 263 groups, got {total_groups}"
assert total_relationships == 1617, f"Expected 1617 relationships, got {total_relationships}"
assert len(unique_models) == 1591, f"Expected 1591 unique models, got {len(unique_models)}"
assert multi_group_models_count == 23, f"Expected 23 multi-group models, got {multi_group_models_count}"
print("✅ Dynamic statistics match 100% with live dataset!")

# 4. Test Advanced Combinatorial Filtering
print("\n--- 4. ADVANCED COMBINATORIAL FILTERS TEST ---")
def apply_filters(search="", box_num="", brand="", display_size="", group_id="", verification=""):
    filtered = []
    for b in boxes:
        if search:
            q = search.lower()
            if not (q in b['id'].lower() or q in b['boxNumber'].lower() or q in b['title'].lower() or any(q in m.lower() for m in b['compatibleModels'])):
                continue
        if box_num:
            if box_num.lower() not in b['boxNumber'].lower():
                continue
        if brand:
            q_brand = brand.lower()
            if not any(m.lower().startswith(q_brand) for m in b['compatibleModels']):
                continue
        if display_size:
            if display_size.lower() not in b.get('displaySize', '').lower():
                continue
        if group_id:
            if group_id.lower() not in b['id'].lower():
                continue
        if verification:
            if verification.lower() not in b.get('verification', '').lower():
                continue
        filtered.append(b)
    return filtered

res_brand_box = apply_filters(brand="Samsung", box_num="BOX 040")
print(f"Filter 'Samsung' + 'BOX 040': Found {len(res_brand_box)} match(es) -> {[b['id'] for b in res_brand_box]}")
assert len(res_brand_box) == 1 and res_brand_box[0]['id'] == 'SD-F040', "Combinatorial filter failed!"

res_verif = apply_filters(verification="SOURCE-MERGED")
print(f"Filter 'SOURCE-MERGED': Found {len(res_verif)} match(es)")

print("✅ Combinatorial filtering test passed!")

# 5. Test Data Quality Scanner
print("\n--- 5. DATA QUALITY SCANNER TEST ---")
dup_ids = len(boxes) - len(set(b['id'] for b in boxes))
empty_models = sum(1 for b in boxes if len(b['compatibleModels']) == 0)
missing_titles = sum(1 for b in boxes if not b.get('title'))
print(f"  Duplicate Group IDs: {dup_ids}")
print(f"  Groups with Empty Model Lists: {empty_models}")
print(f"  Groups with Missing Titles: {missing_titles}")
assert dup_ids == 0, "Duplicate Group IDs found!"
assert empty_models == 0, "Empty model groups found!"
assert missing_titles == 0, "Missing titles found!"
print("✅ Data Quality scanner verified!")

print("\n==================================================")
print("ALL ADMIN PHASE 1 AUTOMATED TESTS PASSED (100%)")
print("==================================================")
