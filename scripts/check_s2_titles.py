import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

df_s2 = pd.read_excel('UZEE_TECH_SUPER_D_BOX_MAPPING_ANALYSIS_V2.xlsx', sheet_name='NEW GROUPS — BOX UNKNOWN')
print(df_s2[['Research Group ID', 'Title', 'Display Size']].head(15).to_string())
