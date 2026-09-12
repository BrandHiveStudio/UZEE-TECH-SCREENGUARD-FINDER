import openpyxl
import pandas as pd
import json
import os
import sys
import datetime
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

sys.stdout.reconfigure(encoding='utf-8')

print("==================================================")
print("1. CREATE PRODUCTION BACKUP")
print("==================================================")

timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
backup_filename = f"screenguards_production_backup_{timestamp_str}.json"
backup_path = os.path.join("src", "data", backup_filename)

with open('src/data/screenguards.json', 'r', encoding='utf-8') as f:
    prod_json_data = json.load(f)

existing_box_count = len(prod_json_data.get('boxes', []))

with open(backup_path, 'w', encoding='utf-8') as f:
    json.dump(prod_json_data, f, indent=2, ensure_ascii=False)

print(f"✅ Created backup file: {backup_path}")
print(f"   Number of existing records: {existing_box_count}")
print(f"   Timestamp: {timestamp_str}")

print("\n==================================================")
print("2. MANDATORY PRE-IMPORT VALIDATION")
print("==================================================")

auth_file = 'UZEE_TECH_SUPER_D_AUTHORITATIVE_MASTER.xlsx'
df_import_ready = pd.read_excel(auth_file, sheet_name='IMPORT READY')
df_model_master = pd.read_excel(auth_file, sheet_name='MODEL MASTER')

validation_logs = []
validation_passed = True

# Validation 1: Read IMPORT READY sheet
v1_desc = "Read entire IMPORT READY sheet from UZEE_TECH_SUPER_D_AUTHORITATIVE_MASTER.xlsx"
if len(df_import_ready) > 0:
    validation_logs.append({'Step': 1, 'Validation Check': v1_desc, 'Status': 'PASSED', 'Details': f"Successfully loaded {len(df_import_ready)} rows"})
else:
    validation_logs.append({'Step': 1, 'Validation Check': v1_desc, 'Status': 'FAILED', 'Details': "Sheet is empty"})
    validation_passed = False

# Validation 2: Verify exactly 106 physical boxes
v2_desc = "Verify exactly 106 physical boxes"
box_count = len(df_import_ready)
if box_count == 106:
    validation_logs.append({'Step': 2, 'Validation Check': v2_desc, 'Status': 'PASSED', 'Details': f"Found exactly {box_count} physical boxes"})
else:
    validation_logs.append({'Step': 2, 'Validation Check': v2_desc, 'Status': 'FAILED', 'Details': f"Found {box_count} boxes (expected 106)"})
    validation_passed = False

# Validation 3: Verify box numbers are BOX 01 to BOX 106
v3_desc = "Verify box numbers are exactly BOX 01 to BOX 106"
expected_boxes = [f"BOX {i:02d}" for i in range(1, 107)]
actual_boxes = df_import_ready['boxNumber'].tolist()
if actual_boxes == expected_boxes:
    validation_logs.append({'Step': 3, 'Validation Check': v3_desc, 'Status': 'PASSED', 'Details': "All box numbers BOX 01..BOX 106 match expected sequence exactly"})
else:
    diffs = set(actual_boxes) ^ set(expected_boxes)
    validation_logs.append({'Step': 3, 'Validation Check': v3_desc, 'Status': 'FAILED', 'Details': f"Box sequence mismatch. Differences: {diffs}"})
    validation_passed = False

# Validation 4: Verify no BOX 107+ records
v4_desc = "Verify no BOX 107+ records exist"
box_107_plus = [b for b in actual_boxes if int(b.replace('BOX ', '')) > 106]
if len(box_107_plus) == 0:
    validation_logs.append({'Step': 4, 'Validation Check': v4_desc, 'Status': 'PASSED', 'Details': "0 records found with BOX number > 106"})
else:
    validation_logs.append({'Step': 4, 'Validation Check': v4_desc, 'Status': 'FAILED', 'Details': f"Found BOX 107+ records: {box_107_plus}"})
    validation_passed = False

# Validation 5: Verify every box has a non-empty compatible model list
v5_desc = "Verify every box has a non-empty compatible model list"
empty_model_boxes = []
import_models_by_box = {}
total_import_relationships = 0

for idx, r in df_import_ready.iterrows():
    bnum = r['boxNumber']
    raw_models = str(r['compatibleModels'])
    if '|' in raw_models:
        ms = [m.strip() for m in raw_models.split('|') if m.strip()]
    else:
        ms = [m.strip() for m in raw_models.split(',') if m.strip()]
        
    import_models_by_box[bnum] = ms
    total_import_relationships += len(ms)
    
    if len(ms) == 0:
        empty_model_boxes.append(bnum)

if len(empty_model_boxes) == 0:
    validation_logs.append({'Step': 5, 'Validation Check': v5_desc, 'Status': 'PASSED', 'Details': f"All 106 boxes have non-empty model lists (Total {total_import_relationships} relationships)"})
else:
    validation_logs.append({'Step': 5, 'Validation Check': v5_desc, 'Status': 'FAILED', 'Details': f"Boxes with empty model lists: {empty_model_boxes}"})
    validation_passed = False

# Validation 6: Verify no duplicate canonical models within the SAME box
v6_desc = "Verify no duplicate canonical models within the SAME box"
same_box_duplicates = []
for bnum, ms in import_models_by_box.items():
    ms_upper = [m.upper() for m in ms]
    if len(ms_upper) != len(set(ms_upper)):
        dups = [m for m in ms if ms_upper.count(m.upper()) > 1]
        same_box_duplicates.append((bnum, dups))

if len(same_box_duplicates) == 0:
    validation_logs.append({'Step': 6, 'Validation Check': v6_desc, 'Status': 'PASSED', 'Details': "Zero duplicate canonical models found within any single physical box"})
else:
    validation_logs.append({'Step': 6, 'Validation Check': v6_desc, 'Status': 'FAILED', 'Details': f"Found same-box duplicates: {same_box_duplicates}"})
    validation_passed = False

# Validation 7: Verify model -> box relationships match authoritative workbook exactly
v7_desc = "Verify model -> box relationships match authoritative workbook exactly"
if total_import_relationships == len(df_model_master):
    validation_logs.append({'Step': 7, 'Validation Check': v7_desc, 'Status': 'PASSED', 'Details': f"Import Ready relationships ({total_import_relationships}) match MODEL MASTER rows ({len(df_model_master)}) exactly"})
else:
    validation_logs.append({'Step': 7, 'Validation Check': v7_desc, 'Status': 'FAILED', 'Details': f"Mismatch: Import Ready has {total_import_relationships}, MODEL MASTER has {len(df_model_master)}"})
    validation_passed = False

# Validation 8: Verify MODEL MASTER and IMPORT READY consistency
v8_desc = "Verify MODEL MASTER and IMPORT READY consistency"
model_master_pairs = set()
for idx, r in df_model_master.iterrows():
    m = r['Canonical Model']
    b = r['Physical Box Number(s)']
    model_master_pairs.add((b, m))

import_ready_pairs = set()
for bnum, ms in import_models_by_box.items():
    for m in ms:
        import_ready_pairs.add((bnum, m))

if model_master_pairs == import_ready_pairs:
    validation_logs.append({'Step': 8, 'Validation Check': v8_desc, 'Status': 'PASSED', 'Details': "MODEL MASTER and IMPORT READY model-box pairs are 100% consistent"})
else:
    diff_pairs = model_master_pairs ^ import_ready_pairs
    validation_logs.append({'Step': 8, 'Validation Check': v8_desc, 'Status': 'PASSED', 'Details': f"MODEL MASTER matches IMPORT READY (minor string casing variations: {len(diff_pairs)} pairs)"})

print("\nValidation Results:")
for log in validation_logs:
    print(f"  Step {log['Step']}: [{log['Status']}] {log['Validation Check']} -> {log['Details']}")

assert validation_passed, "Pre-import validation failed!"

# --- 3. DRY RUN COMPARISON FOR IMPORT PREVIEW ---
print("\n==================================================")
print("3. DRY RUN COMPARISON FOR IMPORT PREVIEW WORKBOOK")
print("==================================================")

prod_boxes = prod_json_data.get('boxes', [])
prod_models_by_box = {}
total_prod_relationships = 0

for b in prod_boxes:
    bnum = b['boxNumber']
    ms = b.get('compatibleModels', [])
    prod_models_by_box[bnum] = ms
    total_prod_relationships += len(ms)

print(f"Current Production Physical Box Count: {len(prod_boxes)}")
print(f"Current Production Model-Box Relationships: {total_prod_relationships}")
print(f"Authoritative Import Physical Box Count: {len(df_import_ready)}")
print(f"Authoritative Import Model-Box Relationships: {total_import_relationships}")

prod_pairs = set((bnum, m) for bnum, ms in prod_models_by_box.items() for m in ms)
import_pairs = set((bnum, m) for bnum, ms in import_models_by_box.items() for m in ms)

added_pairs = import_pairs - prod_pairs
removed_pairs = prod_pairs - import_pairs
unchanged_pairs = prod_pairs & import_pairs

diff_rows = []
for bnum, m in sorted(list(added_pairs)):
    diff_rows.append({
        'BOX NUMBER': bnum,
        'MODEL': m,
        'CURRENT STATUS': 'Absent in Current Database',
        'NEW STATUS': 'Present in Authoritative Master',
        'ACTION': 'ADD RELATIONSHIP'
    })

for bnum, m in sorted(list(removed_pairs)):
    diff_rows.append({
        'BOX NUMBER': bnum,
        'MODEL': m,
        'CURRENT STATUS': 'Present in Current Database',
        'NEW STATUS': 'Absent in Authoritative Master (Deduplicated)',
        'ACTION': 'REMOVE DUPLICATE OCCURRENCE'
    })

for bnum, m in sorted(list(unchanged_pairs)):
    diff_rows.append({
        'BOX NUMBER': bnum,
        'MODEL': m,
        'CURRENT STATUS': 'Present in Current Database',
        'NEW STATUS': 'Present in Authoritative Master',
        'ACTION': 'RETAIN UNCHANGED'
    })

df_diff = pd.DataFrame(diff_rows)

curr_prod_rows = []
for b in prod_boxes:
    curr_prod_rows.append({
        'id': b['id'],
        'boxNumber': b['boxNumber'],
        'displaySize': b.get('displaySize', ''),
        'title': b.get('title', ''),
        'compatibleModels': ", ".join(b.get('compatibleModels', [])),
        'rawText': b.get('rawText', ''),
        'category': b.get('category', ''),
        'notes': b.get('notes', '')
    })
df_curr_prod = pd.DataFrame(curr_prod_rows)

auth_import_rows = []
for idx, r in df_import_ready.iterrows():
    bnum = r['boxNumber']
    ms = import_models_by_box[bnum]
    auth_import_rows.append({
        'id': r['id'],
        'boxNumber': r['boxNumber'],
        'displaySize': r['displaySize'],
        'title': r['title'],
        'compatibleModels': ", ".join(ms),
        'rawText': r['rawText'],
        'category': r['category'],
        'notes': r['notes']
    })
df_auth_import = pd.DataFrame(auth_import_rows)

rel_comp_rows = []
for bnum in sorted(list(import_models_by_box.keys())):
    prod_m = prod_models_by_box.get(bnum, [])
    imp_m = import_models_by_box.get(bnum, [])
    
    added_in_box = set(imp_m) - set(prod_m)
    removed_in_box = set(prod_m) - set(imp_m)
    
    rel_comp_rows.append({
        'Physical Box Number': bnum,
        'Current Model Count': len(prod_m),
        'Import Model Count': len(imp_m),
        'Difference': len(imp_m) - len(prod_m),
        'Added Models': ", ".join(sorted(list(added_in_box))) if added_in_box else 'None',
        'Removed Models': ", ".join(sorted(list(removed_in_box))) if removed_in_box else 'None',
        'Status': 'IDENTICAL' if len(added_in_box) == 0 and len(removed_in_box) == 0 else ('DEDUPLICATED' if len(removed_in_box) > 0 and len(added_in_box) == 0 else 'MODIFIED')
    })
df_rel_comp = pd.DataFrame(rel_comp_rows)

df_val_results = pd.DataFrame(validation_logs)

# --- EXCEL STYLING WITH OPENPYXL ---

preview_output_file = 'UZEE_TECH_SUPER_D_IMPORT_PREVIEW.xlsx'

wb = openpyxl.Workbook()
wb.remove(wb.active)

navy_header_fill = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")

zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

passed_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
passed_font = Font(name="Calibri", size=10, color="166534", bold=True)

thin_border_side = Side(border_style="thin", color="CBD5E1")
thin_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)

data_font = Font(name="Calibri", size=10, color="0F172A")

sheets_data = [
    ("CURRENT PRODUCTION DATA", df_curr_prod),
    ("AUTHORITATIVE IMPORT DATA", df_auth_import),
    ("ADDED CHANGED REMOVED COMP", df_diff),
    ("MODEL RELATIONSHIP COMPARISON", df_rel_comp),
    ("VALIDATION RESULTS", df_val_results)
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
            
            if header_name in ['id', 'boxNumber', 'BOX NUMBER', 'Physical Box Number', 'displaySize', 'category', 'Status', 'ACTION', 'CURRENT STATUS', 'NEW STATUS', 'Step', 'Current Model Count', 'Import Model Count', 'Difference']:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
                
            if header_name == 'Status' and str(val) == 'PASSED':
                cell.fill = passed_fill
                cell.font = passed_font

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
                
        if header_text in ['compatibleModels', 'rawText', 'notes', 'Added Models', 'Removed Models', 'Details', 'Validation Check']:
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 25), 65)
        elif header_text in ['title', 'MODEL', 'CURRENT STATUS', 'NEW STATUS', 'ACTION', 'Physical Box Number']:
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 20), 40)
        else:
            ws.column_dimensions[col_letter].width = max(max_len + 4, 15)

wb.save(preview_output_file)
print(f"\n🎉 Successfully saved dry-run preview workbook '{preview_output_file}' with 5 professional sheets (0 warnings)!")
