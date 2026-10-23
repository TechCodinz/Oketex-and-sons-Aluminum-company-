// Phase 5 API smoke tests — `npm run test:api`
// Bundles the REAL /api handlers + /server libs with esbuild, swapping only
// server/db for a pg-mem-backed mock, then drives the handlers with mock
// req/res objects. Proves: schema DDL, auth (bcrypt + JWT cookie), admin
// bootstrap, partners/leads/settings flows with server-side commission
// snapshots, and the Paystack webhook HMAC gate + payment effects.
// NOT covered (needs production env): live Neon transport, Paystack's live
// initialize/verify round-trip. See BUILD_NOTES.md Phase 5.
import { build } from "esbuild";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Env BEFORE importing the bundle (server modules read env at call time).
process.env.DATABASE_URL = "postgres://smoke:smoke@localhost:5432/smoke";
process.env.AUTH_SECRET = "smoke-test-secret-at-least-16-chars";
process.env.SETUP_SECRET = "smoke-setup-secret";
process.env.ADMIN_EMAIL = "admin@oketex.test";
process.env.ADMIN_PASSWORD = "admin-pass-123";
process.env.PAYSTACK_SECRET_KEY = "sk_test_smoke_secret";
process.env.PAYSTACK_PUBLIC_KEY = "pk_test_smoke_public";

const out = path.join(root, "scripts", ".smoke-dist", "bundle.mjs");
await build({
  entryPoints: [path.join(root, "scripts", "smoke-entry.ts")],
  bundle: true, platform: "node", format: "esm", target: "node20",
  outfile: out, external: ["pg-mem"], logLevel: "silent",
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  plugins: [{ name: "db-mock", setup(b) {
    // Redirect EVERY import of the server db module ("../server/db",
    // "../../server/db" and "./db" from inside server/) to the pg-mem mock.
    b.onResolve({ filter: /db$/ }, (args) => {
      if (/[/\\](server|api)[/\\]/.test(args.importer) || args.importer.endsWith("smoke-entry.ts")) {
        return { path: path.join(root, "scripts", "mock-db.mjs") };
      }
      return undefined;
    });
  } }],
});
const api = await import(out);

// ---------- tiny test kit ----------
let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ✗ ${name} ${extra}`); }
}
function mockReq({ method = "GET", url = "/", headers = {}, query = {}, body } = {}) {
  return { method, url, headers, query, body,
    async *[Symbol.asyncIterator]() { if (typeof body === "string") yield Buffer.from(body); } };
}
function mockRes() {
  return { statusCode: 200, headers: {}, body: "", headersSent: false,
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; },
    end(chunk) { this.body = chunk || ""; this.headersSent = true; } };
}
async function call(handler, opts) {
  const res = mockRes();
  await handler(mockReq(opts), res);
  let json = null; try { json = JSON.parse(res.body); } catch { /* not json */ }
  return { status: res.statusCode, json, headers: res.headers, raw: res.body };
}
const cookieOf = (r) => { const c = r.headers["set-cookie"]; return (Array.isArray(c) ? c[0] : c || "").split(";")[0]; };

// ---------- 1. Setup / schema DDL on pg-mem ----------
console.log("\n[1] POST /api/setup — schema DDL (pg-mem)");
let r = await call(api.setup, { method: "POST", headers: {} });
check("rejects missing setup secret (401)", r.status === 401, `got ${r.status}`);
r = await call(api.setup, { method: "POST", headers: { "x-setup-secret": "smoke-setup-secret" } });
check("applies schema with correct secret (200)", r.status === 200, `got ${r.status}: ${r.raw.slice(0, 200)}`);
check(`statements applied == SCHEMA_STATEMENTS (${api.SCHEMA_STATEMENTS.length})`, r.json?.statementsApplied === api.SCHEMA_STATEMENTS.length, `got ${r.json?.statementsApplied}`);
// NOTE on idempotency: every DDL statement is CREATE ... IF NOT EXISTS, which
// real Postgres/Neon treats as a no-op on re-run. pg-mem cannot re-apply
// CREATE TABLE IF NOT EXISTS over tables with literal defaults (planner
// limitation), so instead of a second setup call we assert the outcome a
// re-run must preserve: all 9 tables exist and stay writable.
const tbl = await api.dbQuery(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
check("all 9 tables exist after setup", ["users","partners","leads","bookings","orders","quotes","payments","settings","offers"].every(t => tbl.some(x => x.table_name === t)), tbl.map(x => x.table_name).join(","));

// ---------- 2. Health ----------
console.log("\n[2] GET /api/health");
r = await call(api.health, {});
check("ok:true db:true auth:true payments:true", r.json?.ok === true && r.json?.db === true && r.json?.auth === true && r.json?.payments === true, r.raw.slice(0, 160));

// ---------- 3. Auth: register / login / me / JWT ----------
console.log("\n[3] Auth — register, login, session cookie, JWT round-trip");
r = await call(api.register, { method: "POST", body: { name: "Smoke Customer", email: "cust@oketex.test", phone: "08030000000", password: "customer-pass-1" } });
check("register 201/200 with user", (r.status === 201 || r.status === 200) && r.json?.user?.email === "cust@oketex.test", `got ${r.status}: ${r.raw.slice(0, 160)}`);
const custCookie = cookieOf(r);
check("register sets oketex_session cookie", custCookie.startsWith("oketex_session="), custCookie.slice(0, 30));
r = await call(api.register, { method: "POST", body: { name: "Dupe", email: "cust@oketex.test", password: "whatever-123" } });
check("duplicate email rejected (409)", r.status === 409, `got ${r.status}`);
r = await call(api.login, { method: "POST", body: { email: "cust@oketex.test", password: "wrong-password" } });
check("wrong password rejected (401)", r.status === 401, `got ${r.status}`);
r = await call(api.login, { method: "POST", body: { email: "cust@oketex.test", password: "customer-pass-1" } });
check("login succeeds + cookie", r.status === 200 && cookieOf(r).startsWith("oketex_session="), `got ${r.status}`);
const loginCookie = cookieOf(r);
r = await call(api.me, { headers: { cookie: loginCookie } });
check("/auth/me returns the customer", r.status === 200 && r.json?.user?.role === "customer", `got ${r.status}: ${r.raw.slice(0, 120)}`);
r = await call(api.me, { headers: {} });
check("/auth/me without cookie → 401 {user:null}", r.status === 401 && r.json?.user === null, `got ${r.status}: ${r.raw.slice(0, 120)}`);
const token = await api.authLib.signSession({ id: 99, name: "T", email: "t@t.test", role: "admin" });
const round = await api.authLib.verifySessionToken(token);
check("JWT sign/verify round-trip", round?.email === "t@t.test" && round?.role === "admin");
const tampered = await api.authLib.verifySessionToken(token.slice(0, -2) + "xx");
check("tampered JWT rejected", tampered === null);
const hashed = await api.authLib.hashPassword("customer-pass-1");
check("bcrypt verify true/false", (await api.authLib.verifyPassword("customer-pass-1", hashed)) === true && (await api.authLib.verifyPassword("nope", hashed)) === false);

// ---------- 4. Admin bootstrap ----------
console.log("\n[4] Admin bootstrap (env ADMIN_EMAIL/ADMIN_PASSWORD)");
r = await call(api.login, { method: "POST", body: { email: "admin@oketex.test", password: "admin-pass-123" } });
check("bootstrap login returns role admin", r.status === 200 && r.json?.user?.role === "admin", `got ${r.status}: ${r.raw.slice(0, 140)}`);
const adminCookie = cookieOf(r);
r = await call(api.me, { headers: { cookie: adminCookie } });
check("/auth/me reflects bootstrap admin", r.json?.user?.role === "admin");

// ---------- 5. Partners lifecycle + admin gate ----------
console.log("\n[5] Partners — register → pending → admin approve → public list");
const partnerBody = { code: "PRT-2026-SMOKE", businessName: "Smoke Roofing Ltd", contactName: "S. Moke", phone: "08031112222", email: "smoke@partner.test", role: "pro", location: "Ibafo", trades: ["Roofing"], categories: [], areas: "Ibafo, Magboro", products: [], status: "pending", verified: false, featured: false, appliedAt: new Date().toISOString() };
r = await call(api.partners, { method: "POST", body: partnerBody });
check("partner POST accepted", r.status === 201 || r.status === 200, `got ${r.status}: ${r.raw.slice(0, 140)}`);
r = await call(api.partners, { method: "GET" });
check("public list hides pending partner", !(r.json?.partners || []).some(p => p.code === "PRT-2026-SMOKE"));
r = await call(api.adminPartners, { method: "PATCH", headers: { cookie: loginCookie }, body: { code: "PRT-2026-SMOKE", status: "approved" } });
check("non-admin PATCH rejected (401/403)", r.status === 401 || r.status === 403, `got ${r.status}`);
r = await call(api.adminPartners, { method: "PATCH", headers: { cookie: adminCookie }, body: { code: "PRT-2026-SMOKE", status: "approved" } });
check("admin PATCH approves", r.status === 200 && r.json?.partner?.status === "approved", `got ${r.status}: ${r.raw.slice(0, 140)}`);
r = await call(api.partners, { method: "GET" });
check("public list now includes approved partner", (r.json?.partners || []).some(p => p.code === "PRT-2026-SMOKE"));

// ---------- 6. Leads + server-side commission snapshot ----------
console.log("\n[6] Leads — commission snapshot from server-effective terms");
r = await call(api.leads, { method: "POST", body: { partnerCode: "PRT-2026-SMOKE", partnerName: "Smoke Roofing Ltd", type: "job", customerName: "Buyer One", customerPhone: "08033334444", description: "Full re-roof", estValueNgn: 1000000 } });
check("lead created at default 5% (₦50,000 on ₦1,000,000)", r.json?.lead?.commissionPct === 5 && r.json?.lead?.commissionNgn === 50000, r.raw.slice(0, 200));

// ---------- 7. Settings: admin PUT drives later snapshots ----------
console.log("\n[7] Settings — PUT (admin) then lead snapshot uses new terms");
r = await call(api.settings, { method: "PUT", headers: { cookie: loginCookie }, body: { partnerTerms: { referralCommissionPct: 9 } } });
check("non-admin PUT rejected (401/403)", r.status === 401 || r.status === 403, `got ${r.status}`);
r = await call(api.settings, { method: "PUT", headers: { cookie: adminCookie }, body: { partnerTerms: { referralCommissionPct: 9, verificationFeeNgn: 15000, featuredFeeNgn: 20000 } } });
check("admin PUT ok", r.status === 200, `got ${r.status}: ${r.raw.slice(0, 140)}`);
r = await call(api.settings, { method: "GET" });
check("GET returns live server settings (9%)", r.json?.live === true && r.json?.settings?.partnerTerms?.referralCommissionPct === 9, r.raw.slice(0, 160));
r = await call(api.leads, { method: "POST", body: { partnerCode: "PRT-2026-SMOKE", partnerName: "Smoke Roofing Ltd", type: "job", customerName: "Buyer Two", customerPhone: "08035556666", description: "Repairs", estValueNgn: 1000000 } });
check("new lead snapshots 9% (₦90,000)", r.json?.lead?.commissionPct === 9 && r.json?.lead?.commissionNgn === 90000, r.raw.slice(0, 200));

// ---------- 8. Orders / bookings / quotes ----------
console.log("\n[8] Orders, bookings, quotes");
r = await call(api.orders, { method: "POST", body: { code: "OKX-2026-SMOKE", name: "Buyer One", phone: "08033334444", email: "b1@test.ng", address: "1 Smoke St", items: [{ name: "Longspan sheet", unit: "per m", unitPriceNgn: 5000, quantity: 10, lineTotalNgn: 50000 }], totalNgn: 50000, status: "pending", createdAt: new Date().toISOString() } });
check("order POST accepted", r.status === 201 || r.status === 200, `got ${r.status}: ${r.raw.slice(0, 140)}`);
r = await call(api.orders, { method: "GET", query: { phone: "08033334444" } });
check("order found by phone", (r.json?.orders || []).some(o => o.code === "OKX-2026-SMOKE"));
r = await call(api.bookings, { method: "POST", body: { code: "BK-2026-SMOKE", serviceId: "measure", serviceLabel: "Site measurement", name: "Buyer One", phone: "08033334444", date: "2026-11-01", slot: "Morning", address: "1 Smoke St", buildingType: "Duplex", stage: "Roofing", status: "pending", createdAt: new Date().toISOString() } });
check("booking POST accepted", r.status === 201 || r.status === 200, `got ${r.status}: ${r.raw.slice(0, 140)}`);
r = await call(api.bookings, { method: "GET", query: { code: "BK-2026-SMOKE" } });
check("booking found by code", (r.json?.bookings || []).some(b => b.code === "BK-2026-SMOKE"));
r = await call(api.quotes, { method: "POST", body: { code: "Q-2026-SMOKE", name: "Buyer One", phone: "08033334444", roofType: "gable-longspan", areaM2: 120, estimateNgn: 1450000, status: "new", createdAt: new Date().toISOString() } });
check("quote POST accepted", r.status === 201 || r.status === 200, `got ${r.status}: ${r.raw.slice(0, 140)}`);
r = await call(api.quotes, { method: "GET", headers: { cookie: adminCookie } });
check("admin quote list includes it", (r.json?.quotes || []).some(q => q.code === "Q-2026-SMOKE"));

// ---------- 9. Payments: fail-closed + webhook HMAC + effects ----------
console.log("\n[9] Payments — fail-closed initialize, webhook signature gate, effects");
const savedKey = process.env.PAYSTACK_SECRET_KEY;
delete process.env.PAYSTACK_SECRET_KEY;
r = await call(api.payInit, { method: "POST", body: { email: "b1@test.ng", amountNgn: 15000, purpose: "partner_verification", refId: "PRT-2026-SMOKE" } });
check("initialize without secret → {enabled:false}", r.json?.enabled === false, r.raw.slice(0, 140));
process.env.PAYSTACK_SECRET_KEY = savedKey;
check("verifyPaystackSignature accepts a correct HMAC", (() => { const body = Buffer.from('{"event":"charge.success"}'); const sig = crypto.createHmac("sha512", savedKey).update(body).digest("hex"); return api.paystackLib.verifyPaystackSignature(body, sig) === true; })());
check("verifyPaystackSignature rejects a wrong HMAC", api.paystackLib.verifyPaystackSignature(Buffer.from('{"event":"charge.success"}'), "deadbeef") === false);
// Seed a pending payment row, then fire a correctly-signed webhook.
await api.dbQuery(`INSERT INTO payments (reference, purpose, ref_id, email, amount_kobo, status) VALUES ($1,$2,$3,$4,$5,'pending')`, ["SMOKE-REF-1", "partner_verification", "PRT-2026-SMOKE", "smoke@partner.test", 1500000]);
const hookBody = JSON.stringify({ event: "charge.success", data: { reference: "SMOKE-REF-1", amount: 1500000, status: "success" } });
const goodSig = crypto.createHmac("sha512", savedKey).update(hookBody).digest("hex");
r = await call(api.webhook, { method: "POST", headers: { "x-paystack-signature": "0".repeat(128) }, body: hookBody });
check("webhook rejects bad signature (401)", r.status === 401, `got ${r.status}`);
r = await call(api.webhook, { method: "POST", headers: { "x-paystack-signature": goodSig }, body: hookBody });
check("webhook accepts good signature (200)", r.status === 200 && r.json?.received === true, `got ${r.status}: ${r.raw.slice(0, 140)}`);
r = await call(api.partnerByCode, { method: "GET", query: {}, headers: {} , url: "/api/partners/PRT-2026-SMOKE" }, );
r = await call(api.partners, { method: "GET" });
check("effect applied: partner now verified", (r.json?.partners || []).some(p => p.code === "PRT-2026-SMOKE" && p.verified === true), r.raw.slice(0, 200));
// Idempotent replay must not error.
r = await call(api.webhook, { method: "POST", headers: { "x-paystack-signature": goodSig }, body: hookBody });
check("webhook replay is safe (200)", r.status === 200, `got ${r.status}`);
// Amount mismatch must NOT apply effects.
await api.dbQuery(`INSERT INTO payments (reference, purpose, ref_id, email, amount_kobo, status) VALUES ($1,$2,$3,$4,$5,'pending')`, ["SMOKE-REF-2", "partner_featured", "PRT-2026-SMOKE", "smoke@partner.test", 2000000]);
const badAmtBody = JSON.stringify({ event: "charge.success", data: { reference: "SMOKE-REF-2", amount: 999, status: "success" } });
const badAmtSig = crypto.createHmac("sha512", savedKey).update(badAmtBody).digest("hex");
r = await call(api.webhook, { method: "POST", headers: { "x-paystack-signature": badAmtSig }, body: badAmtBody });
r = await call(api.partners, { method: "GET" });
check("amount mismatch: featured NOT applied", !(r.json?.partners || []).some(p => p.code === "PRT-2026-SMOKE" && p.featured === true));

console.log(`\nSMOKE RESULT: ${pass} passed, ${fail} failed${fail ? " — failures: " + failures.join("; ") : ""}`);
process.exit(fail ? 1 : 0);
