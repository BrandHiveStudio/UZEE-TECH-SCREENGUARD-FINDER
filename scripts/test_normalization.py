import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('scripts/all_raw_models.json', 'r', encoding='utf-8') as f:
    raw_models = json.load(f)

def normalize_model(raw):
    m = raw.strip()
    
    # 1. Clean factory text annotations attached to model names
    m = re.sub(r'\s*\d*胶$', '', m)
    m = re.sub(r'\s*玻璃[\d\.]+MM$', '', m, flags=re.IGNORECASE)
    m = re.sub(r'\s*THICK\s+GLUE$', '', m, flags=re.IGNORECASE)

    # 2. Standardize brand prefixes & double brand prefixes
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

    # Implicit brand prefixes for Infinix / Tecno
    if re.match(r'^(HOT|SMART)\s+\d+', m, re.IGNORECASE):
        m = 'Infinix ' + m
    elif re.match(r'^(SPARK|POP)\s+\d+', m, re.IGNORECASE):
        m = 'Tecno ' + m

    # 3. Model keyword casing standardization
    def fix_casing(match):
        word = match.group(0).upper()
        mapping = {
            'PLUS': 'Plus',
            'PRO': 'Pro',
            'MINI': 'Mini',
            'MAX': 'Max',
            'LITE': 'Lite',
            'ULTRA': 'Ultra',
            'POWER': 'Power',
            'PRIME': 'Prime',
            'PLAY': 'Play',
            'NOTE': 'Note',
            'NEO': 'Neo',
            'ZOOM': 'Zoom',
            'MAGIC': 'Magic',
            'PIXEL': 'Pixel',
            'SMART': 'Smart',
            'SPARK': 'Spark',
            'HOT': 'Hot',
            'POP': 'Pop',
            'ENJOY': 'Enjoy',
            'YOUTH': 'Youth',
            'FE': 'FE',
            'GT': 'GT',
            'SE': 'SE',
            'INDIA': 'India',
            'CHINA': 'China',
            'GLOBAL': 'Global'
        }
        return mapping.get(word, match.group(0).capitalize())

    keywords = r'\b(PLUS|PRO|MINI|MAX|LITE|ULTRA|POWER|PRIME|PLAY|NOTE|NEO|ZOOM|MAGIC|PIXEL|SMART|SPARK|HOT|POP|ENJOY|YOUTH|FE|GT|SE|INDIA|CHINA|GLOBAL)\b'
    m = re.sub(keywords, fix_casing, m, flags=re.IGNORECASE)

    # Clean multi-spaces
    m = re.sub(r'\s+', ' ', m).strip()
    
    return m

mapping_log = {}
canonical_set = set()

for raw in raw_models:
    canon = normalize_model(raw)
    mapping_log[raw] = canon
    canonical_set.add(canon)

print(f"Total raw model strings: {len(raw_models)}")
print(f"Total unique canonical models after normalization: {len(canonical_set)}")

print("\n--- SAMPLE TRANSFORMATIONS (First 35) ---")
count = 0
for raw, canon in mapping_log.items():
    if raw != canon:
        print(f"  {raw:<35} → {canon}")
        count += 1
        if count >= 35:
            break
