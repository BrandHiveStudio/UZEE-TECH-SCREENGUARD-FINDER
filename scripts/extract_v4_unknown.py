import pandas as pd
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

v4_file = 'UZEE_TECH_SUPER_D_BOX_MAPPING_V4_CLEAN.xlsx'
df_s4 = pd.read_excel(v4_file, sheet_name='NEW COMPATIBILITY')

print(f"Total Unknown Research Groups in V4 Sheet 4: {len(df_s4)}")
print(df_s4.head(15).to_string())

# Save list of 163 groups for research analysis
groups_list = []
for idx, r in df_s4.iterrows():
    rg = r['Research Group']
    models = r['New Models']
    evidence = r['Evidence']
    groups_list.append({
        'idx': idx + 1,
        'Research Group': rg,
        'New Models': models,
        'Evidence': evidence
    })

with open('scripts/v4_unknown_groups.json', 'w', encoding='utf-8') as f:
    json.dump(groups_list, f, indent=2, ensure_ascii=False)

print("\nSaved 163 unknown groups to scripts/v4_unknown_groups.json")
