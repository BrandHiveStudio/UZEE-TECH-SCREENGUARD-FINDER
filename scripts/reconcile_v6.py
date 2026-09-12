import pandas as pd
import json
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

# Load V4 & V5 files
v4_file = 'UZEE_TECH_SUPER_D_BOX_MAPPING_V4_CLEAN.xlsx'
df_s1_v4 = pd.read_excel(v4_file, sheet_name='FINAL CLEAN BOX DATA')
df_s2_v4 = pd.read_excel(v4_file, sheet_name='MODEL LOOKUP')
df_s3_v4 = pd.read_excel(v4_file, sheet_name='ALREADY REPRESENTED')
df_s4_v4 = pd.read_excel(v4_file, sheet_name='NEW COMPATIBILITY')

v5_file = 'UZEE_TECH_SUPER_D_UNKNOWN_BOX_RESEARCH_V5.xlsx'
df_s2_v5 = pd.read_excel(v5_file, sheet_name='BOX NUMBER UNKNOWN')

excel_cross = 'UZEE_TECH_SUPER_D_FINAL_MASTER_3AI_CROSSCHECK.xlsx'
df_fm = pd.read_excel(excel_cross, sheet_name='FINAL MASTER')
fm_dict = {r['Final Group ID']: r for idx, r in df_fm.iterrows()}

print(f"Total physical boxes in V4: {len(df_s1_v4)}")
print(f"Total unknown groups in V4 Sheet 4: {len(df_s4_v4)}")
print(f"Total unknown groups in V3/V4 Sheet 3 (Already Represented): {len(df_s3_v4)}")

# Build map of physical box models
box_models_map = {}
all_physical_models = {} # model -> list of boxes

for idx, r in df_s1_v4.iterrows():
    bnum = r['Physical Box Number']
    ms = [m.strip() for m in str(r['Canonical Compatible Models']).split(',') if m.strip()]
    box_models_map[bnum] = {
        'displaySize': r['Display Size'],
        'title': r['Title'],
        'models': ms,
        'source': r['Source']
    }
    for m in ms:
        all_physical_models.setdefault(m, []).append(bnum)

print(f"Total unique canonical models in physical BOX 01-106: {len(all_physical_models)}")

# Analyze each of the 163 unknown groups from V4 Sheet 4
already_rep_list = []
safe_additions_list = []
new_unassigned_list = []
conflicts_list = []

for idx, r in df_s4_v4.iterrows():
    rg_str = r['Research Group']
    if '(' in str(rg_str):
        rg_id = str(rg_str).split('(')[0].strip()
    else:
        rg_id = str(rg_str).strip()
        
    models_raw = str(r['New Models'])
    group_models = [m.strip() for m in models_raw.split(',') if m.strip()]
    evidence = str(r['Evidence'])
    
    # Check model overlap with physical boxes
    matching_boxes = {}
    for m in group_models:
        if m in all_physical_models:
            for b in all_physical_models[m]:
                matching_boxes.setdefault(b, []).append(m)
                
    if matching_boxes:
        # Find best matching box
        best_box, matched_models = max(matching_boxes.items(), key=lambda x: len(x[1]))
        total_in_group = len(group_models)
        matched_count = len(matched_models)
        
        # 100% overlap -> ALREADY REPRESENTED
        if matched_count == total_in_group:
            already_rep_list.append({
                'Unknown Group': rg_str,
                'Existing Box': best_box,
                'Matching Models': ", ".join(matched_models),
                'Reason': f"All {matched_count} models in research group are 100% covered by existing {best_box} physical inventory",
                'Action': f"No new physical box required; map directly to existing physical {best_box}"
            })
        else:
            # Partial overlap -> Check if source explicitly groups them with best_box anchor models
            unmatched_models = [m for m in group_models if m not in matched_models]
            fm_info = fm_dict.get(rg_id, {})
            fm_evidence = str(fm_info.get('Evidence Basis', ''))
            
            # If explicit cross-brand reference exists connecting them to anchor model
            if 'explicit cross-brand references' in fm_evidence.lower() or 'source-merged' in str(fm_info.get('Verification Status', '')).lower():
                safe_additions_list.append({
                    'Research Group ID': rg_str,
                    'Existing BOX Number': best_box,
                    'Models Being Added': ", ".join(unmatched_models),
                    'Existing Models': ", ".join(box_models_map[best_box]['models']),
                    'Evidence': f"Source evidence explicitly groups {', '.join(unmatched_models)} with {best_box} anchor models ({', '.join(matched_models)}). {evidence}",
                    'Source': 'Mietubl Official Super-D Catalog 2026',
                    'Verification': 'SAFE ADDITION (Explicit Source Evidence)'
                })
            else:
                new_unassigned_list.append({
                    'Research Group ID': rg_str,
                    'Compatible Models': ", ".join(group_models),
                    'Sources': evidence,
                    'Verification': 'NEW UNASSIGNED GLASS',
                    'Reason no existing BOX can be assigned': f"Partial model overlap with {best_box} ({matched_count}/{total_in_group} models), but lacking explicit source proof of physical glass equivalence for remaining models."
                })
    else:
        new_unassigned_list.append({
            'Research Group ID': rg_str,
            'Compatible Models': ", ".join(group_models),
            'Sources': evidence,
            'Verification': 'NEW UNASSIGNED GLASS',
            'Reason no existing BOX can be assigned': "0 model overlap with any existing physical box (BOX 01–BOX 106); genuinely new Super-D glass group without internal UZEE TECH box number."
        })

print(f"\nReconciliation Results:")
print(f"- Already Represented Groups: {len(already_rep_list)}")
print(f"- Safe Box Additions: {len(safe_additions_list)}")
print(f"- New Unassigned Glass Groups: {len(new_unassigned_list)}")
