import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

excel_v3 = 'UZEE_TECH_SUPER_D_BOX_MAPPING_V3_CLEAN.xlsx'
df_s1 = pd.read_excel(excel_v3, sheet_name='FINAL CLEAN BOX DATA')

b66 = df_s1[df_s1['Physical Box Number'] == 'BOX 66'].iloc[0]
b82 = df_s1[df_s1['Physical Box Number'] == 'BOX 82'].iloc[0]

print("=== BOX 66 models in V3 ===")
ms66 = [m.strip() for m in str(b66['Canonical Compatible Models']).split(',') if m.strip()]
print(f"Total models in BOX 66: {len(ms66)}")
print(ms66)

print("\n=== BOX 82 models in V3 ===")
ms82 = [m.strip() for m in str(b82['Canonical Compatible Models']).split(',') if m.strip()]
print(f"Total models in BOX 82: {len(ms82)}")
print(ms82)
