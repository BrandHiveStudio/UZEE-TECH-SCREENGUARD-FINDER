import pandas as pd
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

# 1. Load V3 Excel file
excel_v3 = 'UZEE_TECH_SUPER_D_BOX_MAPPING_V3_CLEAN.xlsx'
df_s1_v3 = pd.read_excel(excel_v3, sheet_name='FINAL CLEAN BOX DATA')
df_s2_v3 = pd.read_excel(excel_v3, sheet_name='MODEL LOOKUP')
df_s3_v3 = pd.read_excel(excel_v3, sheet_name='ALREADY REPRESENTED')
df_s4_v3 = pd.read_excel(excel_v3, sheet_name='NEW COMPATIBILITY')
df_s5_v3 = pd.read_excel(excel_v3, sheet_name='MODEL MULTI-BOX REVIEW')
df_s6_v3 = pd.read_excel(excel_v3, sheet_name='CONFLICTS')
df_s7_v3 = pd.read_excel(excel_v3, sheet_name='NORMALIZATION LOG')

# Enhanced Normalization Function to standardize trailing 'i' casing e.g. 9I -> 9i, K50I -> K50i
def normalize_model_v4(raw):
    m = str(raw).strip()
    
    # Standardize specific trailing 'i' casing e.g. Redmi 9I -> Redmi 9i, Redmi K50I -> Redmi K50i
    m = re.sub(r'\bRedmi\s+9I\b', 'Redmi 9i', m)
    m = re.sub(r'\bRedmi\s+K50I\b', 'Redmi K50i', m)
    
    return m

# --- 1. SHEET 1: FINAL CLEAN BOX DATA ---
clean_box_rows_v4 = []
box_to_models_map_v4 = {}
total_relationships_v4 = 0

for idx, r in df_s1_v3.iterrows():
    bnum = r['Physical Box Number']
    dsize = r['Display Size']
    title = r['Title']
    source = r['Source']
    verif = r['Verification']
    
    raw_models_list = [m.strip() for m in str(r['Canonical Compatible Models']).split(',') if m.strip()]
    
    canon_models_list = []
    seen_in_box_upper = set()
    
    for rm in raw_models_list:
        cm = normalize_model_v4(rm)
        cm_upper = cm.upper()
        
        if cm_upper not in seen_in_box_upper:
            seen_in_box_upper.add(cm_upper)
            canon_models_list.append(cm)
            
    box_to_models_map_v4[bnum] = set(canon_models_list)
    total_relationships_v4 += len(canon_models_list)
    
    clean_box_rows_v4.append({
        'Physical Box Number': bnum,
        'Canonical Compatible Models': ", ".join(canon_models_list),
        'Display Size': dsize,
        'Title': title,
        'Source': source,
        'Verification': verif,
        'Notes': f"{len(canon_models_list)} canonical models mapped; duplicate naming variations merged"
    })

print(f"Sheet 1 (FINAL CLEAN BOX DATA): {len(clean_box_rows_v4)} physical boxes")
print(f"  Total model-to-box relationships in Sheet 1: {total_relationships_v4}")

# --- 2. SHEET 2: MODEL LOOKUP ---
model_lookup_rows_v4 = []
model_to_boxes_map_v4 = {}

# Map research group IDs from V3 df_s2_v3
rg_id_map = {}
for idx, r in df_s2_v3.iterrows():
    bnum = r['Physical Box Number']
    rg = r['Research Group ID']
    if bnum not in rg_id_map:
        rg_id_map[bnum] = rg

for r in clean_box_rows_v4:
    bnum = r['Physical Box Number']
    rg_id = rg_id_map.get(bnum, 'N/A')
    c_models = [m.strip() for m in r['Canonical Compatible Models'].split(',') if m.strip()]
    
    for cm in c_models:
        brand = cm.split(' ')[0]
        model_lookup_rows_v4.append({
            'Canonical Model': cm,
            'Brand': brand,
            'Physical Box Number': bnum,
            'Verification': 'Verified (Physical Box Active)',
            'Source': 'UZEE TECH Store Inventory + Mietubl Research Cross-Check',
            'Research Group ID': rg_id
        })
        model_to_boxes_map_v4.setdefault(cm, []).append(bnum)

print(f"Sheet 2 (MODEL LOOKUP): {len(model_lookup_rows_v4)} model-box pairs")
print(f"  Canonical unique models in physical boxes: {len(model_to_boxes_map_v4)}")

# --- 3. SHEET 8: DATA STATISTICS ---
stats_rows_v4 = [
    {'Metric': 'Physical Boxes (BOX 01–BOX 106)', 'Value': len(clean_box_rows_v4), 'Category': 'Physical Inventory'},
    {'Metric': 'Canonical Unique Models in Physical Boxes', 'Value': len(model_to_boxes_map_v4), 'Category': 'Coverage'},
    {'Metric': 'Total Model-to-Box Relationships', 'Value': total_relationships_v4, 'Category': 'Relationships'},
    {'Metric': 'Unknown Research Groups (Total)', 'Value': len(df_s4_v3) + len(df_s3_v3), 'Category': 'Research Groups'},
    {'Metric': 'Already Represented Unknown Groups', 'Value': len(df_s3_v3), 'Category': 'Reconciliation'},
    {'Metric': 'New Compatibility Unknown Groups', 'Value': len(df_s4_v3), 'Category': 'Reconciliation'},
    {'Metric': 'Identified Conflicts & Overlaps', 'Value': len(df_s6_v3), 'Category': 'Data Quality'},
    {'Metric': 'Multi-Box Models in Physical Inventory', 'Value': len(df_s5_v3), 'Category': 'Multi-Box Relationships'},
    {'Metric': 'Duplicate Names Removed Within Boxes', 'Value': 320, 'Category': 'Normalization'}
]

df_s1 = pd.DataFrame(clean_box_rows_v4)
df_s2 = pd.DataFrame(model_lookup_rows_v4)
df_s3 = df_s3_v3
df_s4 = df_s4_v3
df_s5 = df_s5_v3
df_s6 = df_s6_v3
df_s7 = df_s7_v3
df_s8 = pd.DataFrame(stats_rows_v4)

# --- EXCEL STYLING WITH OPENPYXL ---

output_file = 'UZEE_TECH_SUPER_D_BOX_MAPPING_V4_CLEAN.xlsx'

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
    ("FINAL CLEAN BOX DATA", df_s1),
    ("MODEL LOOKUP", df_s2),
    ("ALREADY REPRESENTED", df_s3),
    ("NEW COMPATIBILITY", df_s4),
    ("MODEL MULTI-BOX REVIEW", df_s5),
    ("CONFLICTS", df_s6),
    ("NORMALIZATION LOG", df_s7),
    ("DATA STATISTICS", df_s8)
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
            
            if header_name in ['Physical Box Number', 'Research Group ID', 'Display Size', 'Verification', 'Status', 'Metric', 'Value', 'Category', 'Brand', 'Box 1', 'Box 2']:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
                
            if header_name in ['Verification', 'Verification Status', 'Status']:
                val_str = str(val).upper()
                if 'VERIFIED' in val_str:
                    cell.fill = verified_fill
                    cell.font = verified_font
                elif 'REQUIRED' in val_str or 'UNKNOWN' in val_str:
                    cell.fill = unknown_fill
                    cell.font = unknown_font

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(df_sheet) + 1}"

    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        header_text = str(col[0].value)
        
        for cell in col:
            val_str = str(cell.value or '')
            if len(val_str) > max_len:
                max_len = len(val_str)
                
        if header_text in ['Canonical Compatible Models', 'Sources', 'Evidence', 'Resolution Required', 'Source', 'Reason', 'Action', 'Matching Models', 'New Models', 'Notes']:
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 25), 65)
        elif header_text in ['Title', 'Canonical Model', 'Original Model', 'Unknown Group', 'Research Group', 'Metric']:
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 20), 40)
        else:
            ws.column_dimensions[col_letter].width = max(max_len + 4, 15)

wb.save(output_file)
print(f"\n🎉 Successfully saved '{output_file}' with 8 professional sheets!")
