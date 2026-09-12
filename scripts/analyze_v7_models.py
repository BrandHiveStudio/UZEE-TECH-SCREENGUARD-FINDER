import pandas as pd
import json
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

# Load V6 workbook & 3AI Crosscheck workbook
v6_file = 'UZEE_TECH_SUPER_D_EXISTING_BOX_RECONCILIATION_V6.xlsx'
df_s2_v6 = pd.read_excel(v6_file, sheet_name='NEW UNASSIGNED GLASS')

cross_file = 'UZEE_TECH_SUPER_D_FINAL_MASTER_3AI_CROSSCHECK.xlsx'
df_fm = pd.read_excel(cross_file, sheet_name='FINAL MASTER')
df_lookup = pd.read_excel(cross_file, sheet_name='MODEL LOOKUP')
df_3ai_review = pd.read_excel(cross_file, sheet_name='REVIEW — THIRD AI')

print(f"Total rows in V6 Sheet 2 ('NEW UNASSIGNED GLASS'): {len(df_s2_v6)}")

# Extract all raw models across 163 groups
all_raw_models_s2 = []
group_model_pairs = []

for idx, r in df_s2_v6.iterrows():
    rg_id = r['Research Group ID']
    models_raw = str(r['Compatible Models'])
    ms = [m.strip() for m in models_raw.split(',') if m.strip()]
    for m in ms:
        all_raw_models_s2.append(m)
        group_model_pairs.append((rg_id, m))

print(f"Total raw model instances across 163 groups: {len(all_raw_models_s2)}")
print(f"Total unique raw model strings in 163 groups: {len(set(all_raw_models_s2))}")

# Identify malformed/incomplete model strings
incomplete_patterns = [
    r'\.\s*$',           # Trailing dot e.g. "iPhone 17 AIR 6."
    r'\(\s*$',           # Trailing open parenthesis
    r'^\s*\w+\s+\d+[\s\.]*$', # Suspicious trailing dot or single letter cut off
    r'([A-Za-z]+)\s*$',  # Very short or truncated strings
]

problematic_models = []
for rg_id, m in group_model_pairs:
    if re.search(r'\.\s*$', m) or re.search(r'\(\s*$', m) or len(m) < 4 or m.endswith(' 6.'):
        problematic_models.append((rg_id, m))

print(f"\nPotential problematic / incomplete models found: {len(problematic_models)}")
for rg_id, m in problematic_models:
    print(f"  [{rg_id}] {m}")
