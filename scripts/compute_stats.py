import pandas as pd
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Load screenguards.json
with open('src/data/screenguards.json', 'r', encoding='utf-8') as f:
    sg_json = json.load(f)

json_boxes = sg_json['boxes']
json_box_dict = {b['boxNumber']: b for b in json_boxes}

# Load V1 Excel sheets
excel_v1 = 'UZEE_TECH_SUPER_D_BOX_MAPPING_ANALYSIS.xlsx'
df_final = pd.read_excel(excel_v1, sheet_name='FINAL MAPPED DATA')
df_existing = pd.read_excel(excel_v1, sheet_name='EXISTING BOX MAPPING')
df_new = pd.read_excel(excel_v1, sheet_name='NEW BOX CANDIDATES')
df_conflicts = pd.read_excel(excel_v1, sheet_name='MODEL CONFLICTS')

print("--- BOX 01-106 MODEL EXPANSION ANALYSIS ---")

added_models_count = 0
models_added_by_box = {}
all_models_in_verified_boxes = set()

for idx, row in df_final.head(106).iterrows():
    bnum = row['BOX NUMBER']
    json_models = set(json_box_dict[bnum]['compatibleModels']) if bnum in json_box_dict else set()
    
    # Mapped models in V1 final sheet
    final_models_str = str(row['COMPATIBLE MODELS'])
    final_models = [m.strip() for m in final_models_str.split(',') if m.strip()]
    final_models_set = set(final_models)
    
    new_added = final_models_set - json_models
    added_models_count += len(new_added)
    if new_added:
        models_added_by_box[bnum] = list(new_added)
    
    all_models_in_verified_boxes.update(final_models_set)

print(f"Verified Physical Boxes: 106")
print(f"Total models in Verified Physical Boxes (BOX 01-106): {len(all_models_in_verified_boxes)}")
print(f"Total models added to existing physical boxes (from research): {added_models_count}")
print(f"Number of physical boxes that had models added: {len(models_added_by_box)}")
print("Sample of boxes with added models:")
for k, v in list(models_added_by_box.items())[:10]:
    print(f"  {k}: added {len(v)} models -> {v[:5]}")

print("\n--- NEW GROUPS WITH UNKNOWN BOX NUMBERS ---")
new_groups = df_final.iloc[106:].copy()
print(f"New research groups (BOX UNKNOWN): {len(new_groups)}")

all_models_in_new_groups = set()
for idx, row in new_groups.iterrows():
    m_list = [m.strip() for m in str(row['COMPATIBLE MODELS']).split(',') if m.strip()]
    all_models_in_new_groups.update(m_list)

print(f"Total unique models in new unknown box groups: {len(all_models_in_new_groups)}")

total_unique_models_master = all_models_in_verified_boxes.union(all_models_in_new_groups)
print(f"TOTAL UNIQUE MODELS ACROSS COMPLETE MASTER: {len(total_unique_models_master)}")

print(f"Model conflicts count (from V1 MODEL CONFLICTS sheet): {len(df_conflicts)}")
