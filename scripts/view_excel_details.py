import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

excel_file = 'UZEE_TECH_SUPER_D_BOX_MAPPING_ANALYSIS.xlsx'
xl = pd.ExcelFile(excel_file)

print("Sheet names in V1:", xl.sheet_names)

for sheet in xl.sheet_names:
    df = pd.read_excel(excel_file, sheet_name=sheet)
    print(f"\n--- SHEET: {sheet} (shape: {df.shape}) ---")
    print(df.head(10).to_string())

excel_file2 = 'UZEE_TECH_SUPER_D_FINAL_MASTER_3AI_CROSSCHECK.xlsx'
xl2 = pd.ExcelFile(excel_file2)
print("\n==========================================")
print("Sheet names in Crosscheck:", xl2.sheet_names)
for sheet in xl2.sheet_names:
    df = pd.read_excel(excel_file2, sheet_name=sheet)
    print(f"\n--- SHEET: {sheet} (shape: {df.shape}) ---")
    print(df.head(5).to_string())
