import pandas as pd
import json
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

# Load V4 workbook & 3AI Crosscheck master
v4_file = 'UZEE_TECH_SUPER_D_BOX_MAPPING_V4_CLEAN.xlsx'
df_s1 = pd.read_excel(v4_file, sheet_name='FINAL CLEAN BOX DATA')
df_s4 = pd.read_excel(v4_file, sheet_name='NEW COMPATIBILITY')

excel_cross = 'UZEE_TECH_SUPER_D_FINAL_MASTER_3AI_CROSSCHECK.xlsx'
df_fm = pd.read_excel(excel_cross, sheet_name='FINAL MASTER')
df_lookup = pd.read_excel(excel_cross, sheet_name='MODEL LOOKUP')

# Map each canonical model in physical boxes to its physical box number
box_models_map = {}
model_to_box = {}
for idx, r in df_s1.iterrows():
    bnum = r['Physical Box Number']
    ms = [m.strip() for m in str(r['Canonical Compatible Models']).split(',') if m.strip()]
    box_models_map[bnum] = ms
    for m in ms:
        model_to_box[m.upper()] = bnum

print(f"Total model-to-box pairs in physical BOX 01-106: {len(model_to_box)}")

# Check df_fm (FINAL MASTER) to see if any group in df_fm has some models in BOX 01-106 and some models in df_s4
group_box_matches = []
for idx, r in df_fm.iterrows():
    gid = r['Final Group ID']
    title = r['Super-D Glass Group']
    models_str = str(r['Compatible Models'])
    gmodels = [m.strip() for m in models_str.split(',') if m.strip()]
    
    # Check which models are in physical boxes
    in_boxes = {}
    new_models = []
    for m in gmodels:
        m_upper = m.upper()
        if m_upper in model_to_box:
            bnum = model_to_box[m_upper]
            in_boxes.setdefault(bnum, []).append(m)
        else:
            new_models.append(m)
            
    if in_boxes and new_models:
        best_box, matched_models = max(in_boxes.items(), key=lambda x: len(x[1]))
        group_box_matches.append({
            'Final Group ID': gid,
            'Super-D Group Title': title,
            'Target Box': best_box,
            'Matched Physical Models': matched_models,
            'New Candidate Models': new_models,
            'Evidence Basis': r['Evidence Basis']
        })

print(f"\nTotal research groups in 3AI Master that combine physical box models with new candidate models: {len(group_box_matches)}")

print("\n--- SAMPLE SAFE ADDITIONS CANDIDATES ---")
for item in group_box_matches[:20]:
    print(f"  Group {item['Final Group ID']} ({item['Super-D Group Title']:<25}) -> {item['Target Box']}")
    print(f"     Matched in Box: {item['Matched Physical Models']}")
    print(f"     New Additions:  {item['New Candidate Models']}")
    print(f"     Evidence Basis: {item['Evidence Basis']}\n")
