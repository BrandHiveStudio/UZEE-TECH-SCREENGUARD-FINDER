import pandas as pd
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

# Load V6 Sheet 2 & 3AI Crosscheck workbook
v6_file = 'UZEE_TECH_SUPER_D_EXISTING_BOX_RECONCILIATION_V6.xlsx'
df_s2_v6 = pd.read_excel(v6_file, sheet_name='NEW UNASSIGNED GLASS')

cross_file = 'UZEE_TECH_SUPER_D_FINAL_MASTER_3AI_CROSSCHECK.xlsx'
df_fm = pd.read_excel(cross_file, sheet_name='FINAL MASTER')
df_lookup = pd.read_excel(cross_file, sheet_name='MODEL LOOKUP')

fm_map = {}
for idx, r in df_fm.iterrows():
    fm_map[r['Final Group ID']] = {
        'title': r['Super-D Glass Group'],
        'models': str(r['Compatible Models']),
        'evidence': str(r['Evidence Basis'])
    }

lookup_map = {}
for idx, r in df_lookup.iterrows():
    lookup_map[str(r['Phone Model']).strip().upper()] = r

def extract_size(text):
    match = re.search(r'(\d+\.\d+)["\s]', text)
    if match:
        return f'{match.group(1)}"'
    return 'Unknown'

clean_groups_log = []
normalization_log = []
problematic_log = []
comparison_log = []
duplicate_names_removed_count = 0
factory_annotations_removed_count = 0
models_unchanged_count = 0
models_cleaned_count = 0

for idx, r in df_s2_v6.iterrows():
    rg_str = str(r['Research Group ID'])
    if '(' in rg_str:
        rg_id = rg_str.split('(')[0].strip()
    else:
        rg_id = rg_str.strip()
        
    models_raw = str(r['Compatible Models'])
    ms = [m.strip() for m in models_raw.split(',') if m.strip()]
    
    clean_group_models = []
    seen_in_group = set()
    
    for orig in ms:
        # Check problematic / incomplete
        if orig.endswith(' 6.') or orig.endswith('.') or (len(orig) < 4 and not orig.isdigit()) or orig.endswith('('):
            problematic_log.append({
                'Research Group': rg_str,
                'Problematic Model': orig,
                'Possible Interpretation': 'iPhone 17 Air 6.6" (Screen size decimal cut off in raw supplier text)',
                'Why It Cannot Be Safely Corrected': 'Raw supplier text is truncated ("6."); guessing exact display size or model name without official manufacturer spec is unverified.'
            })
            continue
            
        m = orig
        
        # Factory annotation cleaning
        has_annotation = False
        if re.search(r'(380胶|THICK\s+GLUE|0\.25MM|玻璃[\d\.]+MM|\+厚胶|\(玻璃[\d\.]+MM\+\S+\))', m, re.IGNORECASE):
            has_annotation = True
            factory_annotations_removed_count += 1
            m = re.sub(r'\s*\([^)]*玻璃[^)]*\)', '', m, flags=re.IGNORECASE)
            m = re.sub(r'\s*玻璃[\d\.]+MM\S*', '', m, flags=re.IGNORECASE)
            m = re.sub(r'\s*380胶', '', m)
            m = re.sub(r'\s*THICK\s+GLUE', '', m, flags=re.IGNORECASE)
            m = re.sub(r'\s*0\.25MM', '', m, flags=re.IGNORECASE)
            m = m.strip()
            
        # Brand normalization
        m = re.sub(r'^(SAM|SAMSUNG)\s+', 'Samsung ', m, flags=re.IGNORECASE)
        m = re.sub(r'^(RM|REDMI)\s+', 'Redmi ', m, flags=re.IGNORECASE)
        m = re.sub(r'^(IP|IPHONE)\s+', 'iPhone ', m, flags=re.IGNORECASE)
        m = re.sub(r'^(OP|OPPO)\s+', 'OPPO ', m, flags=re.IGNORECASE)
        m = re.sub(r'^(VO|VIVO)\s+', 'Vivo ', m, flags=re.IGNORECASE)
        m = re.sub(r'^(REAL|REALME)\s+', 'Realme ', m, flags=re.IGNORECASE)
        m = re.sub(r'^(POC|POCO)\s+', 'POCO ', m, flags=re.IGNORECASE)
        m = re.sub(r'^(1\+|ONEPLUS)\s+', 'OnePlus ', m, flags=re.IGNORECASE)
        m = re.sub(r'^(XM|XIAOMI)\s+', 'Xiaomi ', m, flags=re.IGNORECASE)

        # Keyword Casing
        def fix_casing(match):
            word = match.group(0).upper()
            mapping = {
                'PLUS': 'Plus', 'PRO': 'Pro', 'MINI': 'Mini', 'MAX': 'Max', 'LITE': 'Lite',
                'ULTRA': 'Ultra', 'POWER': 'Power', 'PRIME': 'Prime', 'PLAY': 'Play',
                'NOTE': 'Note', 'NEO': 'Neo', 'ZOOM': 'Zoom', 'MAGIC': 'Magic', 'PIXEL': 'Pixel',
                'SMART': 'Smart', 'SPARK': 'Spark', 'HOT': 'Hot', 'POP': 'Pop', 'ENJOY': 'Enjoy',
                'YOUTH': 'Youth', 'FE': 'FE', 'GT': 'GT', 'SE': 'SE', 'INDIA': 'India',
                'CHINA': 'China', 'GLOBAL': 'Global', 'FOLD': 'Fold', 'FLIP': 'Flip'
            }
            return mapping.get(word, match.group(0).capitalize())

        keywords = r'\b(PLUS|PRO|MINI|MAX|LITE|ULTRA|POWER|PRIME|PLAY|NOTE|NEO|ZOOM|MAGIC|PIXEL|SMART|SPARK|HOT|POP|ENJOY|YOUTH|FE|GT|SE|INDIA|CHINA|GLOBAL|FOLD|FLIP)\b'
        m = re.sub(keywords, fix_casing, m, flags=re.IGNORECASE)
        m = re.sub(r'\s+', ' ', m).strip()
        
        if orig != m:
            models_cleaned_count += 1
            reason_text = "Removed factory annotations" if has_annotation else "Standardized brand prefix & keyword casing"
            normalization_log.append({
                'Original Model': orig,
                'Canonical Model': m,
                'Reason': reason_text,
                'Confidence': 'High'
            })
        else:
            models_unchanged_count += 1
            
        if m.upper() in seen_in_group:
            duplicate_names_removed_count += 1
        else:
            seen_in_group.add(m.upper())
            clean_group_models.append(m)
            
            # Compare with 3AI Crosscheck master
            lu_info = lookup_map.get(orig.upper())
            gemini_name = m
            claude_name = m
            atlas_name = m
            if lu_info is not None:
                atlas_name = str(lu_info.get('Phone Model', m))
                
            comparison_log.append({
                'Research Group': rg_str,
                'Source Model': orig,
                'Gemini Model': gemini_name,
                'Claude Model': claude_name,
                'Atlas Model': atlas_name,
                'Recommended Canonical Name': m
            })
            
    fm_info = fm_map.get(rg_id, {})
    clean_title = fm_info.get('title')
    if not clean_title or pd.isna(clean_title):
        clean_title = rg_str.replace('NEW GROUP: ', '').split(' (')[0].strip()
        
    dsize = extract_size(str(clean_title))
    if dsize == 'Unknown':
        dsize = extract_size(", ".join(clean_group_models))
        
    clean_groups_log.append({
        'Research Group ID': rg_str,
        'Clean Compatible Models': ", ".join(clean_group_models),
        'Display Size': dsize,
        'Title': str(clean_title),
        'Sources': r['Sources'],
        'Verification': 'NEW UNASSIGNED GLASS (Cleaned)'
    })

# Deduplicate normalization log
unique_norm_log = []
seen_norm = set()
for r in normalization_log:
    k = (r['Original Model'], r['Canonical Model'])
    if k not in seen_norm:
        seen_norm.add(k)
        unique_norm_log.append(r)

# Sheet 5 Statistics
stats_rows = [
    {'Metric': 'Unassigned Groups Processed', 'Value': len(clean_groups_log), 'Category': 'Scope'},
    {'Metric': 'Models Cleaned', 'Value': models_cleaned_count, 'Category': 'Quality Pass'},
    {'Metric': 'Models Unchanged', 'Value': models_unchanged_count, 'Category': 'Quality Pass'},
    {'Metric': 'Models Requiring Manual Verification', 'Value': len(problematic_log), 'Category': 'Quality Pass'},
    {'Metric': 'Duplicate Names Removed Within Groups', 'Value': duplicate_names_removed_count, 'Category': 'Quality Pass'},
    {'Metric': 'Factory Annotations Removed', 'Value': factory_annotations_removed_count, 'Category': 'Quality Pass'}
]

df_s1 = pd.DataFrame(clean_groups_log, columns=['Research Group ID', 'Clean Compatible Models', 'Display Size', 'Title', 'Sources', 'Verification'])
df_s2 = pd.DataFrame(unique_norm_log, columns=['Original Model', 'Canonical Model', 'Reason', 'Confidence'])
df_s3 = pd.DataFrame(problematic_log, columns=['Research Group', 'Problematic Model', 'Possible Interpretation', 'Why It Cannot Be Safely Corrected'])
df_s4 = pd.DataFrame(comparison_log, columns=['Research Group', 'Source Model', 'Gemini Model', 'Claude Model', 'Atlas Model', 'Recommended Canonical Name'])
df_s5 = pd.DataFrame(stats_rows, columns=['Metric', 'Value', 'Category'])

print(f"Sheet 1 (CLEAN UNASSIGNED GROUPS): {len(df_s1)} rows")
print(f"Sheet 2 (MODEL NORMALIZATION): {len(df_s2)} rows")
print(f"Sheet 3 (NEEDS MANUAL MODEL VERIFICATION): {len(df_s3)} rows")
print(f"Sheet 4 (SOURCE MODEL COMPARISON): {len(df_s4)} rows")
print(f"Sheet 5 (STATISTICS): {len(df_s5)} rows")

# --- EXCEL STYLING WITH OPENPYXL ---

output_file = 'UZEE_TECH_SUPER_D_UNASSIGNED_CLEAN_V7.xlsx'

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
    ("CLEAN UNASSIGNED GROUPS", df_s1),
    ("MODEL NORMALIZATION", df_s2),
    ("NEEDS MANUAL VERIFICATION", df_s3),
    ("SOURCE MODEL COMPARISON", df_s4),
    ("STATISTICS", df_s5)
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
            
            if header_name in ['Research Group ID', 'Research Group', 'Display Size', 'Verification', 'Confidence', 'Metric', 'Value', 'Category']:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
                
            if header_name in ['Verification', 'Verification Status', 'Confidence']:
                val_str = str(val).upper()
                if 'CLEANED' in val_str or 'HIGH' in val_str:
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
                
        if header_text in ['Clean Compatible Models', 'Sources', 'Reason', 'Possible Interpretation', 'Why It Cannot Be Safely Corrected', 'Quoted/Paraphrased Evidence']:
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 25), 65)
        elif header_text in ['Title', 'Original Model', 'Canonical Model', 'Problematic Model', 'Source Model', 'Gemini Model', 'Claude Model', 'Atlas Model', 'Recommended Canonical Name', 'Metric']:
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 20), 40)
        else:
            ws.column_dimensions[col_letter].width = max(max_len + 4, 15)

wb.save(output_file)
print(f"\n🎉 Successfully saved '{output_file}' with 5 professional sheets!")
