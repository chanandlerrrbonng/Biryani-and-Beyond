-- ── Merchants ──
CREATE TABLE IF NOT EXISTS merchants (
  merchant_id   VARCHAR(50) PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Branches ──
CREATE TABLE IF NOT EXISTS branches (
  branch_id   VARCHAR(50) PRIMARY KEY,
  merchant_id VARCHAR(50) NOT NULL REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  city        VARCHAR(100),
  address     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Menu Items ──
CREATE TABLE IF NOT EXISTS menu_items (
  id            VARCHAR(50) PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  category      VARCHAR(50)  NOT NULL,
  emoji         VARCHAR(10),
  price         NUMERIC(10,2) NOT NULL,
  old_price     NUMERIC(10,2),
  rating        NUMERIC(3,2),
  prep_minutes  INTEGER,
  is_veg        BOOLEAN NOT NULL DEFAULT TRUE,
  popularity    INTEGER NOT NULL DEFAULT 0,
  badges        TEXT[]  NOT NULL DEFAULT '{}',
  featured      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Orders ──
CREATE TABLE IF NOT EXISTS orders (
  order_id        VARCHAR(50) PRIMARY KEY,
  branch_id       VARCHAR(50) NOT NULL REFERENCES branches(branch_id) ON DELETE RESTRICT,
  table_id        VARCHAR(50),
  customer_name   VARCHAR(255) NOT NULL,
  customer_phone  VARCHAR(20)  NOT NULL,
  customer_notes  TEXT,
  promo_code      VARCHAR(50),
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax             NUMERIC(10,2) NOT NULL DEFAULT 0,
  service         NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery        NUMERIC(10,2) NOT NULL DEFAULT 0,
  grand_total     NUMERIC(10,2) NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'placed' CHECK (status IN ('placed','confirmed','preparing','served','cancelled')),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Order Items ──
CREATE TABLE IF NOT EXISTS order_items (
  order_item_id SERIAL PRIMARY KEY,
  order_id      VARCHAR(50) NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  menu_item_id  VARCHAR(50) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  unit_price    NUMERIC(10,2) NOT NULL,
  qty           INTEGER NOT NULL CHECK (qty > 0),
  emoji         VARCHAR(10)
);

-- ── Seed initial branch data ──
INSERT INTO merchants (merchant_id, name, contact_email)
VALUES ('MERCH-NOQS-01', 'NoQs Digital Pvt Ltd', 'ops@noqs.in')
ON CONFLICT (merchant_id) DO NOTHING;

INSERT INTO branches (branch_id, merchant_id, name, city, address) VALUES
  ('BBSR-PURI-01',  'MERCH-NOQS-01', 'The Spice Garden – Puri Rd', 'Bhubaneswar', 'Puri Road, BBSR'),
  ('BBSR-PATIA-02', 'MERCH-NOQS-01', 'The Spice Garden – Patia',   'Bhubaneswar', 'Patia Square, BBSR')
ON CONFLICT (branch_id) DO NOTHING;