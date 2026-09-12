import pandas as pd
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Load existing 106 boxes from screenguards.json
with open('src/data/screenguards.json', 'r', encoding='utf-8') as f:
    sg_json = json.load(f)

existing_boxes = sg_json['boxes']
print(f"Existing physical boxes: {len(existing_boxes)}")

# Load research master groups from UZEE_TECH_SUPER_D_FINAL_MASTER_3AI_CROSSCHECK.xlsx
fm_df = pd.read_excel('UZEE_TECH_SUPER_D_FINAL_MASTER_3AI_CROSSCHECK.xlsx', sheet_name='FINAL MASTER')
print(f"Final Master Research Groups: {len(fm_df)}")

# Load V1 analysis file sheets
v1_existing = pd.read_excel('UZEE_TECH_SUPER_D_BOX_MAPPING_ANALYSIS.xlsx', sheet_name='EXISTING BOX MAPPING')
v1_new = pd.read_excel('UZEE_TECH_SUPER_D_BOX_MAPPING_ANALYSIS.xlsx', sheet_name='NEW BOX CANDIDATES')
v1_unmapped = pd.read_excel('UZEE_TECH_SUPER_D_BOX_MAPPING_ANALYSIS.xlsx', sheet_name='UNMAPPED BOX REVIEW')
v1_conflicts = pd.read_excel('UZEE_TECH_SUPER_D_BOX_MAPPING_ANALYSIS.xlsx', sheet_name='MODEL CONFLICTS')

print("\nV1 EXISTING BOX MAPPING sample:")
print(v1_existing.head(10).to_string())

print("\nV1 NEW BOX CANDIDATES count:", len(v1_new))
print("V1 UNMAPPED BOX REVIEW count:", len(v1_unmapped))
print("V1 MODEL CONFLICTS count:", len(v1_conflicts))
