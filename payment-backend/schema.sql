-- KEMP EYE 112 secure payment backend (Cloudflare D1)
-- Prices are deliberately NOT hard-coded here. Insert the approved amount for each stage before enabling live checkout.

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

-- Approved stage keys already used by KEMP EYE 112's normal lock system.
-- L1 covers Days 13-17; L2 Days 18-22; ...; L11 Days 63-67; L12-20 Days 68-112.
-- Replace the amounts below with the final commercial prices before enabling checkout.
INSERT OR IGNORE INTO stage_prices(stage_key, amount_paise, currency) VALUES
 ('L1', 1, 'INR'),
 ('L2', 1, 'INR'),
 ('L3', 1, 'INR'),
 ('L4', 1, 'INR'),
 ('L5', 1, 'INR'),
 ('L6', 1, 'INR'),
 ('L7', 1, 'INR'),
 ('L8', 1, 'INR'),
 ('L9', 1, 'INR'),
 ('L10', 1, 'INR'),
 ('L11', 1, 'INR'),
 ('L12-20', 1, 'INR');

-- The 1-paise seed values are intentionally unusable as commercial pricing.
-- Change them in D1 before production. The API rejects inactive/missing stages.
