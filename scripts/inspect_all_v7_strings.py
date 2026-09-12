import pandas as pd
import json
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

v6_file = 'UZEE_TECH_SUPER_D_EXISTING_BOX_RECONCILIATION_V6.xlsx'
df_s2_v6 = pd.read_excel(v6_file, sheet_name='NEW UNASSIGNED GLASS')

factory_annotation_pattern = r'(380胶|THICK\s+GLUE|0\.25MM|玻璃[\d\.]+MM|\d+胶)'

all_models = []
annotation_matches = []
brand_abbrev_matches = []

for idx, r in df_s2_v6.iterrows():
    rg_id = r['Research Group ID']
    ms = [m.strip() for m in str(r['Compatible Models']).split(',') if m.strip()]
    for m in ms:
        all_models.append((rg_id, m))
        if re.search(factory_annotation_pattern, m, re.IGNORECASE):
            annotation_matches.append((rg_id, m))
        if re.match(r'^(SAM|RM|POC|IP|OP|VO|REAL|1\+|XM)\b', m):
            brand_abbrev_matches.append((rg_id, m))

print(f"Total model instances: {len(all_models)}")
print(f"Models with factory annotations (380胶, THICK GLUE, 0.25MM): {len(annotation_matches)}")
print(f"Models with brand abbreviations (SAM, RM, IP, OP, VO, REAL, etc.): {len(brand_abbrev_matches)}")

print("\n--- SAMPLE FACTORY ANNOTATIONS ---")
for rg, m in annotation_matches[:15]:
    print(f"  [{rg}] {m}")

print("\n--- SAMPLE BRAND ABBREVIATIONS ---")
for rg, m in brand_abbrev_matches[:15]:
    print(f"  [{rg}] {m}")
