import pandas as pd
import json
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

# 1. Load V2 Excel file
excel_v2 = 'UZEE_TECH_SUPER_D_BOX_MAPPING_ANALYSIS_V2.xlsx'
df_s1_v2 = pd.read_excel(excel_v2, sheet_name='VERIFIED EXISTING BOXES')
df_s2_v2 = pd.read_excel(excel_v2, sheet_name='NEW GROUPS — BOX UNKNOWN')
df_s3_v2 = pd.read_excel(excel_v2, sheet_name='MODEL CONFLICTS')

# 2. Normalization Function
def normalize_model(raw):
    m = str(raw).strip()
    original = m
    
    # Clean factory text annotations attached to model names
    m = re.sub(r'\s*\d*胶$', '', m)
    m = re.sub(r'\s*玻璃[\d\.]+MM$', '', m, flags=re.IGNORECASE)
    m = re.sub(r'\s*THICK\s+GLUE$', '', m, flags=re.IGNORECASE)

    # Standardize brand prefixes & double brand prefixes
    m = re.sub(r'^(Samsung|SAMSUNG)\s+SAM\s+', 'Samsung ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(Redmi|REDMI)\s+RM\s+', 'Redmi ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(iPhone|IPHONE)\s+IP\s+', 'iPhone ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(OPPO|Oppo)\s+OP\s+', 'OPPO ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(Vivo|VIVO)\s+VO\s+', 'Vivo ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(Realme|REALME)\s+REAL\s+', 'Realme ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(POCO|Poco)\s+POC\s+', 'POCO ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(OnePlus|ONEPLUS)\s+1\+\s+', 'OnePlus ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(Xiaomi|XIAOMI)\s+XM\s+', 'Xiaomi ', m, flags=re.IGNORECASE)

    m = re.sub(r'^(IP|IPHONE)\s+', 'iPhone ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(SAM|SAMSUNG)\s+', 'Samsung ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(RM|REDMI)\s+', 'Redmi ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(OP|OPPO)\s+', 'OPPO ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(VO|VIVO)\s+', 'Vivo ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(REAL|REALME)\s+', 'Realme ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(POC|POCO)\s+', 'POCO ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(1\+|ONEPLUS)\s+', 'OnePlus ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(XM|XIAOMI)\s+', 'Xiaomi ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(HONOR)\s+', 'Honor ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(HUAWEI)\s+', 'Huawei ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(MOTO|MOTOROLA)\s+', 'Motorola ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(ITEL)\s+', 'Itel ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(INFINIX)\s+', 'Infinix ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(TECNO)\s+', 'Tecno ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(GOOGLE)\s+', 'Google ', m, flags=re.IGNORECASE)
    m = re.sub(r'^(NOKIA)\s+', 'Nokia ', m, flags=re.IGNORECASE)

    if re.match(r'^(HOT|SMART)\s+\d+', m, re.IGNORECASE):
        m = 'Infinix ' + m
    elif re.match(r'^(SPARK|POP)\s+\d+', m, re.IGNORECASE):
        m = 'Tecno ' + m

    def fix_casing(match):
        word = match.group(0).upper()
        mapping = {
            'PLUS': 'Plus', 'PRO': 'Pro', 'MINI': 'Mini', 'MAX': 'Max', 'LITE': 'Lite',
            'ULTRA': 'Ultra', 'POWER': 'Power', 'PRIME': 'Prime', 'PLAY': 'Play',
            'NOTE': 'Note', 'NEO': 'Neo', 'ZOOM': 'Zoom', 'MAGIC': 'Magic', 'PIXEL': 'Pixel',
            'SMART': 'Smart', 'SPARK': 'Spark', 'HOT': 'Hot', 'POP': 'Pop', 'ENJOY': 'Enjoy',
            'YOUTH': 'Youth', 'FE': 'FE', 'GT': 'GT', 'SE': 'SE', 'INDIA': 'India',
            'CHINA': 'China', 'GLOBAL': 'Global'
        }
        return mapping.get(word, match.group(0).capitalize())

    keywords = r'\b(PLUS|PRO|MINI|MAX|LITE|ULTRA|POWER|PRIME|PLAY|NOTE|NEO|ZOOM|MAGIC|PIXEL|SMART|SPARK|HOT|POP|ENJOY|YOUTH|FE|GT|SE|INDIA|CHINA|GLOBAL)\b'
    m = re.sub(keywords, fix_casing, m, flags=re.IGNORECASE)
    m = re.sub(r'\s+', ' ', m).strip()
    return m

def get_brand(model_str):
    tokens = model_str.split(' ')
    return tokens[0] if tokens else 'Unknown'

# --- 1. PROCESS SHEET 1: FINAL CLEAN BOX DATA ---
clean_box_rows = []
box_to_models_map = {} # box -> set of canonical models
normalization_log = []
duplicates_removed_count = 0
total_relationships_s1 = 0

for idx, r in df_s1_v2.iterrows():
    bnum = r['Physical Box Number']
    rg_id = r['Research Group ID']
    dsize = r['Display Size']
    title = r['Title']
    source = r['Source']
    verif = r['Verification']
    
    raw_models_list = [m.strip() for m in str(r['Compatible Models']).split(',') if m.strip()]
    
    canon_models_list = []
    seen_in_box = set()
    
    for rm in raw_models_list:
        cm = normalize_model(rm)
        if rm != cm:
            normalization_log.append({
                'Original Model': rm,
                'Canonical Model': cm,
                'Reason': 'Standardized brand prefix/casing & removed factory annotations'
            })
            
        if cm in seen_in_box:
            duplicates_removed_count += 1
        else:
            seen_in_box.add(cm)
            canon_models_list.append(cm)
            
    box_to_models_map[bnum] = seen_in_box
    total_relationships_s1 += len(canon_models_list)
    
    clean_box_rows.append({
        'Physical Box Number': bnum,
        'Canonical Compatible Models': ", ".join(canon_models_list),
        'Display Size': dsize,
        'Title': title,
        'Source': source,
        'Verification': verif,
        'Notes': f"{len(canon_models_list)} canonical models mapped; duplicate naming variations merged"
    })

print(f"Sheet 1 (FINAL CLEAN BOX DATA): {len(clean_box_rows)} physical boxes")
print(f"  Total model-to-box relationships in Sheet 1: {total_relationships_s1}")
print(f"  Duplicate names removed within physical boxes: {duplicates_removed_count}")

# --- 2. PROCESS SHEET 2: MODEL LOOKUP & MULTI-BOX IDENTIFICATION ---
model_lookup_rows = []
model_to_boxes_map = {} # canonical model -> list of boxes

for r in clean_box_rows:
    bnum = r['Physical Box Number']
    rg_id = r.get('Research Group ID', 'N/A')
    c_models = [m.strip() for m in r['Canonical Compatible Models'].split(',') if m.strip()]
    
    for cm in c_models:
        brand = get_brand(cm)
        model_lookup_rows.append({
            'Canonical Model': cm,
            'Brand': brand,
            'Physical Box Number': bnum,
            'Verification': 'Verified (Physical Box Active)',
            'Source': 'UZEE TECH Store Inventory + Mietubl Research Cross-Check',
            'Research Group ID': rg_id
        })
        model_to_boxes_map.setdefault(cm, []).append(bnum)

multi_box_models_s1 = {m: boxes for m, boxes in model_to_boxes_map.items() if len(boxes) > 1}
print(f"Sheet 2 (MODEL LOOKUP): {len(model_lookup_rows)} model-box pairs")
print(f"  Canonical unique models in physical boxes: {len(model_to_boxes_map)}")
print(f"  Multi-box models in physical boxes: {len(multi_box_models_s1)}")

# --- 3. RECONCILE SHEET 3 (ALREADY REPRESENTED) vs SHEET 4 (NEW COMPATIBILITY) ---
already_represented_rows = []
new_compatibility_rows = []

box_models_union = set(model_to_boxes_map.keys())

for idx, r in df_s2_v2.iterrows():
    rg_id = r['Research Group ID']
    title = r['Title']
    dsize = r['Display Size']
    evidence = r['Sources']
    
    raw_models = [m.strip() for m in str(r['Compatible Models']).split(',') if m.strip()]
    canon_models = list(dict.fromkeys([normalize_model(m) for m in raw_models]))
    
    # Check overlap with existing physical boxes
    matching_boxes = {}
    for cm in canon_models:
        if cm in model_to_boxes_map:
            for b in model_to_boxes_map[cm]:
                matching_boxes.setdefault(b, []).append(cm)
                
    # Classify group
    if matching_boxes:
        # Find best matching box
        best_box, matched_models = max(matching_boxes.items(), key=lambda x: len(x[1]))
        overlap_pct = len(matched_models) / len(canon_models)
        
        if overlap_pct >= 0.5 or len(matched_models) == len(canon_models):
            already_represented_rows.append({
                'Unknown Group': f"{rg_id} ({title})",
                'Existing Box': best_box,
                'Matching Models': ", ".join(matched_models),
                'Reason': f"High overlap ({len(matched_models)}/{len(canon_models)} models match existing {best_box} inventory)",
                'Action': f"No new physical box required; map directly to existing physical {best_box}"
            })
        else:
            new_models = [cm for cm in canon_models if cm not in box_models_union]
            new_compatibility_rows.append({
                'Research Group': f"{rg_id} ({title})",
                'New Models': ", ".join(new_models) if new_models else ", ".join(canon_models),
                'Evidence': evidence,
                'Physical Box Number': 'UNKNOWN',
                'Status': 'BOX NUMBER REQUIRED'
            })
    else:
        new_compatibility_rows.append({
            'Research Group': f"{rg_id} ({title})",
            'New Models': ", ".join(canon_models),
            'Evidence': evidence,
            'Physical Box Number': 'UNKNOWN',
            'Status': 'BOX NUMBER REQUIRED'
        })

print(f"\nSheet 3 (ALREADY REPRESENTED): {len(already_represented_rows)} groups")
print(f"Sheet 4 (NEW COMPATIBILITY): {len(new_compatibility_rows)} groups")

# --- 4. SHEET 5: MODEL MULTI-BOX REVIEW ---
multi_box_review_rows = []
for cm, boxes in multi_box_models_s1.items():
    multi_box_review_rows.append({
        'Canonical Model': cm,
        'Box 1': boxes[0],
        'Box 2': boxes[1] if len(boxes) > 1 else 'N/A',
        'Evidence': f"Model mapped to multiple physical boxes in inventory ({', '.join(boxes)})",
        'Likely Legitimate?': 'Yes (Multi-Box Stocking / Dual Fit)',
        'Resolution': f"Retain multi-box relationships; verify physical glass dimension differences"
    })

print(f"Sheet 5 (MODEL MULTI-BOX REVIEW): {len(multi_box_review_rows)} models")

# --- 5. SHEET 6: CONFLICTS ---
conflicts_rows = []
for idx, r in df_s3_v2.iterrows():
    m_norm = normalize_model(r['Model'])
    conflicts_rows.append({
        'Model': m_norm,
        'Existing Box': r['Existing Box'],
        'Research Group': r['New Research Group'],
        'Conflict': r['Evidence'],
        'Evidence': r['Evidence'],
        'Required Action': r['Resolution Required']
    })

print(f"Sheet 6 (CONFLICTS): {len(conflicts_rows)} items")

# --- 6. SHEET 7: NORMALIZATION LOG ---
# Deduplicate normalization log entries
unique_norm_log = []
seen_log_keys = set()
for log_entry in normalization_log:
    key = (log_entry['Original Model'], log_entry['Canonical Model'])
    if key not in seen_log_keys:
        seen_log_keys.add(key)
        unique_norm_log.append(log_entry)

print(f"Sheet 7 (NORMALIZATION LOG): {len(unique_norm_log)} unique model string transformations")

# --- 7. SHEET 8: DATA STATISTICS ---
stats_rows = [
    {'Metric': 'Physical Boxes', 'Value': len(clean_box_rows), 'Category': 'Physical Inventory'},
    {'Metric': 'Canonical Unique Models in Physical Boxes', 'Value': len(model_to_boxes_map), 'Category': 'Coverage'},
    {'Metric': 'Total Model-to-Box Relationships', 'Value': total_relationships_s1, 'Category': 'Relationships'},
    {'Metric': 'Unknown Research Groups (Total)', 'Value': len(df_s2_v2), 'Category': 'Research Groups'},
    {'Metric': 'Already Represented Unknown Groups', 'Value': len(already_represented_rows), 'Category': 'Reconciliation'},
    {'Metric': 'New Compatibility Unknown Groups', 'Value': len(new_compatibility_rows), 'Category': 'Reconciliation'},
    {'Metric': 'Identified Conflicts & Overlaps', 'Value': len(conflicts_rows), 'Category': 'Data Quality'},
    {'Metric': 'Multi-Box Models in Physical Inventory', 'Value': len(multi_box_models_s1), 'Category': 'Multi-Box Relationships'},
    {'Metric': 'Duplicate Names Removed Within Boxes', 'Value': duplicates_removed_count, 'Category': 'Normalization'}
]

df_stats = pd.DataFrame(stats_rows)
print("\nSheet 8 (DATA STATISTICS):")
print(df_stats.to_string())
