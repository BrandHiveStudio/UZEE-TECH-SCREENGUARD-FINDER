import pandas as pd
import json
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

# Read V2 workbook
excel_v2 = 'UZEE_TECH_SUPER_D_BOX_MAPPING_ANALYSIS_V2.xlsx'
df_s1 = pd.read_excel(excel_v2, sheet_name='VERIFIED EXISTING BOXES')
df_s2 = pd.read_excel(excel_v2, sheet_name='NEW GROUPS — BOX UNKNOWN')

# Extract all raw model strings
raw_models_s1 = []
box_model_pairs_s1 = []
for idx, r in df_s1.iterrows():
    bnum = r['Physical Box Number']
    ms = [m.strip() for m in str(r['Compatible Models']).split(',') if m.strip()]
    for m in ms:
        raw_models_s1.append(m)
        box_model_pairs_s1.append((bnum, m))

raw_models_s2 = []
group_model_pairs_s2 = []
for idx, r in df_s2.iterrows():
    gid = r['Research Group ID']
    ms = [m.strip() for m in str(r['Compatible Models']).split(',') if m.strip()]
    for m in ms:
        raw_models_s2.append(m)
        group_model_pairs_s2.append((gid, m))

all_raw_models = set(raw_models_s1).union(set(raw_models_s2))
print(f"Total raw model string instances in S1 (Verified Boxes): {len(raw_models_s1)}")
print(f"Unique model strings in S1: {len(set(raw_models_s1))}")
print(f"Total raw model string instances in S2 (Unknown Groups): {len(raw_models_s2)}")
print(f"Unique model strings in S2: {len(set(raw_models_s2))}")
print(f"TOTAL EXACT-STRING UNIQUE MODELS (S1 ∪ S2): {len(all_raw_models)}")

# Save list of all 1,964 raw model strings for normalization analysis
with open('scripts/all_raw_models.json', 'w', encoding='utf-8') as f:
    json.dump(sorted(list(all_raw_models)), f, indent=2, ensure_ascii=False)

print("Saved all 1,964 raw model strings to scripts/all_raw_models.json")
