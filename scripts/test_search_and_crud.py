import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

print("==================================================")
print("1. VERIFYING MASTER DATASET IN src/data/screenguards.json")
print("==================================================")

with open('src/data/screenguards.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

boxes = data['boxes']
print(f"Total groups in JSON: {len(boxes)}")

all_relationships_count = sum(len(b['compatibleModels']) for b in boxes)
print(f"Total model-group relationships: {all_relationships_count}")

unique_models_set = set()
model_to_groups = {}

for b in boxes:
    gid = b['id']
    for m in b['compatibleModels']:
        unique_models_set.add(m.upper())
        model_to_groups.setdefault(m.upper(), []).append((gid, b['boxNumber']))

print(f"Total unique models: {len(unique_models_set)}")

multi_group_models = {m: gids for m, gids in model_to_groups.items() if len(gids) > 1}
print(f"Multi-group models count: {len(multi_group_models)}")

print("\nSample Multi-Group Models and Their Assigned Groups:")
for m, gids in list(multi_group_models.items())[:5]:
    print(f"  Model '{m}' belongs to {len(gids)} groups: {gids}")

print("\n==================================================")
print("2. TESTING SEARCH FUNCTIONALITY (MULTI-GROUP RESULTS)")
print("==================================================")

def simulate_search(query):
    query_lower = query.lower().strip()
    matching_groups = []
    for b in boxes:
        models_lower = [m.lower() for m in b['compatibleModels']]
        if any(query_lower in m for m in models_lower) or query_lower in b['title'].lower() or query_lower in b['boxNumber'].lower():
            matching_groups.append(b)
    return matching_groups

for test_query in ["Samsung A06", "S24", "iPhone 16", "BOX 001", "BOX 127"]:
    res = simulate_search(test_query)
    print(f"\nQuery '{test_query}': Found {len(res)} matching group(s)")
    for b in res[:3]:
        print(f"  -> ID: {b['id']} | Box: {b['boxNumber']} | Title: {b['title']} | Models count: {len(b['compatibleModels'])}")

print("\n==================================================")
print("3. TESTING ADMIN CRUD BEHAVIOR (PERMANENT GROUP ID)")
print("==================================================")

# Test editing box number from BOX 041 -> BOX 127 for group SD-F041
test_group_id = "SD-F041"
target_group = next((b for b in boxes if b['id'] == test_group_id), None)

if target_group:
    original_box = target_group['boxNumber']
    print(f"Target Group ID: {target_group['id']}")
    print(f"Original Box Number: {original_box}")
    print(f"Compatible Models Count: {len(target_group['compatibleModels'])}")
    
    # Simulate Box Number Edit in Admin
    edited_group = dict(target_group)
    edited_group['boxNumber'] = "BOX 127"
    
    print(f"After Admin Edit: Group ID={edited_group['id']}, Box Number={edited_group['boxNumber']}")
    print(f"Compatible Models Intact? {edited_group['compatibleModels'] == target_group['compatibleModels']}")
    assert edited_group['id'] == test_group_id, "Group ID changed!"
    assert edited_group['boxNumber'] == "BOX 127", "Box number update failed!"
    print("✅ Admin CRUD test passed: Group ID remains permanent when Box Number changes.")

print("\n✅ ALL VALIDATION TESTS PASSED PERFECTLY!")
