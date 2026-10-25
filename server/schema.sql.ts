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
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  // Staff System (2026-10-25): pre-existing databases gain the active flag
  // (deactivated staff lose access at login). No-op on fresh databases.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true`,
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
  // ---- Phase 6: jobs board + bidding (frontend shapes in src/lib/jobs.ts) ----
  `CREATE TABLE IF NOT EXISTS jobs (
    code TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    trade TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    budget_low BIGINT NOT NULL DEFAULT 0,
    budget_high BIGINT NOT NULL DEFAULT 0,
    customer_name TEXT NOT NULL DEFAULT '',
    customer_phone TEXT NOT NULL DEFAULT '',
    source_quote_code TEXT,
    status TEXT NOT NULL DEFAULT 'Open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status)`,
  `CREATE TABLE IF NOT EXISTS bids (
    id TEXT PRIMARY KEY,
    job_code TEXT NOT NULL,
    partner_code TEXT NOT NULL,
    partner_name TEXT NOT NULL DEFAULT '',
    amount BIGINT NOT NULL DEFAULT 0,
    days INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS bids_job_idx ON bids (job_code)`,
  `CREATE INDEX IF NOT EXISTS bids_partner_idx ON bids (partner_code)`,
  // ---- Phase 6: partner reviews (src/lib/reviews.ts) ----
  `CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    partner_code TEXT NOT NULL,
    customer_name TEXT NOT NULL DEFAULT '',
    rating INTEGER NOT NULL DEFAULT 5,
    text TEXT NOT NULL DEFAULT '',
    ref_code TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Published',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS reviews_partner_idx ON reviews (partner_code)`,
  // ---- Phase 6: notifications log (src/lib/notify.ts) ----
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    audience TEXT NOT NULL DEFAULT 'admin',
    ref_code TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL DEFAULT 'inapp',
    template_key TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'logged',
    phone TEXT,
    email TEXT,
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications (created_at DESC)`,
  // ---- Snap & Send jobs (src/lib/snapRequests.ts) ----
  // The full request record (photo/poster dataURLs, assessment, timeline)
  // lives in `data` jsonb; columns carry the queryable/commission fields.
  `CREATE TABLE IF NOT EXISTS snap_requests (
    code TEXT PRIMARY KEY,
    intent TEXT NOT NULL DEFAULT 'fix',
    status TEXT NOT NULL DEFAULT 'Received',
    customer_name TEXT NOT NULL DEFAULT '',
    customer_phone TEXT NOT NULL DEFAULT '',
    assigned_partner_code TEXT,
    total_ngn INTEGER NOT NULL DEFAULT 0,
    agreed_price_ngn INTEGER,
    commission_pct NUMERIC,
    commission_ngn INTEGER,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS snap_requests_partner_idx ON snap_requests (assigned_partner_code)`,
  `CREATE INDEX IF NOT EXISTS snap_requests_created_idx ON snap_requests (created_at DESC)`,
  // ---- Staff System (2026-10-25): activity log (src/lib/activity.ts) ----
  `CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    actor_name TEXT NOT NULL DEFAULT '',
    actor_role TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL DEFAULT '',
    ref_code TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS activity_created_idx ON activity_log (created_at DESC)`,
  // ---- Factory wing (2026-10-25): production pipeline (src/lib/production.ts) ----
  // Full job card in `data` jsonb (cutting list, QC record, checklist);
  // columns carry the queryable fields.
  `CREATE TABLE IF NOT EXISTS production_jobs (
    code TEXT PRIMARY KEY,
    order_code TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Queued',
    operator_name TEXT NOT NULL DEFAULT '',
    customer_name TEXT NOT NULL DEFAULT '',
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS production_order_idx ON production_jobs (order_code)`,
  `CREATE INDEX IF NOT EXISTS production_status_idx ON production_jobs (status)`,
  // ---- Stage S3 (2026-10-25): partner two-way flow — supply requests ----
  // Full request (incl. all partners' quotes) in `data` jsonb; partner reads
  // are stripped to their OWN quote server-side (records.supplyFromRow).
  `CREATE TABLE IF NOT EXISTS supply_requests (
    code TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'buy',
    item TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Open',
    chosen_partner_code TEXT,
    chosen_total_ngn INTEGER,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS supply_status_idx ON supply_requests (status)`,
];
export const SCHEMA_SQL = SCHEMA_STATEMENTS.join(";\n") + ";";
