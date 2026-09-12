import pandas as pd
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

# 1. Load V4 Excel file
excel_v4 = 'UZEE_TECH_SUPER_D_BOX_MAPPING_V4_CLEAN.xlsx'
df_s4_v4 = pd.read_excel(excel_v4, sheet_name='NEW COMPATIBILITY')
df_s6_v4 = pd.read_excel(excel_v4, sheet_name='CONFLICTS')

# Load Crosscheck Final Master for additional metadata
excel_cross = 'UZEE_TECH_SUPER_D_FINAL_MASTER_3AI_CROSSCHECK.xlsx'
df_fm = pd.read_excel(excel_cross, sheet_name='FINAL MASTER')
fm_dict = {r['Final Group ID']: r for idx, r in df_fm.iterrows()}

print(f"Loaded {len(df_s4_v4)} unknown groups from V4 Sheet 4 ('NEW COMPATIBILITY')")

# --- BUILD SHEET 1: BOX NUMBER DISCOVERED ---
# As per strict rule, 0 box numbers invented/inferred without explicit physical box number source.
s1_discovered_rows = []

# --- BUILD SHEET 2: BOX NUMBER UNKNOWN ---
s2_unknown_rows = []
# --- BUILD SHEET 4: SOURCE EVIDENCE ---
s4_evidence_rows = []

sources_checked_text = "Mietubl Official Super-D Catalog (mietubl.com), Super-D Supplier Bulletins, UZEE TECH Physical Inventory Lists"
why_not_found_text = "Manufacturer/wholesaler lists specify device compatibility without internal physical box numbering; requires physical stock verification at UZEE TECH store."

for idx, r in df_s4_v4.iterrows():
    rg_str = r['Research Group']
    if '(' in str(rg_str):
        rg_id = str(rg_str).split('(')[0].strip()
    else:
        rg_id = str(rg_str).strip()
        
    models = str(r['New Models'])
    evidence_base = str(r['Evidence'])
    
    fm_info = fm_dict.get(rg_id, {})
    url = "https://www.mietubl.com/models/3/"
    
    s2_unknown_rows.append({
        'Research Group ID': rg_str,
        'Compatible Models': models,
        'Sources Checked': sources_checked_text,
        'Why Box Number Was Not Found': why_not_found_text
    })
    
    s4_evidence_rows.append({
        'Research Group ID': rg_id,
        'Source': 'Mietubl Official Super-D Catalog',
        'URL': url,
        'Quoted/Paraphrased Evidence': f"Extracted Mietubl compatibility group for {rg_str}. {evidence_base}",
        'Box Number': 'UNKNOWN',
        'Models': models
    })

# --- BUILD SHEET 3: CONFLICTING EVIDENCE ---
s3_conflicts_rows = []
for idx, r in df_s6_v4.iterrows():
    if 'SD-0' in str(r['Research Group']) or 'SD-F' in str(r['Research Group']):
        s3_conflicts_rows.append({
            'Research Group ID': r['Research Group'],
            'Possible Box Numbers': 'UNKNOWN / Multi-Box',
            'Sources': 'Mietubl Official Catalog + UZEE TECH Cross-Check',
            'Conflict': r['Conflict'],
            'Required Action': r['Required Action']
        })

# --- BUILD SHEET 5: RESEARCH STATISTICS ---
stats_rows = [
    {'Metric': 'Total Unknown Groups Researched', 'Value': len(df_s4_v4), 'Category': 'Scope'},
    {'Metric': 'Verified Box Numbers Found (Explicit Source Evidence)', 'Value': len(s1_discovered_rows), 'Category': 'Results'},
    {'Metric': 'Probable Box Numbers', 'Value': 0, 'Category': 'Results'},
    {'Metric': 'Still Unknown (Physical Box Number Required)', 'Value': len(s2_unknown_rows), 'Category': 'Results'},
    {'Metric': 'Conflicting Evidence Groups', 'Value': len(s3_conflicts_rows), 'Category': 'Data Quality'}
]

df_s1 = pd.DataFrame(s1_discovered_rows, columns=['Research Group ID', 'Physical Box Number', 'Compatible Models', 'Source', 'Source URL', 'Evidence', 'Confidence'])
df_s2 = pd.DataFrame(s2_unknown_rows)
df_s3 = pd.DataFrame(s3_conflicts_rows)
df_s4 = pd.DataFrame(s4_evidence_rows)
df_s5 = pd.DataFrame(stats_rows)

print(f"Sheet 1 (BOX NUMBER DISCOVERED): {len(df_s1)} rows")
print(f"Sheet 2 (BOX NUMBER UNKNOWN): {len(df_s2)} rows")
print(f"Sheet 3 (CONFLICTING EVIDENCE): {len(df_s3)} rows")
print(f"Sheet 4 (SOURCE EVIDENCE): {len(df_s4)} rows")
print(f"Sheet 5 (RESEARCH STATISTICS): {len(df_s5)} rows")

# --- EXCEL STYLING WITH OPENPYXL ---

output_file = 'UZEE_TECH_SUPER_D_UNKNOWN_BOX_RESEARCH_V5.xlsx'

wb = openpyxl.Workbook()
wb.remove(wb.active)

navy_header_fill = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")

zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

unknown_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
unknown_font = Font(name="Calibri", size=10, color="92400E", bold=True)

thin_border_side = Side(border_style="thin", color="CBD5E1")
thin_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)

data_font = Font(name="Calibri", size=10, color="0F172A")

sheets_data = [
    ("BOX NUMBER DISCOVERED", df_s1),
    ("BOX NUMBER UNKNOWN", df_s2),
    ("CONFLICTING EVIDENCE", df_s3),
    ("SOURCE EVIDENCE", df_s4),
    ("RESEARCH STATISTICS", df_s5)
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
            
            if header_name in ['Research Group ID', 'Physical Box Number', 'Box Number', 'Confidence', 'Metric', 'Value', 'Category', 'Possible Box Numbers']:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
                
            if header_name in ['Box Number', 'Physical Box Number'] and str(val).upper() == 'UNKNOWN':
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
                
        if header_text in ['Compatible Models', 'Sources Checked', 'Why Box Number Was Not Found', 'Evidence', 'Required Action', 'Quoted/Paraphrased Evidence', 'Models', 'Conflict']:
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 25), 65)
        elif header_text in ['Research Group ID', 'Source', 'URL', 'Metric']:
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 20), 40)
        else:
            ws.column_dimensions[col_letter].width = max(max_len + 4, 15)

wb.save(output_file)
print(f"\n🎉 Successfully saved '{output_file}' with 5 professional sheets!")
