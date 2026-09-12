import pandas as pd
import json
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

# Load V4 Excel file
excel_v4 = 'UZEE_TECH_SUPER_D_BOX_MAPPING_V4_CLEAN.xlsx'
df_s1 = pd.read_excel(excel_v4, sheet_name='FINAL CLEAN BOX DATA')
df_s3 = pd.read_excel(excel_v4, sheet_name='ALREADY REPRESENTED')
df_s4 = pd.read_excel(excel_v4, sheet_name='NEW COMPATIBILITY')
df_s6 = pd.read_excel(excel_v4, sheet_name='CONFLICTS')

excel_cross = 'UZEE_TECH_SUPER_D_FINAL_MASTER_3AI_CROSSCHECK.xlsx'
df_fm = pd.read_excel(excel_cross, sheet_name='FINAL MASTER')
fm_dict = {r['Final Group ID']: r for idx, r in df_fm.iterrows()}

print(f"Physical Boxes count: {len(df_s1)}")
print(f"Sheet 3 (Already Represented in V4) count: {len(df_s3)}")
print(f"Sheet 4 (New Compatibility in V4) count: {len(df_s4)}")
print(f"Sheet 6 (Conflicts in V4) count: {len(df_s6)}")

# Map each physical box to its canonical model set
box_models_map = {}
all_box_models = {}
for idx, r in df_s1.iterrows():
    bnum = r['Physical Box Number']
    ms = set(m.strip() for m in str(r['Canonical Compatible Models']).split(',') if m.strip())
    box_models_map[bnum] = {
        'displaySize': r['Display Size'],
        'title': r['Title'],
        'models': ms,
        'source': r['Source']
    }
    for m in ms:
        all_box_models.setdefault(m, set()).add(bnum)

print(f"\nUnique canonical models in physical BOX 01-106: {len(all_box_models)}")

# Inspect Sheet 3 in V4 (the 13 groups)
print("\n--- 13 ALREADY REPRESENTED GROUPS IN V4 SHEET 3 ---")
for idx, r in df_s3.iterrows():
    ugroup = r['Unknown Group']
    ebox = r['Existing Box']
    mmodels = r['Matching Models']
    print(f"  {ugroup:<30} -> {ebox} (matching: {mmodels[:40]}...)")

# Now inspect all 163 groups in Sheet 4 of V4 to find any safe additions or overlaps
print("\n--- INSPECTING 163 GROUPS IN V4 SHEET 4 FOR BOX OVERLAPS ---")
overlaps_found = []
for idx, r in df_s4.iterrows():
    rg_str = r['Research Group']
    if '(' in str(rg_str):
        rg_id = str(rg_str).split('(')[0].strip()
    else:
        rg_id = str(rg_str).strip()
        
    models_raw = str(r['New Models'])
    gmodels = [m.strip() for m in models_raw.split(',') if m.strip()]
    
    matching_boxes = {}
    for m in gmodels:
        if m in all_box_models:
            for b in all_box_models[m]:
                matching_boxes.setdefault(b, []).append(m)
                
    if matching_boxes:
        best_box, matched = max(matching_boxes.items(), key=lambda x: len(x[1]))
        overlaps_found.append({
            'Research Group': rg_str,
            'Group ID': rg_id,
            'Best Box': best_box,
            'Matched Models': matched,
            'Total In Group': len(gmodels),
            'Unmatched Models': [m for m in gmodels if m not in matched]
        })

print(f"Total groups in Sheet 4 with model overlaps to physical boxes: {len(overlaps_found)}")
for item in overlaps_found[:15]:
    print(f"  {item['Research Group']:<35} -> {item['Best Box']} ({len(item['Matched Models'])}/{item['Total In Group']} matched: {item['Matched Models'][:3]}, unmatched: {item['Unmatched Models'][:3]})")
