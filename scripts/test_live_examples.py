import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Test models requested in prompt Section 19
test_models = [
    "iPhone 6",
    "iPhone 13",
    "Pixel 8",
    "Samsung A34 5G",
    "Samsung A06",
    "Redmi Note 10",
    "OPPO A57",
    "OnePlus 9RT",
    "Tecno Pova 5 Pro",
    "Honor X8"
]

print("=" * 70)
print("FINAL LIVE TEST — 130-BOX PHYSICAL INVENTORY LOOKUP")
print("=" * 70)

# Load local JSON dataset to verify matching box numbers
with open('src/data/screenguards.json', encoding='utf-8') as f:
    screenguards = json.load(f)

boxes = screenguards['boxes']

for search_query in test_models:
    query_lower = search_query.lower()
    matched_boxes = []
    
    for box in boxes:
        for m in box['compatibleModels']:
            if query_lower in m.lower() or m.lower() in query_lower:
                if box['boxNumber'] not in matched_boxes:
                    matched_boxes.append(box['boxNumber'])
                    
    print(f"Model Query: {search_query:<22} → Matched Box(es): {', '.join(matched_boxes) if matched_boxes else 'NOT FOUND'}")

print("=" * 70)
