-- KEMP EYE 112 secure payment backend (Cloudflare D1)
-- Pricing is intentionally configured separately before production.

CREATE TABLE IF NOT EXISTS stage_prices (
  stage_key TEXT PRIMARY KEY,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  stage_key TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL,
  checkout_token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'created',
  payment_id TEXT,
  access_token_hash TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);

CREATE TABLE IF NOT EXISTS processed_events (
  event_id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  processed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_checkout_token ON orders(checkout_token_hash);
CREATE INDEX IF NOT EXISTS idx_orders_payment_id ON orders(payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_access_token ON orders(access_token_hash);

-- KEMP EYE 112 stage keys. Populate stage_prices with the final approved
-- commercial amounts before enabling checkout.
-- L1 = Days 13-17
-- L2 = Days 18-22
-- L3 = Days 23-27
-- L4 = Days 28-32
-- L5 = Days 33-37
-- L6 = Days 38-42
-- L7 = Days 43-47
-- L8 = Days 48-52
-- L9 = Days 53-57
-- L10 = Days 58-62
-- L11 = Days 63-67
-- L12-20 = Days 68-112

-- Example only (DO NOT copy to production until the final prices are approved):
-- INSERT INTO stage_prices(stage_key, amount_paise, currency) VALUES
-- ('L1', 33300, 'INR');
