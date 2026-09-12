import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

f1 = 'UZEE_TECH_SUPER_D_BOX_MAPPING_ANALYSIS.xlsx'
xl1 = pd.ExcelFile(f1)

for s in xl1.sheet_names:
    df = pd.read_excel(f1, sheet_name=s)
    print(f"=== Sheet: {s} ===")
    print("Columns:", df.columns.tolist())
    print("Shape:", df.shape)
    if 'BOX NUMBER' in df.columns:
        print("Box numbers sample:", df['BOX NUMBER'].dropna().unique()[:20])
    print(df.head(3).to_string())
    print("\n")
