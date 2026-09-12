import openpyxl
import pandas as pd
import json
import os
import sys
import datetime

sys.stdout.reconfigure(encoding='utf-8')

print("==================================================")
print("1. LOADING AUTHORITATIVE MASTER WORKBOOK")
print("==================================================")

master_file = 'UZEE_TECH_SUPER_D_COMPLETE_EDITABLE_MASTER.xlsx'
df_import_ready = pd.read_excel(master_file, sheet_name='IMPORT READY')

print(f"✅ Loaded {len(df_import_ready)} groups from 'IMPORT READY'")

# Parse all 263 groups and 1,617 relationships
imported_boxes_json = []
sql_boxes_statements = []
sql_models_statements = []
total_imported_relationships = 0
all_models_unique_set = set()
multi_group_models_tracker = {}

for idx, r in df_import_ready.iterrows():
    gid = str(r['id']).strip()
    box_num = str(r['boxNumber']).strip()
    dsize = str(r['displaySize']).strip() if pd.notna(r['displaySize']) else "Unknown"
    title = str(r['title']).strip()
    source = str(r['source']).strip() if pd.notna(r['source']) else ""
    verif = str(r['verification']).strip() if pd.notna(r['verification']) else ""
    cat = str(r['category']).strip() if pd.notna(r['category']) else "Super-D"
    notes = str(r['notes']).strip() if pd.notna(r['notes']) else ""
    
    raw_models = str(r['compatibleModels'])
    if '|' in raw_models:
        ms = [m.strip() for m in raw_models.split('|') if m.strip()]
    else:
        ms = [m.strip() for m in raw_models.split(',') if m.strip()]
        
    total_imported_relationships += len(ms)
    
    for m in ms:
        all_models_unique_set.add(m)
        multi_group_models_tracker.setdefault(m, []).append(gid)
        
    imported_boxes_json.append({
        'id': gid,
        'boxNumber': box_num,
        'displaySize': dsize,
        'title': title,
        'compatibleModels': ms,
        'rawText': f"{title} — {', '.join(ms)}",
        'category': cat,
        'notes': notes,
        'source': source,
        'verification': verif
    })
    
    # Escape single quotes for SQL
    title_sql = title.replace("'", "''")
    dsize_sql = dsize.replace("'", "''")
    raw_sql = f"{title} — {', '.join(ms)}".replace("'", "''")
    cat_sql = cat.replace("'", "''")
    notes_sql = notes.replace("'", "''")
    source_sql = source.replace("'", "''")
    verif_sql = verif.replace("'", "''")
    
    sql_boxes_statements.append(
        f"  ('{gid}', '{box_num}', '{dsize_sql}', '{title_sql}', '{raw_sql}', '{cat_sql}', '{notes_sql}', '{source_sql}', '{verif_sql}')"
    )
    
    for m in ms:
        m_sql = m.replace("'", "''")
        sql_models_statements.append(f"  ('{gid}', '{m_sql}')")

# Calculate multi-group models count
multi_group_models_count = sum(1 for m, gids in multi_group_models_tracker.items() if len(gids) > 1)

print("\n==================================================")
print("2. UPDATE LOCAL JSON DATA (src/data/screenguards.json)")
print("==================================================")

json_data_new = {
    "version": "4.0-superd-master",
    "lastUpdated": datetime.datetime.now().strftime("%Y-%m-%d"),
    "totalBoxes": len(imported_boxes_json),
    "totalRelationships": total_imported_relationships,
    "uniqueModels": len(all_models_unique_set),
    "boxes": imported_boxes_json
}

with open('src/data/screenguards.json', 'w', encoding='utf-8') as f:
    json.dump(json_data_new, f, indent=2, ensure_ascii=False)

print("✅ Saved 263 groups to src/data/screenguards.json")

print("\n==================================================")
print("3. UPDATE SEED SQL SCRIPT (seed-data.sql)")
print("==================================================")

sql_content = f"""-- ============================================================
-- UZEE TECH ScreenGuard Finder -- Production Seed Data (Super-D Master)
-- Normalized 1-to-Many Schema (boxes & models)
-- Authoritative Dataset: 263 Groups, 1,617 Relationships, {len(all_models_unique_set)} Unique Models
-- ============================================================

-- Clear existing data safely
TRUNCATE TABLE models, boxes CASCADE;

-- 1. Insert 263 Super-D Compatibility Groups
INSERT INTO boxes (id, box_number, display_size, title, raw_text, category, notes, source, verification) VALUES
{',\\n'.join(sql_boxes_statements)};

-- 2. Insert 1,617 Compatible Model Relationships
INSERT INTO models (box_id, model_name) VALUES
{',\\n'.join(sql_models_statements)};

-- Verify counts
SELECT
  (SELECT COUNT(*) FROM boxes) AS total_groups,
  (SELECT COUNT(*) FROM models) AS total_relationships;
"""

with open('seed-data.sql', 'w', encoding='utf-8') as f:
    f.write(sql_content)

print("✅ Saved 263 groups & 1,617 relationships to seed-data.sql")

print("\n==================================================")
print("4. UPDATE SUPABASE SCHEMA (schema.sql)")
print("==================================================")

schema_content = """-- ============================================================
-- UZEE TECH ScreenGuard Finder — Supabase Database Schema
-- Normalized 1-to-Many Schema (boxes & models)
-- ============================================================

-- 1. Create boxes table
CREATE TABLE IF NOT EXISTS boxes (
  id           TEXT        PRIMARY KEY,
  box_number   TEXT        NOT NULL,
  display_size TEXT        NOT NULL DEFAULT 'Unknown',
  title        TEXT        NOT NULL DEFAULT '',
  raw_text     TEXT,
  category     TEXT        DEFAULT 'Super-D',
  notes        TEXT,
  source       TEXT,
  verification TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create models table (child table with foreign key to boxes)
CREATE TABLE IF NOT EXISTS models (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id      TEXT        NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  model_name  TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Auto-update updated_at trigger for boxes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS boxes_updated_at ON boxes;

CREATE TRIGGER boxes_updated_at
  BEFORE UPDATE ON boxes
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Public read boxes" ON boxes;
CREATE POLICY "Public read boxes"
  ON boxes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public write boxes" ON boxes;
CREATE POLICY "Public write boxes"
  ON boxes FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public read models" ON models;
CREATE POLICY "Public read models"
  ON models FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public write models" ON models;
CREATE POLICY "Public write models"
  ON models FOR ALL
  USING (true)
  WITH CHECK (true);

-- 6. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_boxes_box_number ON boxes (box_number);
CREATE INDEX IF NOT EXISTS idx_models_box_id ON models (box_id);
CREATE INDEX IF NOT EXISTS idx_models_model_name ON models (model_name);
"""

with open('schema.sql', 'w', encoding='utf-8') as f:
    f.write(schema_content)

print("✅ Saved updated schema to schema.sql")

print("\n==================================================")
print("5. IMPORT STATS SUMMARY")
print("==================================================")
print(f"Imported Groups: {len(imported_boxes_json)}")
print(f"Imported Relationships: {total_imported_relationships}")
print(f"Unique Models: {len(all_models_unique_set)}")
print(f"Multi-Group Models: {multi_group_models_count}")
