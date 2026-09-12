import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('src/data/screenguards.json', 'r', encoding='utf-8') as f:
    boxes = json.load(f)['boxes']

same_group_variations = []
suspicious_models = []

for b in boxes:
    gid = b['id']
    bnum = b['boxNumber']
    models = b['compatibleModels']

    # 1. Detect suspicious / incomplete model strings
    for m in models:
        # Check suspicious patterns:
        # - ends with '.' or truncated number like 'iPhone 17 Air 6.'
        # - generic brand-only strings like 'Samsung 5G', 'Tecno 5G'
        # - brand abbreviation prefixes like 'SAM A14', 'RM 13C', 'POC X5', etc.
        # - raw factory annotations attached (380胶, 0.25MM, THICK GLUE)
        if re.search(r'\d\.\s*$', m) or m.endswith('.'):
            suspicious_models.append({
                'gid': gid, 'bnum': bnum, 'model': m,
                'category': 'Truncated Screen Size / Truncated Model String',
                'reason': 'Raw text ends with period/decimal cutoff (e.g. 6.). Guessing exact display size or submodel name without spec sheet is unverified.',
                'action': 'KEEP AS-IS & FLAG FOR MANUAL REVIEW'
            })
        elif m in ['Samsung 5G', 'Tecno 5G']:
            suspicious_models.append({
                'gid': gid, 'bnum': bnum, 'model': m,
                'category': 'Broad Brand/Network String',
                'reason': 'Broad generic model entry representing 5G model family within group.',
                'action': 'KEEP AS-IS & FLAG FOR MANUAL REVIEW'
            })
        elif re.search(r'^(SAM|RM|POC|IP|OP|VO|REAL|1\+|XM)\b', m):
            suspicious_models.append({
                'gid': gid, 'bnum': bnum, 'model': m,
                'category': 'Unstandardized Brand Abbreviation',
                'reason': 'Raw supplier string uses abbreviated brand prefix (e.g., SAM, RM, POC, OP, VO). Search engine handles via alias mapping.',
                'action': 'KEEP AS-IS & FLAG FOR MANUAL REVIEW'
            })
        elif re.search(r'(380胶|THICK\s+GLUE|0\.25MM)', m, re.IGNORECASE):
            suspicious_models.append({
                'gid': gid, 'bnum': bnum, 'model': m,
                'category': 'Factory Annotation Text Attached',
                'reason': 'Contains supplier factory specification note (e.g., 380胶 glue specification).',
                'action': 'KEEP AS-IS & FLAG FOR MANUAL REVIEW'
            })

    # 2. Detect same-group naming variations
    # Look for models in the same group that differ only by 4G/5G suffix, spacing, or alias prefix
    norm_map = {}
    for m in models:
        key = m.lower()
        key = re.sub(r'^(samsung|sam|iphone|ip|redmi|rm|xiaomi|xm|oppo|op|vivo|vo|realme|real|poco|poc|oneplus|1\+)\s+', '', key)
        key = re.sub(r'\s*(4g|5g)\b', '', key)
        key = re.sub(r'\s+', '', key)
        norm_map.setdefault(key, []).append(m)

    for norm_key, m_list in norm_map.items():
        if len(m_list) > 1:
            same_group_variations.append({
                'gid': gid,
                'bnum': bnum,
                'models': m_list,
                'note': 'Subtle variant / 4G-5G dual entry / spacing variation within same compatibility group.'
            })

print(f"Suspicious/Incomplete Models Flagged: {len(suspicious_models)}")
print(f"Same-Group Naming Variation Sets Flagged: {len(same_group_variations)}")

report_data = {
    'suspicious_models': suspicious_models,
    'same_group_variations': same_group_variations
}

with open('scripts/data_qa_inspection_report.json', 'w', encoding='utf-8') as f:
    json.dump(report_data, f, indent=2, ensure_ascii=False)

print("Report saved to scripts/data_qa_inspection_report.json.")
