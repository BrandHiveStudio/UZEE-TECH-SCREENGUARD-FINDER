-- ============================================================
-- UZEE TECH ScreenGuard Finder — Turso (libSQL/SQLite) Schema
-- Normalized Schema + Inventory Management System
-- ============================================================

-- 1. Create boxes table
CREATE TABLE IF NOT EXISTS boxes (
  id                   TEXT PRIMARY KEY,
  box_number           TEXT NOT NULL,
  display_size         TEXT NOT NULL DEFAULT 'Unknown',
  title                TEXT NOT NULL DEFAULT '',
  raw_text             TEXT,
  category             TEXT DEFAULT 'Super-D',
  notes                TEXT,
  source               TEXT,
  verification         TEXT,
  stock_quantity       INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  stock_count_verified INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at           TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 2. Create models table (child table with foreign key to boxes)
CREATE TABLE IF NOT EXISTS models (
  id          TEXT PRIMARY KEY,
  box_id      TEXT NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  model_name  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 3. Create inventory_transactions table (audit log of stock changes)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id                TEXT PRIMARY KEY,
  group_id          TEXT NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  transaction_type  TEXT NOT NULL CHECK (transaction_type IN ('SALE', 'RESTOCK', 'ADJUSTMENT', 'INITIAL_STOCK')),
  quantity_change   INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity      INTEGER NOT NULL,
  box_number        TEXT NOT NULL,
  note              TEXT,
  created_at        TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 4. Create purchase_list table (ordering queue)
CREATE TABLE IF NOT EXISTS purchase_list (
  id                 TEXT PRIMARY KEY,
  group_id           TEXT NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  requested_quantity INTEGER NOT NULL DEFAULT 1 CHECK (requested_quantity > 0),
  status             TEXT NOT NULL DEFAULT 'NEEDS ORDER' CHECK (status IN ('NEEDS ORDER', 'ORDERED', 'RECEIVED', 'CANCELLED')),
  note               TEXT,
  created_at         TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at         TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_boxes_box_number ON boxes (box_number);
CREATE INDEX IF NOT EXISTS idx_models_box_id ON models (box_id);
CREATE INDEX IF NOT EXISTS idx_models_model_name ON models (model_name);
CREATE INDEX IF NOT EXISTS idx_inventory_group_id ON inventory_transactions (group_id);
CREATE INDEX IF NOT EXISTS idx_purchase_group_id ON purchase_list (group_id);
