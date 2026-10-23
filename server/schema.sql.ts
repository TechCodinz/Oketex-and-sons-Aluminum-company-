// Full DDL for the Oketex production backend — applied idempotently by
// POST /api/setup (guarded by SETUP_SECRET). Record shapes mirror the
// frontend localStorage stores (src/lib/storage.ts, proStorage.ts,
// partnerStorage.ts): partners keep their wide payload in `data` jsonb with
// core/queryable fields as columns; orders keep line items in `items` jsonb.
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    email TEXT UNIQUE NOT NULL,
    phone TEXT DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer',
    partner_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS partners (
    code TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'pro',
    business_name TEXT NOT NULL DEFAULT '',
    contact_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT,
    location TEXT NOT NULL DEFAULT '',
    areas TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    verified BOOLEAN NOT NULL DEFAULT false,
    featured BOOLEAN NOT NULL DEFAULT false,
    featured_until TIMESTAMPTZ,
    sample BOOLEAN NOT NULL DEFAULT false,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS partners_status_idx ON partners (status)`,
  `CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    partner_code TEXT NOT NULL,
    partner_name TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'job',
    customer_name TEXT NOT NULL DEFAULT '',
    customer_phone TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    est_value_ngn INTEGER NOT NULL DEFAULT 0,
    commission_pct NUMERIC NOT NULL DEFAULT 5,
    commission_ngn INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS leads_partner_idx ON leads (partner_code)`,
  `CREATE TABLE IF NOT EXISTS bookings (
    code TEXT PRIMARY KEY,
    service TEXT NOT NULL DEFAULT '',
    service_label TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL DEFAULT '',
    slot TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    lga_state TEXT NOT NULL DEFAULT '',
    building_type TEXT NOT NULL DEFAULT '',
    stage TEXT NOT NULL DEFAULT '',
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    deposit_paid BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS bookings_phone_idx ON bookings (phone)`,
  `CREATE TABLE IF NOT EXISTS orders (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT,
    address TEXT NOT NULL DEFAULT '',
    note TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_ngn INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    paid BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders (phone)`,
  `CREATE TABLE IF NOT EXISTS quotes (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT,
    note TEXT,
    roof_type TEXT NOT NULL DEFAULT '',
    colour TEXT,
    area_m2 NUMERIC NOT NULL DEFAULT 0,
    estimate_ngn INTEGER NOT NULL DEFAULT 0,
    boq_summary TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    reference TEXT PRIMARY KEY,
    purpose TEXT NOT NULL DEFAULT '',
    ref_id TEXT,
    email TEXT,
    amount_kobo BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY,
    product_name TEXT NOT NULL DEFAULT '',
    price_ngn INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    audience TEXT NOT NULL DEFAULT 'all',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];
export const SCHEMA_SQL = SCHEMA_STATEMENTS.join(";\n") + ";";
