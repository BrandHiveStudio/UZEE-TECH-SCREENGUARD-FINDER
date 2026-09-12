import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

v6_file = 'UZEE_TECH_SUPER_D_EXISTING_BOX_RECONCILIATION_V6.xlsx'
df_s2_v6 = pd.read_excel(v6_file, sheet_name='NEW UNASSIGNED GLASS')
print("Columns in V6 Sheet 2:", df_s2_v6.columns.tolist())
print(df_s2_v6.head(3).to_string())
