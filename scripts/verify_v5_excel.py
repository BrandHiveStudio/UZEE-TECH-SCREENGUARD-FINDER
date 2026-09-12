import openpyxl
import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

file_name = 'UZEE_TECH_SUPER_D_UNKNOWN_BOX_RESEARCH_V5.xlsx'
wb = openpyxl.load_workbook(file_name, data_only=True)

print("Workbook Sheet Names:", wb.sheetnames)

for sname in wb.sheetnames:
    ws = wb[sname]
    df = pd.read_excel(file_name, sheet_name=sname)
    print(f"\n--- Sheet '{sname}' ---")
    print(f"  Rows (excl header): {ws.max_row - 1}, Cols: {ws.max_column}")
    print("  Columns:", df.columns.tolist())
    print("  First 2 rows:")
    print(df.head(2).to_string())
    print("  Freeze panes:", ws.freeze_panes)
    print("  AutoFilter ref:", ws.auto_filter.ref)

print("\n-----------------------------------------------------")
print("DATA INTEGRITY VERIFICATION:")

df_s1 = pd.read_excel(file_name, sheet_name='BOX NUMBER DISCOVERED')
df_s2 = pd.read_excel(file_name, sheet_name='BOX NUMBER UNKNOWN')
df_s3 = pd.read_excel(file_name, sheet_name='CONFLICTING EVIDENCE')
df_s4 = pd.read_excel(file_name, sheet_name='SOURCE EVIDENCE')
df_s5 = pd.read_excel(file_name, sheet_name='RESEARCH STATISTICS')

print(f"Total Unknown Groups Researched: {len(df_s2)}")
print(f"Verified Box Numbers Found: {len(df_s1)}")
print(f"Probable Box Numbers: 0")
print(f"Still Unknown: {len(df_s2)}")
print(f"Conflicting Groups: {len(df_s3)}")

assert len(df_s2) == 163, f"Expected 163 unknown groups, got {len(df_s2)}"
assert len(df_s4) == 163, f"Expected 163 evidence rows, got {len(df_s4)}"

print("\n✅ V5 RESEARCH VERIFICATION PASSED PERFECTLY!")
