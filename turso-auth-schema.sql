-- ============================================================
-- UZEE TECH ScreenGuard Finder — Authentication Schema
-- Users & Password Reset Tokens
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user_id ON password_reset_tokens(user_id);
