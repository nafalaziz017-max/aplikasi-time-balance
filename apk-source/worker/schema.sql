-- TimeBalance — skema database Cloudflare D1. Aman dijalankan berulang (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  pass_hash     TEXT NOT NULL,
  pass_salt     TEXT NOT NULL,
  premium_until INTEGER NOT NULL DEFAULT 0,   -- ms epoch; 0 = belum pernah berlangganan
  premium_plan  TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL,
  last_login    INTEGER NOT NULL DEFAULT 0,
  login_count   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,                -- SHA-256 dari token (token asli tidak disimpan)
  user_id    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- status: pending (menunggu bayar) | waiting (pengguna klik "sudah bayar", menunggu admin)
--         paid | rejected | expired | failed | cancelled
CREATE TABLE IF NOT EXISTS orders (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  plan        TEXT NOT NULL,
  base_amount INTEGER NOT NULL,
  amount      INTEGER NOT NULL,               -- nominal yang harus dibayar (termasuk kode unik)
  method      TEXT NOT NULL,                  -- manual | midtrans
  status      TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  paid_at     INTEGER,
  note        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at);

-- pembatas percobaan (anti tebak kata sandi)
CREATE TABLE IF NOT EXISTS attempts (
  key      TEXT PRIMARY KEY,
  n        INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
