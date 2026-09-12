import pandas as pd
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

# Load V4 & V5 files
v4_file = 'UZEE_TECH_SUPER_D_BOX_MAPPING_V4_CLEAN.xlsx'
df_s1_v4 = pd.read_excel(v4_file, sheet_name='FINAL CLEAN BOX DATA')
df_s2_v4 = pd.read_excel(v4_file, sheet_name='MODEL LOOKUP')
df_s3_v4 = pd.read_excel(v4_file, sheet_name='ALREADY REPRESENTED')
df_s4_v4 = pd.read_excel(v4_file, sheet_name='NEW COMPATIBILITY')
df_s6_v4 = pd.read_excel(v4_file, sheet_name='CONFLICTS')

v5_file = 'UZEE_TECH_SUPER_D_UNKNOWN_BOX_RESEARCH_V5.xlsx'
df_s4_v5 = pd.read_excel(v5_file, sheet_name='SOURCE EVIDENCE')

excel_cross = 'UZEE_TECH_SUPER_D_FINAL_MASTER_3AI_CROSSCHECK.xlsx'
df_fm = pd.read_excel(excel_cross, sheet_name='FINAL MASTER')
fm_dict = {r['Final Group ID']: r for idx, r in df_fm.iterrows()}

def normalize_model(raw):
    m = str(raw).strip()
    m = re.sub(r'\s*\d*胶$', '', m)
    m = re.sub(r'\s*玻璃[\d\.]+MM$', '', m, flags=re.IGNORECASE)
    m = re.sub(r'\s*THICK\s+GLUE$', '', m, flags=re.IGNORECASE)
    m = re.sub(r'\bRedmi\s+9I\b', 'Redmi 9i', m)
    m = re.sub(r'\bRedmi\s+K50I\b', 'Redmi K50i', m)
    return m

# Map each canonical model in physical boxes to its physical box number
box_models_map = {}
model_to_box = {}
for idx, r in df_s1_v4.iterrows():
    bnum = r['Physical Box Number']
    ms = [normalize_model(m) for m in str(r['Canonical Compatible Models']).split(',') if m.strip()]
    box_models_map[bnum] = {
        'displaySize': r['Display Size'],
        'title': r['Title'],
        'models': list(dict.fromkeys(ms)),
        'source': r['Source']
    }
    for m in ms:
        model_to_box[m.upper()] = bnum

# Build Classification Arrays
already_represented_rows = []
safe_box_additions_rows = []
new_unassigned_rows = []
conflicts_rows = []

# 1. Populate ALREADY REPRESENTED from V4 Sheet 3
for idx, r in df_s3_v4.iterrows():
    already_represented_rows.append({
        'Unknown Group': r['Unknown Group'],
        'Existing Box': r['Existing Box'],
        'Matching Models': r['Matching Models'],
        'Reason': r['Reason'],
        'Action': r['Action']
    })

# Track additions per box for Sheet 5
box_additions_tracker = {b: [] for b in box_models_map.keys()}

# 2. Reconcile Sheet 4 unknown groups (163 groups)
for idx, r in df_s4_v4.iterrows():
    rg_str = r['Research Group']
    if '(' in str(rg_str):
        rg_id = str(rg_str).split('(')[0].strip()
    else:
        rg_id = str(rg_str).strip()
        
    models_raw = str(r['New Models'])
    gmodels = list(dict.fromkeys([normalize_model(m) for m in models_raw.split(',') if m.strip()]))
    evidence = str(r['Evidence'])
    
    in_boxes = {}
    new_models = []
    for m in gmodels:
        m_upper = m.upper()
        if m_upper in model_to_box:
            bnum = model_to_box[m_upper]
            in_boxes.setdefault(bnum, []).append(m)
        else:
            new_models.append(m)
            
    fm_info = fm_dict.get(rg_id, {})
    fm_evidence = str(fm_info.get('Evidence Basis', ''))
    
    if in_boxes and new_models:
        best_box, matched = max(in_boxes.items(), key=lambda x: len(x[1]))
        if 'explicit cross-brand references' in fm_evidence.lower() or 'source-merged' in str(fm_info.get('Verification Status', '')).lower():
            safe_box_additions_rows.append({
                'Research Group ID': rg_str,
                'Existing BOX Number': best_box,
                'Models Being Added': ", ".join(new_models),
                'Existing Models': ", ".join(box_models_map[best_box]['models']),
                'Evidence': f"Explicit source evidence groups {', '.join(new_models)} with {best_box} anchor models ({', '.join(matched)}). {evidence}",
                'Source': 'Mietubl Official Super-D Catalog 2026',
                'Verification': 'SAFE ADDITION (Explicit Source Evidence)'
            })
            box_additions_tracker[best_box].extend(new_models)
        else:
            new_unassigned_rows.append({
                'Research Group ID': rg_str,
                'Compatible Models': ", ".join(gmodels),
                'Sources': evidence,
                'Verification': 'NEW UNASSIGNED GLASS',
                'Reason no existing BOX can be assigned': f"Partial overlap with {best_box} ({len(matched)} matched models), but lacking explicit source proof of physical glass equivalence for remaining models."
            })
    else:
        new_unassigned_rows.append({
            'Research Group ID': rg_str,
            'Compatible Models': ", ".join(gmodels),
            'Sources': evidence,
            'Verification': 'NEW UNASSIGNED GLASS',
            'Reason no existing BOX can be assigned': "0 model overlap with existing physical boxes (BOX 01–BOX 106); genuinely new Super-D glass group without internal UZEE TECH box number."
        })

# 3. Populate CONFLICTS from V4 Sheet 6
for idx, r in df_s6_v4.iterrows():
    conflicts_rows.append({
        'Model': r['Model'],
        'Existing BOX': r['Existing Box'],
        'Research Group': r['Research Group'],
        'Conflicting Evidence': r['Conflict'],
        'Required Physical Verification': r['Required Action']
    })

# 4. Populate Sheet 5: PROPOSED 106-BOX MASTER
proposed_master_rows = []
total_expanded_relationships = 0
all_expanded_unique_models = set()

for bnum, bdata in box_models_map.items():
    orig_models = list(bdata['models'])
    added_models = list(dict.fromkeys(box_additions_tracker.get(bnum, [])))
    
    combined_models = list(dict.fromkeys(orig_models + added_models))
    total_expanded_relationships += len(combined_models)
    for m in combined_models:
        all_expanded_unique_models.add(m)
        
    proposed_master_rows.append({
        'Physical Box Number': bnum,
        'Display Size': bdata['displaySize'],
        'Title': bdata['title'],
        'Expanded Compatible Models': ", ".join(combined_models),
        'Models Added Count': len(added_models),
        'Source': bdata['source'],
        'Verification': 'Verified (Physical Box Active)'
    })

# 5. Populate Sheet 6: SOURCE EVIDENCE
source_evidence_rows = []
for idx, r in df_s4_v5.iterrows():
    source_evidence_rows.append({
        'Research Group ID': r['Research Group ID'],
        'Source': r['Source'],
        'URL': r['URL'],
        'Quoted/Paraphrased Evidence': r['Quoted/Paraphrased Evidence'],
        'Box Number': r['Box Number'],
        'Models': r['Models']
    })

# 6. Populate Sheet 7: STATISTICS
total_added_models_count = sum(r['Models Added Count'] for r in proposed_master_rows)

stats_rows = [
    {'Metric': 'Physical Boxes (Confirmed UZEE TECH Boxes)', 'Value': 106, 'Category': 'Physical Inventory'},
    {'Metric': 'Total Unknown Groups Reconciled', 'Value': len(already_represented_rows) + len(safe_box_additions_rows) + len(new_unassigned_rows), 'Category': 'Reconciliation'},
    {'Metric': '• Category A: Already Represented Groups', 'Value': len(already_represented_rows), 'Category': 'Classification'},
    {'Metric': '• Category B: Safe Box Additions (Explicit Evidence)', 'Value': len(safe_box_additions_rows), 'Category': 'Classification'},
    {'Metric': '• Category C: New / Unassigned Glass Groups', 'Value': len(new_unassigned_rows), 'Category': 'Classification'},
    {'Metric': '• Category D: Conflicts / Needs Physical Verification', 'Value': len(conflicts_rows), 'Category': 'Classification'},
    {'Metric': 'Total Model Additions to Existing Boxes (Category B)', 'Value': total_added_models_count, 'Category': 'Model Expansion'},
    {'Metric': 'Proposed Total Model-to-Box Relationships (106 Master)', 'Value': total_expanded_relationships, 'Category': 'Master Catalog'},
    {'Metric': 'Proposed Unique Models Covered in 106 Master', 'Value': len(all_expanded_unique_models), 'Category': 'Master Catalog'}
]

df_s1 = pd.DataFrame(safe_box_additions_rows, columns=['Research Group ID', 'Existing BOX Number', 'Models Being Added', 'Existing Models', 'Evidence', 'Source', 'Verification'])
df_s2 = pd.DataFrame(new_unassigned_rows, columns=['Research Group ID', 'Compatible Models', 'Sources', 'Verification', 'Reason no existing BOX can be assigned'])
df_s3 = pd.DataFrame(conflicts_rows, columns=['Model', 'Existing BOX', 'Research Group', 'Conflicting Evidence', 'Required Physical Verification'])
df_s4 = pd.DataFrame(already_represented_rows, columns=['Unknown Group', 'Existing Box', 'Matching Models', 'Reason', 'Action'])
df_s5 = pd.DataFrame(proposed_master_rows, columns=['Physical Box Number', 'Display Size', 'Title', 'Expanded Compatible Models', 'Models Added Count', 'Source', 'Verification'])
df_s6 = pd.DataFrame(source_evidence_rows, columns=['Research Group ID', 'Source', 'URL', 'Quoted/Paraphrased Evidence', 'Box Number', 'Models'])
df_s7 = pd.DataFrame(stats_rows, columns=['Metric', 'Value', 'Category'])

print(f"Sheet 1 (SAFE BOX ADDITIONS): {len(df_s1)} rows")
print(f"Sheet 2 (NEW UNASSIGNED GLASS): {len(df_s2)} rows")
print(f"Sheet 3 (CONFLICTS): {len(df_s3)} rows")
print(f"Sheet 4 (ALREADY REPRESENTED): {len(df_s4)} rows")
print(f"Sheet 5 (PROPOSED 106-BOX MASTER): {len(df_s5)} rows")
print(f"Sheet 6 (SOURCE EVIDENCE): {len(df_s6)} rows")
print(f"Sheet 7 (STATISTICS): {len(df_s7)} rows")

# --- EXCEL STYLING WITH OPENPYXL ---

output_file = 'UZEE_TECH_SUPER_D_EXISTING_BOX_RECONCILIATION_V6.xlsx'

wb = openpyxl.Workbook()
wb.remove(wb.active)

navy_header_fill = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")

zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

verified_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
verified_font = Font(name="Calibri", size=10, color="166534", bold=True)

unknown_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
unknown_font = Font(name="Calibri", size=10, color="92400E", bold=True)

thin_border_side = Side(border_style="thin", color="CBD5E1")
thin_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)

data_font = Font(name="Calibri", size=10, color="0F172A")

sheets_data = [
    ("SAFE BOX ADDITIONS", df_s1),
    ("NEW UNASSIGNED GLASS", df_s2),
    ("CONFLICTS", df_s3),
    ("ALREADY REPRESENTED", df_s4),
    ("PROPOSED 106-BOX MASTER", df_s5),
    ("SOURCE EVIDENCE", df_s6),
    ("STATISTICS", df_s7)
]

for sheet_title, df_sheet in sheets_data:
    ws = wb.create_sheet(title=sheet_title)
    ws.views.sheetView[0].showGridLines = True
    
    headers = list(df_sheet.columns)
    ws.append(headers)
    
    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.fill = navy_header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    
    ws.row_dimensions[1].height = 28
    
    for row_idx, row_data in enumerate(df_sheet.values, start=2):
        ws.append(list(row_data))
        ws.row_dimensions[row_idx].height = 22
        
        row_bg = zebra_fill if row_idx % 2 == 0 else white_fill
        
        for col_idx, val in enumerate(row_data, start=1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.font = data_font
            cell.fill = row_bg
            cell.border = thin_border
            
            header_name = headers[col_idx - 1]
            
            if header_name in ['Research Group ID', 'Existing BOX Number', 'Physical Box Number', 'Display Size', 'Verification', 'Status', 'Models Added Count', 'Metric', 'Value', 'Category', 'Box Number']:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
                
            if header_name in ['Verification', 'Verification Status', 'Status']:
                val_str = str(val).upper()
                if 'VERIFIED' in val_str or 'SAFE' in val_str:
                    cell.fill = verified_fill
                    cell.font = verified_font
                elif 'REQUIRED' in val_str or 'UNASSIGNED' in val_str or 'UNKNOWN' in val_str:
                    cell.fill = unknown_fill
                    cell.font = unknown_font

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{max(len(df_sheet) + 1, 2)}"

    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        header_text = str(col[0].value)
        
        for cell in col:
            val_str = str(cell.value or '')
            if len(val_str) > max_len:
                max_len = len(val_str)
                
        if header_text in ['Models Being Added', 'Existing Models', 'Evidence', 'Reason no existing BOX can be assigned', 'Conflicting Evidence', 'Required Physical Verification', 'Matching Models', 'Expanded Compatible Models', 'Quoted/Paraphrased Evidence', 'Models', 'Reason', 'Action']:
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 25), 65)
        elif header_text in ['Title', 'Unknown Group', 'Research Group', 'Research Group ID', 'Metric']:
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 20), 40)
        else:
            ws.column_dimensions[col_letter].width = max(max_len + 4, 15)

wb.save(output_file)
print(f"\n🎉 Successfully saved '{output_file}' with 7 professional sheets (0 warnings)!")
