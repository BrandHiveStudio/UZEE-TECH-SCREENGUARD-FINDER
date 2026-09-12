import openpyxl
import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

file_name = 'UZEE_TECH_SUPER_D_BOX_MAPPING_V4_CLEAN.xlsx'
wb = openpyxl.load_workbook(file_name, data_only=True)

df_s1 = pd.read_excel(file_name, sheet_name='FINAL CLEAN BOX DATA')
df_s2 = pd.read_excel(file_name, sheet_name='MODEL LOOKUP')
df_s3 = pd.read_excel(file_name, sheet_name='ALREADY REPRESENTED')
df_s4 = pd.read_excel(file_name, sheet_name='NEW COMPATIBILITY')
df_s5 = pd.read_excel(file_name, sheet_name='MODEL MULTI-BOX REVIEW')
df_s6 = pd.read_excel(file_name, sheet_name='CONFLICTS')

# 1. Physical Box Count
physical_boxes = len(df_s1)
assert physical_boxes == 106, f"Expected 106 physical boxes, got {physical_boxes}"

# 2. Total Relationships in S1 & S2
relationships_s1 = sum(len([m.strip() for m in str(row['Canonical Compatible Models']).split(',') if m.strip()]) for idx, row in df_s1.iterrows())
relationships_s2 = len(df_s2)
assert relationships_s1 == 1439, f"Expected 1439 relationships in S1, got {relationships_s1}"
assert relationships_s2 == 1439, f"Expected 1439 relationships in S2, got {relationships_s2}"

# 3. Canonical Unique Models
canonical_unique_models = df_s2['Canonical Model'].nunique()
assert canonical_unique_models <= 935, f"Expected <= 935 canonical models, got {canonical_unique_models}"

# 4. Zero duplicate canonical models within the same physical box
internal_duplicates_found = 0
for idx, row in df_s1.iterrows():
    bnum = row['Physical Box Number']
    ms = [m.strip().upper() for m in str(row['Canonical Compatible Models']).split(',') if m.strip()]
    if len(ms) != len(set(ms)):
        print(f"❌ Internal duplicate found in {bnum}: {[m for m in ms if ms.count(m) > 1]}")
        internal_duplicates_found += 1

assert internal_duplicates_found == 0, "Internal duplicates found in boxes!"

# 5. Exact match between MODEL LOOKUP and FINAL CLEAN BOX DATA
s1_pairs = set()
for idx, row in df_s1.iterrows():
    bnum = row['Physical Box Number']
    ms = [m.strip() for m in str(row['Canonical Compatible Models']).split(',') if m.strip()]
    for m in ms:
        s1_pairs.add((bnum, m))

s2_pairs = set((row['Physical Box Number'], row['Canonical Model']) for idx, row in df_s2.iterrows())

assert s1_pairs == s2_pairs, "MODEL LOOKUP does not match FINAL CLEAN BOX DATA!"

print("✅ VERIFICATION PASSED PERFECTLY!")
print(f"- Physical boxes: {physical_boxes}")
print(f"- Model-to-box relationships: {relationships_s1}")
print(f"- Canonical unique models in physical boxes: {canonical_unique_models}")
print(f"- Zero duplicate canonical models within the same physical box: PASSED ({internal_duplicates_found} duplicates)")
print(f"- MODEL LOOKUP matches FINAL CLEAN BOX DATA exactly: PASSED")
