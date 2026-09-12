import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

df_fm = pd.read_excel('UZEE_TECH_SUPER_D_FINAL_MASTER_3AI_CROSSCHECK.xlsx', sheet_name='FINAL MASTER')
print("Columns in df_fm:", df_fm.columns.tolist())
print(df_fm.head(10).to_string())
