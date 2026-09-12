import pandas as pd
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Read V1 workbook
excel_v1 = 'UZEE_TECH_SUPER_D_BOX_MAPPING_ANALYSIS.xlsx'
df_final_v1 = pd.read_excel(excel_v1, sheet_name='FINAL MAPPED DATA')
df_existing_v1 = pd.read_excel(excel_v1, sheet_name='EXISTING BOX MAPPING')
df_new_v1 = pd.read_excel(excel_v1, sheet_name='NEW BOX CANDIDATES')
df_unmapped_v1 = pd.read_excel(excel_v1, sheet_name='UNMAPPED BOX REVIEW')
df_conflicts_v1 = pd.read_excel(excel_v1, sheet_name='MODEL CONFLICTS')

# Read Crosscheck workbook
excel_cross = 'UZEE_TECH_SUPER_D_FINAL_MASTER_3AI_CROSSCHECK.xlsx'
df_fm = pd.read_excel(excel_cross, sheet_name='FINAL MASTER')
df_lookup = pd.read_excel(excel_cross, sheet_name='MODEL LOOKUP')

# Map Final Group ID to Super-D Glass Group Title & Display Size if available
rg_map = {}
for idx, r in df_fm.iterrows():
    gid = r['Final Group ID']
    title = r['Super-D Glass Group']
    models = r['Compatible Models']
    source = r['Evidence Basis']
    rg_map[gid] = {
        'title': title,
        'models': models,
        'source': source
    }

print("Sample Research Group Map (from FINAL MASTER):")
for k in list(rg_map.keys())[:5]:
    print(f"  {k}: {rg_map[k]}")

# Inspect df_existing_v1
print("\n--- EXISTING BOX MAPPING V1 ---")
print(df_existing_v1.head(10).to_string())

# Inspect df_new_v1
print("\n--- NEW BOX CANDIDATES V1 ---")
print(df_new_v1.head(10).to_string())

# Inspect df_conflicts_v1
print("\n--- MODEL CONFLICTS V1 ---")
print(df_conflicts_v1.head(10).to_string())
