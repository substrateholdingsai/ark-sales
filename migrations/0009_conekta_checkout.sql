-- 0009_conekta_checkout.sql: Conekta SPEI STP & Hosted Checkout integration
-- Registro de ordenes de pago, CLABEs interbancarias y estado de cobranza

CREATE TABLE IF NOT EXISTS sales_payment_orders (
  id TEXT PRIMARY KEY,
  lead_id TEXT,
  account_id TEXT,
  opportunity_id TEXT,
  contact_id TEXT,
  conekta_order_id TEXT UNIQUE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled', 'failed')),
  payment_method_type TEXT NOT NULL CHECK (payment_method_type IN ('spei', 'checkout')),
  spei_clabe TEXT,
  spei_bank TEXT DEFAULT 'STP',
  checkout_url TEXT,
  checkout_id TEXT,
  paid_at TIMESTAMP,
  raw_response_json TEXT,
  metadata_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES sales_leads(id) ON DELETE SET NULL,
  FOREIGN KEY (account_id) REFERENCES sales_accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (opportunity_id) REFERENCES sales_opportunities(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_payment_orders_status ON sales_payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_payment_orders_conekta_id ON sales_payment_orders(conekta_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_payment_orders_lead ON sales_payment_orders(lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_payment_orders_opp ON sales_payment_orders(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_sales_payment_orders_acc ON sales_payment_orders(account_id);
CREATE INDEX IF NOT EXISTS idx_sales_payment_orders_created ON sales_payment_orders(created_at);
