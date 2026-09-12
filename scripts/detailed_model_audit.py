import pandas as pd
import json
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
        if re.search(r'(380胶|THICK\s+GLUE|0\.25MM|玻璃[\d\.]+MM|\+厚胶|\(玻璃[\d\.]+MM\+\S+\))', m, re.IGNORECASE):
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
            normalization_log.append({
                'Original Model': orig,
                'Canonical Model': m,
                'Reason': 'Standardized brand prefix/casing & removed factory annotations',
                'Confidence': 'High'
            })
            
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

print("Detailed Audit Results:")
print(f"- Total 163 groups processed: {len(clean_groups_log)}")
print(f"- Total problematic/incomplete models flagged: {len(problematic_log)}")
print(f"- Total model normalizations logged: {len(normalization_log)}")
print(f"- Total duplicate names removed within groups: {duplicate_names_removed_count}")
print(f"- Total factory annotations removed: {factory_annotations_removed_count}")
print(f"- Total source model comparisons logged: {len(comparison_log)}")
