import pandas as pd
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Read current screenguards.json
with open('src/data/screenguards.json', 'r', encoding='utf-8') as f:
    sg_json = json.load(f)
existing_boxes_json = sg_json['boxes']
print(f"Existing JSON boxes count: {len(existing_boxes_json)}")

# Read UZEE_TECH_SUPER_D_BOX_MAPPING_ANALYSIS.xlsx
excel_v1 = 'UZEE_TECH_SUPER_D_BOX_MAPPING_ANALYSIS.xlsx'
df_final_v1 = pd.read_excel(excel_v1, sheet_name='FINAL MAPPED DATA')
df_existing_v1 = pd.read_excel(excel_v1, sheet_name='EXISTING BOX MAPPING')
df_new_v1 = pd.read_excel(excel_v1, sheet_name='NEW BOX CANDIDATES')
df_unmapped_v1 = pd.read_excel(excel_v1, sheet_name='UNMAPPED BOX REVIEW')
df_conflicts_v1 = pd.read_excel(excel_v1, sheet_name='MODEL CONFLICTS')

print(f"FINAL MAPPED DATA rows in V1: {len(df_final_v1)}")
print(f"EXISTING BOX MAPPING rows in V1: {len(df_existing_v1)}")
print(f"NEW BOX CANDIDATES rows in V1: {len(df_new_v1)}")
print(f"UNMAPPED BOX REVIEW rows in V1: {len(df_unmapped_v1)}")
print(f"MODEL CONFLICTS rows in V1: {len(df_conflicts_v1)}")

# Read UZEE_TECH_SUPER_D_FINAL_MASTER_3AI_CROSSCHECK.xlsx
excel_master = 'UZEE_TECH_SUPER_D_FINAL_MASTER_3AI_CROSSCHECK.xlsx'
df_fm = pd.read_excel(excel_master, sheet_name='FINAL MASTER')
df_lookup = pd.read_excel(excel_master, sheet_name='MODEL LOOKUP')
print(f"\nFINAL MASTER rows in Crosscheck file: {len(df_fm)}")
print(f"MODEL LOOKUP rows in Crosscheck file: {len(df_lookup)}")

print("\n--- FIRST 5 ROWS OF FINAL MASTER in Crosscheck ---")
print(df_fm.head(5).to_string())

print("\n--- FIRST 5 ROWS OF NEW BOX CANDIDATES in V1 ---")
print(df_new_v1.head(5).to_string())
