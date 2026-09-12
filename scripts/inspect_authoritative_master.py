import openpyxl
import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

auth_file = 'UZEE_TECH_SUPER_D_AUTHORITATIVE_MASTER.xlsx'
wb = openpyxl.load_workbook(auth_file, data_only=True)

print("Authoritative Workbook Sheet Names:", wb.sheetnames)

for sname in wb.sheetnames:
    ws = wb[sname]
    df = pd.read_excel(auth_file, sheet_name=sname)
    print(f"\n--- Sheet '{sname}' ---")
    print(f"  Rows (excl header): {len(df)}, Cols: {len(df.columns)}")
    print("  Columns:", df.columns.tolist())
    print("  First 2 rows:")
    print(df.head(2).to_string())

# Load current production screenguards.json & seed-data.sql
json_file = 'src/data/screenguards.json'
df_prod_json = pd.read_json(json_file)
print(f"\nCurrent Production JSON Box Count: {len(df_prod_json)}")
