import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('src/data/screenguards.json', 'r', encoding='utf-8') as f:
    boxes = json.load(f)['boxes']

BRAND_ALIASES = {
    'ip': ['iphone'], 'iphone': ['ip'],
    'sam': ['samsung', 'galaxy'], 'samsung': ['sam', 'galaxy'], 'galaxy': ['sam', 'samsung'],
    'rm': ['redmi', 'xiaomi'], 'redmi': ['rm', 'xiaomi'], 'xiaomi': ['rm', 'redmi', 'xm'],
    'op': ['oppo'], 'oppo': ['op'],
    'vo': ['vivo'], 'vivo': ['vo'],
    '1+': ['oneplus'], 'oneplus': ['1+'],
    'real': ['realme'], 'realme': ['real'],
    'xm': ['xiaomi', 'redmi'],
    'poc': ['poco'], 'poco': ['poc'],
    'moto': ['motorola'], 'motorola': ['moto']
}

def normalize_text(text):
    # Lowercase, remove punctuation except spaces and alphanumerics
    t = text.lower()
    # Normalize S24 FE -> S24FE for model token comparison
    t = re.sub(r'\b(s|a|m|n|x|z|g|y|t|c|v|f|p|r|e|k|i|q|b)(\d+)\s*(fe|pro|plus|max|lite|ultra|gt|se|neo|5g|4g|i|s|g|t|c)\b', r'\1\2 \3', t)
    return t

def match_model(query, model):
    q_norm = normalize_text(query)
    m_norm = normalize_text(model)

    q_tokens = q_norm.split()
    m_tokens = m_norm.split()

    # Handle brand
    q_brands = set()
    q_non_brands = []
    for t in q_tokens:
        if t in BRAND_ALIASES:
            q_brands.add(t)
            q_brands.update(BRAND_ALIASES[t])
        else:
            q_non_brands.append(t)

    # If brand specified in query, model MUST contain at least one brand alias or brand token
    if q_brands:
        m_has_brand = any(b in m_norm for b in q_brands)
        if not m_has_brand:
            return False

    if not q_non_brands:
        # Query only contained brand e.g. "SAMSUNG" -> return True
        return True

    # Join non-brand tokens without spaces e.g. ["s24", "fe", "5g"] -> "s24fe5g"
    # Also compare token by token with word boundary or letter-number boundary
    # e.g., "a06" should match "a06", "a06 4g", "a06 5g", but not "a060" or "a05s"
    
    # Check each non-brand query token against model
    for qt in q_non_brands:
        # Regex check: qt followed by word boundary OR non-digit if qt ends in digit
        # e.g. qt='a06' -> \ba06(?!\d)  Matches 'a06', 'a06 4g', 'a06s', but NOT 'a060'
        # e.g. qt='y20' -> \by20(?!\d)  Matches 'y20', 'y20 2021', 'y20g', 'y20i', but NOT 'y200'
        
        pattern = r'\b' + re.escape(qt)
        if re.search(r'\d$', qt):
            pattern += r'(?!\d)'
        else:
            pattern += r'\b'
        
        # Check against both spaced and unspaced model string
        m_unspaced = m_norm.replace(' ', '')
        qt_unspaced = qt.replace(' ', '')
        
        matched_tok = False
        if re.search(pattern, m_norm):
            matched_tok = True
        elif re.search(r'\b' + re.escape(qt_unspaced) + (r'(?!\d)' if re.search(r'\d$', qt_unspaced) else r'\b'), m_unspaced):
            matched_tok = True

        if not matched_tok:
            return False

    return True

test_queries = [
    'Samsung A06',
    'SAM A06',
    'Redmi 13C',
    'RM 13C',
    'Vivo Y20',
    'VO Y20',
    'POCO C65',
    'POC C65',
    'iPhone 16',
    'IP 16',
    'Samsung S24 FE 5G',
    'SAM S24FE 5G',
    'TECNO 5G'
]

print("=== SEARCH PRECISION TEST RESULTS ===")
for q in test_queries:
    matched_groups = []
    for b in boxes:
        matched_models = [m for m in b['compatibleModels'] if match_model(q, m)]
        if matched_models:
            matched_groups.append((b['id'], b['boxNumber'], b['title'], matched_models))

    print(f"\nQuery: '{q}' -> {len(matched_groups)} matched groups:")
    for gid, bnum, title, m_list in matched_groups:
        print(f"  [{gid} / {bnum}] {title[:40]:<40} -> Matched: {m_list[:3]}")
