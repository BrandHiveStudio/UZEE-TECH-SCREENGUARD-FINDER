import pandas as pd
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 1. Load screenguards.json
with open('src/data/screenguards.json', 'r', encoding='utf-8') as f:
    sg_json = json.load(f)

json_boxes = sg_json['boxes']
print(f"Total boxes in screenguards.json: {len(json_boxes)}")

# Build map of existing box models
existing_box_map = {}
existing_models_set = set()
for b in json_boxes:
    bnum = b['boxNumber']
    models = b['compatibleModels']
    existing_box_map[bnum] = {
        'displaySize': b.get('displaySize', ''),
        'title': b.get('title', ''),
        'rawText': b.get('rawText', ''),
        'models': list(models)
    }
    for m in models:
        existing_models_set.add(m)

print(f"Total unique models in existing 106 boxes: {len(existing_models_set)}")

# 2. Load V1 sheet 'NEW BOX CANDIDATES' & 'FINAL MAPPED DATA' & 'EXISTING BOX MAPPING'
excel_v1 = 'UZEE_TECH_SUPER_D_BOX_MAPPING_ANALYSIS.xlsx'
df_final = pd.read_excel(excel_v1, sheet_name='FINAL MAPPED DATA')
df_existing = pd.read_excel(excel_v1, sheet_name='EXISTING BOX MAPPING')
df_new = pd.read_excel(excel_v1, sheet_name='NEW BOX CANDIDATES')
df_conflicts = pd.read_excel(excel_v1, sheet_name='MODEL CONFLICTS')

print(f"\nFinal mapped data in V1 has {len(df_final)} rows.")
print("V1 df_final columns:", df_final.columns.tolist())
print("V1 df_existing columns:", df_existing.columns.tolist())
print("V1 df_new columns:", df_new.columns.tolist())
print("V1 df_conflicts columns:", df_conflicts.columns.tolist())

# Check how V1 mapped existing boxes vs new candidates
existing_in_final = df_final[df_final['BOX NUMBER'].astype(str).str.startswith('BOX ') & (df_final['BOX NUMBER'].astype(str).apply(lambda x: int(x.replace('BOX ', '')) <= 106 if x.replace('BOX ', '').isdigit() else False))]
print(f"\nRows in V1 FINAL MAPPED DATA matching BOX 01-106: {len(existing_in_final)}")

new_in_final = df_final[~df_final.index.isin(existing_in_final.index)]
print(f"Rows in V1 FINAL MAPPED DATA matching BOX 107+: {len(new_in_final)}")

# Look at df_fm in crosscheck file
excel_cross = 'UZEE_TECH_SUPER_D_FINAL_MASTER_3AI_CROSSCHECK.xlsx'
df_fm = pd.read_excel(excel_cross, sheet_name='FINAL MASTER')
print(f"\nCrosscheck FINAL MASTER has {len(df_fm)} rows.")
print("Crosscheck df_fm columns:", df_fm.columns.tolist())
