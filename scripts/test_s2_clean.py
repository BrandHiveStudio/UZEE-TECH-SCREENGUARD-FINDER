import pandas as pd
import json
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

# Read V1 workbook
excel_v1 = 'UZEE_TECH_SUPER_D_BOX_MAPPING_ANALYSIS.xlsx'
df_final_v1 = pd.read_excel(excel_v1, sheet_name='FINAL MAPPED DATA')
df_new_v1 = pd.read_excel(excel_v1, sheet_name='NEW BOX CANDIDATES')

# Read Crosscheck Final Master
excel_cross = 'UZEE_TECH_SUPER_D_FINAL_MASTER_3AI_CROSSCHECK.xlsx'
df_fm = pd.read_excel(excel_cross, sheet_name='FINAL MASTER')
fm_dict = {r['Final Group ID']: r for idx, r in df_fm.iterrows()}

def extract_size(text):
    match = re.search(r'(\d+\.\d+)["\s]', text)
    if match:
        return f'{match.group(1)}"'
    match2 = re.search(r'(\d+\.\d+)$', text)
    if match2:
        return f'{match2.group(1)}"'
    return 'Unknown'

new_groups_sample = []

for idx in range(106, len(df_final_v1)):
    row_final = df_final_v1.iloc[idx]
    row_new = df_new_v1.iloc[idx - 106]
    
    rg_raw = row_new['Research SD Group']
    if '(' in str(rg_raw):
        rg_id = str(rg_raw).split('(')[0].strip()
    else:
        rg_id = str(rg_raw).strip()
        
    fm_info = fm_dict.get(rg_id, {})
    clean_title = fm_info.get('Super-D Glass Group')
    if not clean_title or pd.isna(clean_title):
        clean_title = str(row_final['TITLE']).replace('NEW GROUP: ', '').split(' (')[0].strip()
        
    dsize_orig = row_final['DISPLAY SIZE']
    if pd.notna(dsize_orig) and str(dsize_orig).strip() != 'Unknown':
        dsize = str(dsize_orig).strip()
    else:
        dsize = extract_size(str(clean_title))
        if dsize == 'Unknown':
            dsize = extract_size(str(row_final['COMPATIBLE MODELS']))
            
    new_groups_sample.append({
        'Research Group ID': rg_id,
        'Clean Title': clean_title,
        'Display Size': dsize
    })

df_sample = pd.DataFrame(new_groups_sample)
print(df_sample.head(20).to_string())
