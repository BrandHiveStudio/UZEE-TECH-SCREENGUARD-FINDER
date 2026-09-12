import pandas as pd
import json
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

# Read V2 Excel file
excel_v2 = 'UZEE_TECH_SUPER_D_BOX_MAPPING_ANALYSIS_V2.xlsx'
df_s1_v2 = pd.read_excel(excel_v2, sheet_name='VERIFIED EXISTING BOXES')
df_s2_v2 = pd.read_excel(excel_v2, sheet_name='NEW GROUPS — BOX UNKNOWN')

def normalize_model(raw):
    m = str(raw).strip()
    
    m = re.sub(r'\s*\d*胶$', '', m)
    m = re.sub(r'\s*玻璃[\d\.]+MM$', '', m, flags=re.IGNORECASE)
    m = re.sub(r'\s*THICK\s+GLUE$', '', m, flags=re.IGNORECASE)

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

# Analyze internal group duplicates across all 282 groups (S1 + S2)
total_raw_models_all = 0
total_canon_models_all = 0
group_duplicates_removed = 0
model_to_groups = {} # model -> list of group IDs

for idx, r in df_s1_v2.iterrows():
    gid = r['Physical Box Number']
    ms = [m.strip() for m in str(r['Compatible Models']).split(',') if m.strip()]
    total_raw_models_all += len(ms)
    
    seen = set()
    for m in ms:
        cm = normalize_model(m)
        if cm in seen:
            group_duplicates_removed += 1
        else:
            seen.add(cm)
            total_canon_models_all += 1
            model_to_groups.setdefault(cm, []).append(gid)

for idx, r in df_s2_v2.iterrows():
    gid = r['Research Group ID']
    ms = [m.strip() for m in str(r['Compatible Models']).split(',') if m.strip()]
    total_raw_models_all += len(ms)
    
    seen = set()
    for m in ms:
        cm = normalize_model(m)
        if cm in seen:
            group_duplicates_removed += 1
        else:
            seen.add(cm)
            total_canon_models_all += 1
            model_to_groups.setdefault(cm, []).append(gid)

multi_group_models = {m: g for m, g in model_to_groups.items() if len(g) > 1}
total_multi_group_occurrences = sum(len(g) for g in multi_group_models.values())

print(f"Total raw model string instances across 282 groups: {total_raw_models_all}")
print(f"Total internal duplicate model occurrences removed within groups: {group_duplicates_removed}")
print(f"Total canonical model-group relationships across 282 groups: {total_canon_models_all}")
print(f"Total unique canonical model names across 282 groups: {len(model_to_groups)}")
print(f"Models appearing across multiple groups: {len(multi_group_models)}")
print(f"Total model occurrences appearing across multiple groups: {total_multi_group_occurrences}")
