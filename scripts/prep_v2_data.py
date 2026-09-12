import pandas as pd
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 1. Load screenguards.json
with open('src/data/screenguards.json', 'r', encoding='utf-8') as f:
    sg_json = json.load(f)

json_boxes = sg_json['boxes']
json_box_dict = {b['boxNumber']: b for b in json_boxes}

# 2. Load V1 Excel sheets
excel_v1 = 'UZEE_TECH_SUPER_D_BOX_MAPPING_ANALYSIS.xlsx'
df_final_v1 = pd.read_excel(excel_v1, sheet_name='FINAL MAPPED DATA')
df_existing_v1 = pd.read_excel(excel_v1, sheet_name='EXISTING BOX MAPPING')
df_new_v1 = pd.read_excel(excel_v1, sheet_name='NEW BOX CANDIDATES')
df_conflicts_v1 = pd.read_excel(excel_v1, sheet_name='MODEL CONFLICTS')

# Load Crosscheck Final Master
excel_cross = 'UZEE_TECH_SUPER_D_FINAL_MASTER_3AI_CROSSCHECK.xlsx'
df_fm = pd.read_excel(excel_cross, sheet_name='FINAL MASTER')
fm_dict = {r['Final Group ID']: r for idx, r in df_fm.iterrows()}

print(f"Total existing boxes in DB: {len(json_boxes)}")
print(f"Total rows in V1 final mapped data: {len(df_final_v1)}")

# Separate Verified Existing Boxes (BOX 01 to BOX 106) vs New Unknown Groups
verified_boxes_list = []
models_added_count = 0
all_models_in_verified = set()
original_db_models_set = set()

for b in json_boxes:
    for m in b['compatibleModels']:
        original_db_models_set.add(m.strip())

# Match df_existing_v1 & df_final_v1 for BOX 01 to BOX 106
for idx in range(106):
    row_final = df_final_v1.iloc[idx]
    row_exist = df_existing_v1.iloc[idx]
    
    bnum = row_final['BOX NUMBER']
    json_b = json_box_dict.get(bnum, {})
    
    # Research group match
    matched_rg = row_exist['Matched New SD Group']
    rg_id = matched_rg.split(' ')[0] if pd.notna(matched_rg) else 'N/A'
    
    dsize = row_final['DISPLAY SIZE']
    title = row_final['TITLE']
    
    # Models in V1 final mapping (expanded)
    final_models_raw = str(row_final['COMPATIBLE MODELS'])
    final_models = [m.strip() for m in final_models_raw.split(',') if m.strip()]
    
    json_models = [m.strip() for m in json_b.get('compatibleModels', [])]
    new_added = set(final_models) - set(json_models)
    models_added_count += len(new_added)
    
    for m in final_models:
        all_models_in_verified.add(m)
        
    verified_boxes_list.append({
        'Physical Box Number': bnum,
        'Research Group ID': rg_id,
        'Display Size': dsize,
        'Title': title,
        'Compatible Models': ", ".join(final_models),
        'Source': 'UZEE TECH Store Inventory + Mietubl Research Cross-Check',
        'Verification': 'Verified (Physical Box Active)'
    })

print(f"\n1. Verified Physical Boxes: {len(verified_boxes_list)}")
print(f"   Original models in existing DB: {len(original_db_models_set)}")
print(f"   Expanded unique models in Verified Boxes: {len(all_models_in_verified)}")
print(f"   Models added to existing boxes: {models_added_count}")

# Build Sheet 2: NEW GROUPS — BOX UNKNOWN
new_groups_list = []
all_models_in_new_groups = set()

for idx in range(106, len(df_final_v1)):
    row_final = df_final_v1.iloc[idx]
    row_new = df_new_v1.iloc[idx - 106]
    
    rg_raw = row_new['Research SD Group']
    # Extract Group ID e.g. SD-F001 from "SD-F001 (iPhone 6)"
    if '(' in str(rg_raw):
        rg_id = str(rg_raw).split('(')[0].strip()
    else:
        rg_id = str(rg_raw).strip()
        
    title = row_final['TITLE']
    dsize = row_final['DISPLAY SIZE']
    
    models_raw = str(row_final['COMPATIBLE MODELS'])
    models = [m.strip() for m in models_raw.split(',') if m.strip()]
    for m in models:
        all_models_in_new_groups.add(m)
        
    evidence = row_new['Evidence'] if pd.notna(row_new['Evidence']) else 'Mietubl Research Group'
    
    new_groups_list.append({
        'Research Group ID': rg_id,
        'Compatible Models': ", ".join(models),
        'Display Size': dsize if pd.notna(dsize) else 'Unknown',
        'Title': title if pd.notna(title) else 'Unknown',
        'Sources': evidence,
        'Verification': 'BOX NUMBER REQUIRED',
        'Reason Box Number Is Unknown': 'No physical UZEE TECH box number assigned yet in store inventory / requires physical stock verification'
    })

print(f"\n2. New Groups (Box Unknown): {len(new_groups_list)}")
print(f"   Unique models in New Unknown Box Groups: {len(all_models_in_new_groups)}")

# Build Sheet 3: MODEL CONFLICTS
conflicts_list = []
for idx, r in df_conflicts_v1.iterrows():
    m = r['Phone Model']
    ebox = r['Existing Box']
    ngroup = r['New Research Box/Group']
    conflict = r['Conflict']
    rec = r['Recommended Action']
    
    conflicts_list.append({
        'Model': m,
        'Existing Box': ebox,
        'New Research Group': ngroup,
        'Evidence': conflict,
        'Resolution Required': rec
    })

print(f"\n3. Model Conflicts: {len(conflicts_list)}")

# Total unique models across complete master
total_master_unique_models = all_models_in_verified.union(all_models_in_new_groups)
print(f"\n4. TOTAL UNIQUE MODELS ACROSS COMPLETE MASTER: {len(total_master_unique_models)}")
