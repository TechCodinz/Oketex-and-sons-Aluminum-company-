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
    b.onResolve({ filter: /db(\.js)?$/ }, (args) => {
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
check("all 19 tables exist after setup", ["users","partners","leads","bookings","orders","quotes","payments","settings","offers","jobs","bids","reviews","notifications","snap_requests","activity_log","production_jobs","supply_requests","knowledge_entries","source_requests"].every(t => tbl.some(x => x.table_name === t)), tbl.map(x => x.table_name).join(","));

// ---------- 2. Health ----------
console.log("\n[2] GET /api/health");
r = await call(api.health, {});
check("ok:true db:true auth:true payments:true ai:false (no vision env)", r.json?.ok === true && r.json?.db === true && r.json?.auth === true && r.json?.payments === true && r.json?.ai === false, r.raw.slice(0, 160));

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

// ---------- 5b. Partner contact masking (Admin-Routing) ----------
console.log("\n[5b] Partners — public responses strip phone/email; admin + owner phone-proof retain");
r = await call(api.partners, { method: "GET" });
const pubPartner = (r.json?.partners || []).find(p => p.code === "PRT-2026-SMOKE");
check("public list strips partner phone + email", !!pubPartner && pubPartner.phone === "" && !pubPartner.email, JSON.stringify(pubPartner).slice(0, 200));
r = await call(api.partnerByCode, { method: "GET", query: { code: "PRT-2026-SMOKE" } });
check("public detail (no proof) strips phone + email", r.json?.partner?.phone === "" && !r.json?.partner?.email, r.raw.slice(0, 160));
r = await call(api.partnerByCode, { method: "GET", query: { code: "PRT-2026-SMOKE", phone: "08039998888" } });
check("detail with WRONG phone still strips contact", r.json?.partner?.phone === "", r.raw.slice(0, 160));
r = await call(api.partnerByCode, { method: "GET", query: { code: "PRT-2026-SMOKE", phone: "08031112222" } });
check("detail with owner phone-proof retains full contact", r.json?.partner?.phone === "08031112222" && r.json?.partner?.email === "smoke@partner.test", r.raw.slice(0, 160));
r = await call(api.adminPartners, { method: "GET", headers: { cookie: adminCookie } });
const admPartner = (r.json?.partners || []).find(p => p.code === "PRT-2026-SMOKE");
check("admin list retains partner phone + email", admPartner?.phone === "08031112222" && admPartner?.email === "smoke@partner.test", JSON.stringify(admPartner).slice(0, 200));
// Kind tags (2026-10-26): kindTags ride the jsonb record through create →
// public list/detail — public-safe (shown in the directory), while the
// phone stays stripped.
r = await call(api.partners, { method: "POST", body: { ...partnerBody, code: "PRT-2026-KINDS", businessName: "Kinds Wholesale Ltd", email: "kinds@partner.test", phone: "08032223333", kindTags: ["Materials Seller", "Wholesaler", "Retailer"] } });
check("partner with kindTags registers", r.status === 201 || r.status === 200, `got ${r.status}: ${r.raw.slice(0, 140)}`);
await call(api.adminPartners, { method: "PATCH", headers: { cookie: adminCookie }, body: { code: "PRT-2026-KINDS", status: "approved" } });
r = await call(api.partners, { method: "GET" });
const pubKinds = (r.json?.partners || []).find(p => p.code === "PRT-2026-KINDS");
check("public list carries kindTags but still strips phone", !!pubKinds && Array.isArray(pubKinds.kindTags) && pubKinds.kindTags.includes("Wholesaler") && pubKinds.kindTags.includes("Retailer") && pubKinds.phone === "", JSON.stringify(pubKinds).slice(0, 240));
r = await call(api.partnerByCode, { method: "GET", query: { code: "PRT-2026-KINDS" } });
check("public detail carries kindTags", Array.isArray(r.json?.partner?.kindTags) && r.json.partner.kindTags.length === 3, r.raw.slice(0, 200));

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

// ---------- 10. Jobs board + bidding + award → lead (Phase 6) ----------
console.log("\n[10] Jobs — post, public board privacy, bids, award creates lead with commission snapshot");
r = await call(api.jobs, { method: "POST", body: { code: "JB-2026-SMOKE", title: "Re-roof a 4-bed duplex", trade: "Roofer", description: "Remove old sheets, supply + install longspan 0.55", location: "Sangotedo, Lagos", budgetLow: 1500000, budgetHigh: 2200000, customerName: "Buyer One", customerPhone: "08033334444" } });
check("job POST accepted (201)", r.status === 201 && r.json?.job?.status === "Open", `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.jobs, { method: "GET" });
const boardJob = (r.json?.jobs || []).find(j => j.code === "JB-2026-SMOKE");
check("public board lists the Open job", !!boardJob);
check("public board strips the customer phone", boardJob && boardJob.customerPhone === "", JSON.stringify(boardJob).slice(0, 160));
r = await call(api.jobsBid, { method: "POST", body: { jobCode: "JB-2026-SMOKE", partnerCode: "PRT-2026-SMOKE", amount: 2000000, days: 10, note: "Crew of 4, materials included" } });
check("approved partner bid accepted", (r.status === 201 || r.status === 200) && r.json?.bid?.status === "Pending", `got ${r.status}: ${r.raw.slice(0, 160)}`);
const smokeBidId = r.json?.bid?.id;
// A second partner must exist to prove losing bids get Rejected.
const partner2 = { ...partnerBody, code: "PRT-2026-SMOKE2", businessName: "Second Roofing Co", email: "two@partner.test" };
await call(api.partners, { method: "POST", body: partner2 });
await call(api.adminPartners, { method: "PATCH", headers: { cookie: adminCookie }, body: { code: "PRT-2026-SMOKE2", status: "approved" } });
r = await call(api.jobsBid, { method: "POST", body: { jobCode: "JB-2026-SMOKE", partnerCode: "PRT-2026-SMOKE2", amount: 2100000, days: 12, note: "" } });
check("second partner bid accepted", (r.status === 201 || r.status === 200) && !!r.json?.bid?.id, `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.jobsBid, { method: "POST", body: { jobCode: "JB-2026-SMOKE", partnerCode: "PRT-2026-NOPE", amount: 100, days: 1 } });
check("bid from unknown partner rejected (404)", r.status === 404, `got ${r.status}`);
r = await call(api.jobs, { method: "GET", query: { code: "JB-2026-SMOKE" } });
check("code lookup without phone proof stays phone-safe", r.json?.job?.customerPhone === "" && (r.json?.bids || []).length === 2, r.raw.slice(0, 160));
r = await call(api.jobs, { method: "GET", query: { code: "JB-2026-SMOKE", phone: "08033334444" } });
check("code lookup with matching phone reveals phone + bids", r.json?.job?.customerPhone === "08033334444" && (r.json?.bids || []).length === 2, r.raw.slice(0, 160));
// Effective commission is whatever the settings section set earlier (9%).
r = await call(api.settings, { method: "GET" });
const effPct = r.json?.settings?.partnerTerms?.referralCommissionPct;
r = await call(api.jobsAward, { method: "POST", body: { jobCode: "JB-2026-SMOKE", bidId: smokeBidId } });
check("award succeeds", r.status === 200 && r.json?.job?.status === "Awarded", `got ${r.status}: ${r.raw.slice(0, 200)}`);
check("winner bid Accepted, loser Rejected", (r.json?.bids || []).filter(b => b.status === "Accepted").length === 1 && (r.json?.bids || []).filter(b => b.status === "Rejected").length === 1, r.raw.slice(0, 200));
check("award creates lead with commission snapshot at effective terms", r.json?.lead?.partnerCode === "PRT-2026-SMOKE" && r.json?.lead?.estValueNgn === 2000000 && r.json?.lead?.commissionPct === effPct && r.json?.lead?.commissionNgn === Math.round(2000000 * effPct / 100), r.raw.slice(0, 240));
r = await call(api.jobsAward, { method: "POST", body: { jobCode: "JB-2026-SMOKE", bidId: smokeBidId } });
check("re-award of a closed job rejected (409)", r.status === 409, `got ${r.status}`);
r = await call(api.jobs, { method: "PATCH", headers: { cookie: loginCookie }, body: { code: "JB-2026-SMOKE", status: "Closed" } });
check("non-admin job moderation rejected (401)", r.status === 401, `got ${r.status}`);
r = await call(api.jobs, { method: "PATCH", headers: { cookie: adminCookie }, body: { code: "JB-2026-SMOKE", status: "Closed" } });
check("admin closes the job", r.status === 200 && r.json?.job?.status === "Closed", `got ${r.status}`);

// ---------- 11. Reviews (Phase 6) ----------
console.log("\n[11] Reviews — create, summary average, moderation");
const mkReview = (rating, name) => call(api.reviews, { method: "POST", body: { partnerCode: "PRT-2026-SMOKE", customerName: name, rating, text: `Rated ${rating}`, refCode: "JB-2026-SMOKE" } });
r = await mkReview(5, "Rev One"); check("review 5★ created", r.status === 201, `got ${r.status}: ${r.raw.slice(0, 140)}`);
await mkReview(4, "Rev Two");
r = await mkReview(4, "Rev Three");
const thirdReviewId = r.json?.review?.id;
r = await call(api.reviews, { method: "POST", body: { partnerCode: "PRT-2026-SMOKE", customerName: "No Ref", rating: 5, text: "x" } });
check("review without refCode rejected (400)", r.status === 400, `got ${r.status}`);
r = await call(api.reviews, { method: "GET", query: { partnerCode: "PRT-2026-SMOKE" } });
check("summary: 3 published, avg 4.3 (5,4,4)", r.json?.summary?.count === 3 && r.json?.summary?.avg === 4.3, r.raw.slice(0, 160));
r = await call(api.reviews, { method: "PATCH", headers: { cookie: adminCookie }, body: { id: thirdReviewId, status: "Hidden" } });
check("admin hides a review", r.status === 200 && r.json?.review?.status === "Hidden", `got ${r.status}`);
r = await call(api.reviews, { method: "GET", query: { partnerCode: "PRT-2026-SMOKE" } });
check("summary after hide: 2 published, avg 4.5", r.json?.summary?.count === 2 && r.json?.summary?.avg === 4.5, r.raw.slice(0, 160));
r = await call(api.reviews, { method: "DELETE", headers: { cookie: adminCookie }, query: { id: thirdReviewId } });
check("admin deletes the hidden review", r.status === 200, `got ${r.status}`);

// ---------- 12. Notifications + dispatch honesty + AI slot (Phase 6) ----------
console.log("\n[12] Notifications — log, admin list, dispatch without providers stays logged; AI assist disabled");
r = await call(api.notifications, { method: "POST", body: { id: "NTF-SMOKE1", audience: "admin", refCode: "BK-2026-SMOKE", channel: "sms", templateKey: "booking_created", message: "New booking BK-2026-SMOKE at Oketex & Sons Aluminum Co.", status: "queued", phone: "08033334444" } });
check("notification logged (201)", r.status === 201 && r.json?.notification?.status === "queued", `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.notifications, { method: "GET", headers: { cookie: loginCookie } });
check("notification list is admin-only (401)", r.status === 401, `got ${r.status}`);
r = await call(api.notifications, { method: "GET", headers: { cookie: adminCookie } });
check("admin sees the notification", (r.json?.notifications || []).some(n => n.id === "NTF-SMOKE1"), r.raw.slice(0, 160));
r = await call(api.notificationsDispatch, { method: "POST", headers: { cookie: adminCookie }, body: {} });
check("dispatch with no provider keys → enabled:false, nothing sent", r.json?.enabled === false && r.json?.sent === 0, r.raw.slice(0, 200));
r = await call(api.notifications, { method: "GET", headers: { cookie: adminCookie } });
check("record stays queued/logged after no-provider dispatch", (r.json?.notifications || []).find(n => n.id === "NTF-SMOKE1")?.status === "queued");
r = await call(api.aiAssist, { method: "POST", body: { imageDataUrl: "data:image/png;base64,AAAA" } });
check("AI assist without env → {enabled:false}", r.status === 200 && r.json?.enabled === false, `got ${r.status}: ${r.raw.slice(0, 140)}`);

// ---------- 13. Snap & Send (create → assess → approve → assign → partner flow) ----------
console.log("\n[13] Snap & Send — create, privacy, assess totals, unapproved assign 400, commission on AGREED price, partner progress");
r = await call(api.snapRequests, { method: "POST", body: { code: "SR-2026-SMOKE", intent: "fix", mediaType: "photo", photo: null, videoPoster: null, videoNote: "", description: "Roof leaking at the ridge over the sitting room", address: "12 Test Street, Ibafo, Ogun State", geo: { lat: 6.7349, lng: 3.4274 }, customerName: "Snap Tester", customerPhone: "08035556666", urgency: "Urgent" } });
check("snap request created (201, Received)", r.status === 201 && r.json?.request?.status === "Received", `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.snapRequests, { method: "GET", query: { code: "SR-2026-SMOKE" } });
check("code lookup without phone proof strips the phone", r.json?.request?.customerPhone === "", r.raw.slice(0, 160));
check("geo round-trips through storage", r.json?.request?.geo?.lat === 6.7349 && r.json?.request?.geo?.lng === 3.4274, r.raw.slice(0, 160));
r = await call(api.snapRequests, { method: "GET", query: { code: "SR-2026-SMOKE", phone: "08035556666" } });
check("phone proof reveals the phone", r.json?.request?.customerPhone === "08035556666", r.raw.slice(0, 160));
const snapAssessment = { items: [{ name: "Longspan sheet 0.45mm", qty: 2, unitPrice: 6500 }], workmanshipNgn: 25000, transportNgn: 8000, dispatchNgn: 2500, notes: "Ridge repair", tools: ["Ladder", "Drill machine", "Sealant gun"] };
r = await call(api.snapAssess, { method: "POST", body: { code: "SR-2026-SMOKE", assessment: snapAssessment } });
check("assess without admin rejected (401)", r.status === 401, `got ${r.status}`);
r = await call(api.snapAssess, { method: "POST", headers: { cookie: adminCookie }, body: { code: "SR-2026-SMOKE", assessment: snapAssessment } });
check("assess → Priced, server total ₦48,500 (13,000 + 25,000 + 8,000 + 2,500)", r.status === 200 && r.json?.request?.status === "Priced" && r.json?.request?.totalNgn === 48500, `got ${r.status}: ${r.raw.slice(0, 200)}`);
check("assess persists the tools list (and tools never touch the total)", JSON.stringify(r.json?.request?.assessment?.tools) === JSON.stringify(["Ladder", "Drill machine", "Sealant gun"]), r.raw.slice(0, 240));
r = await call(api.snapRequests, { method: "GET", query: { code: "SR-2026-SMOKE", phone: "08035556666" } });
check("tools round-trip on a fresh phone-proof read", JSON.stringify(r.json?.request?.assessment?.tools) === JSON.stringify(["Ladder", "Drill machine", "Sealant gun"]), r.raw.slice(0, 240));
await call(api.partners, { method: "POST", body: { ...partnerBody, code: "PRT-2026-PENDING", businessName: "Pending Pros Ltd", email: "pending@partner.test", phone: "08037778888" } });
r = await call(api.snapAssign, { method: "POST", headers: { cookie: adminCookie }, body: { code: "SR-2026-SMOKE", partnerCode: "PRT-2026-PENDING", agreedPriceNgn: 45000 } });
check("assigning an UNAPPROVED partner rejected (400)", r.status === 400, `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.snapRequests, { method: "PATCH", body: { code: "SR-2026-SMOKE", action: "approve", phone: "08099999999" } });
check("approve with the wrong phone rejected (403)", r.status === 403, `got ${r.status}`);
r = await call(api.snapRequests, { method: "PATCH", body: { code: "SR-2026-SMOKE", action: "approve", phone: "08035556666" } });
check("customer approves → Approved", r.status === 200 && r.json?.request?.status === "Approved", `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.settings, { method: "GET" });
const snapPct = r.json?.settings?.partnerTerms?.referralCommissionPct;
r = await call(api.snapAssign, { method: "POST", headers: { cookie: adminCookie }, body: { code: "SR-2026-SMOKE", partnerCode: "PRT-2026-SMOKE", agreedPriceNgn: 45000 } });
check("assign approved partner → Assigned at negotiated ₦45,000", r.status === 200 && r.json?.request?.status === "Assigned" && r.json?.request?.assignedPartnerCode === "PRT-2026-SMOKE" && r.json?.request?.agreedPriceNgn === 45000, `got ${r.status}: ${r.raw.slice(0, 200)}`);
check("commission snapshot uses AGREED price at effective terms", r.json?.request?.commissionPct === snapPct && r.json?.request?.commissionNgn === Math.round(45000 * snapPct / 100), r.raw.slice(0, 200));
r = await call(api.snapRequests, { method: "PATCH", body: { code: "SR-2026-SMOKE", action: "progress", partnerCode: "PRT-2026-SMOKE2", text: "Not my job" } });
check("progress from a non-assigned partner rejected (403)", r.status === 403, `got ${r.status}`);
r = await call(api.snapRequests, { method: "PATCH", body: { code: "SR-2026-SMOKE", action: "progress", partnerCode: "PRT-2026-SMOKE", text: "On my way to site" } });
check("assigned partner posts progress (timeline entry lands)", r.status === 200 && (r.json?.request?.timeline || []).some(e => e.text === "On my way to site"), `got ${r.status}: ${r.raw.slice(0, 200)}`);
r = await call(api.snapRequests, { method: "PATCH", body: { code: "SR-2026-SMOKE", action: "start", partnerCode: "PRT-2026-SMOKE" } });
check("partner starts the job → In Progress", r.status === 200 && r.json?.request?.status === "In Progress", `got ${r.status}`);
r = await call(api.snapRequests, { method: "PATCH", body: { code: "SR-2026-SMOKE", action: "complete", partnerCode: "PRT-2026-SMOKE" } });
check("partner completes the job → Completed", r.status === 200 && r.json?.request?.status === "Completed", `got ${r.status}`);
r = await call(api.partners, { method: "PATCH", body: { code: "PRT-2026-SMOKE", phone: "08099999999", available: false } });
check("availability toggle with wrong phone rejected (403)", r.status === 403, `got ${r.status}`);
r = await call(api.partners, { method: "PATCH", body: { code: "PRT-2026-SMOKE", phone: partnerBody.phone, available: false } });
check("partner sets own availability off (data jsonb merge)", r.status === 200 && r.json?.partner?.available === false, `got ${r.status}: ${r.raw.slice(0, 160)}`);


// ---------- 14. Staff System: RBAC + activity log ----------
console.log("\n[14] Staff — owner creates staff, role gates bite, deactivation locks login");
r = await call(api.staff, { method: "POST", headers: { cookie: adminCookie }, body: { name: "Sally Sales", email: "sales@oketex.test", phone: "08030001111", role: "sales", password: "sales-pass-1" } });
check("owner creates a sales staff account (201)", r.status === 201 && r.json?.staff?.role === "sales", `got ${r.status}: ${r.raw.slice(0, 160)}`);
const salesId = r.json?.staff?.id;
r = await call(api.staff, { method: "POST", headers: { cookie: custCookie }, body: { name: "Mallory", email: "mallory@oketex.test", phone: "08030009999", role: "admin", password: "mallory-pass-1" } });
check("staff create with a CUSTOMER session rejected (401)", r.status === 401, `got ${r.status}`);
r = await call(api.login, { method: "POST", body: { email: "sales@oketex.test", password: "sales-pass-1" } });
check("sales staff logs in with role sales", r.status === 200 && r.json?.user?.role === "sales", `got ${r.status}: ${r.raw.slice(0, 140)}`);
const salesCookie = cookieOf(r);
r = await call(api.settings, { method: "PUT", headers: { cookie: salesCookie }, body: { partnerTerms: { referralCommissionPct: 3 } } });
check("sales token gets 403 on settings PUT (owner-only)", r.status === 403, `got ${r.status}`);
r = await call(api.staff, { method: "POST", headers: { cookie: salesCookie }, body: { name: "Second", email: "second@oketex.test", phone: "08030002222", role: "support", password: "second-pass-1" } });
check("staff CRUD rejects non-owner staff (403)", r.status === 403, `got ${r.status}`);
r = await call(api.staff, { method: "POST", headers: { cookie: adminCookie }, body: { name: "Olga Operations", email: "ops@oketex.test", phone: "08030003333", role: "operations", password: "ops-pass-123" } });
check("owner creates an operations account (201)", r.status === 201, `got ${r.status}: ${r.raw.slice(0, 140)}`);
r = await call(api.login, { method: "POST", body: { email: "ops@oketex.test", password: "ops-pass-123" } });
const opsCookie = cookieOf(r);
await call(api.partners, { method: "POST", body: { ...partnerBody, code: "PRT-2026-OPS", businessName: "Ops Approved Ltd", email: "opsapproved@partner.test", phone: "08036667777" } });
r = await call(api.adminPartners, { method: "PATCH", headers: { cookie: opsCookie }, body: { code: "PRT-2026-OPS", status: "approved" } });
check("operations CAN patch partners (200)", r.status === 200 && r.json?.partner?.status === "approved", `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.staff, { method: "PATCH", headers: { cookie: adminCookie }, body: { id: salesId, active: false } });
check("owner deactivates the sales account (200)", r.status === 200 && r.json?.staff?.active === false, `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.login, { method: "POST", body: { email: "sales@oketex.test", password: "sales-pass-1" } });
check("deactivated staff login rejected (403)", r.status === 403, `got ${r.status}: ${r.raw.slice(0, 140)}`);
r = await call(api.activity, { method: "POST", headers: { cookie: opsCookie }, body: { action: "smoke_ping", refCode: "SMOKE", detail: "activity endpoint accepts staff posts" } });
check("staff can post an activity entry (201)", r.status === 201, `got ${r.status}: ${r.raw.slice(0, 140)}`);
r = await call(api.activity, { method: "GET", headers: { cookie: adminCookie } });
check("activity log (owner read) contains staff_created + the ping", r.status === 200 && (r.json?.entries || []).some(e => e.action === "staff_created") && (r.json?.entries || []).some(e => e.action === "smoke_ping"), `got ${r.status}: ${r.raw.slice(0, 200)}`);
r = await call(api.activity, { method: "GET", headers: { cookie: opsCookie } });
check("activity read is owner-only for staff too (403)", r.status === 403, `got ${r.status}`);

// ---------- 15. Factory wing + Supply (S3) ----------
console.log("\n[15] Production pipeline RBAC + state machine; supply two-way flow");
const mkStaff = async (name, email, role) => {
  const c = await call(api.staff, { method: "POST", headers: { cookie: adminCookie }, body: { name, email, phone: "08030004444", role, password: "factory-pass-1" } });
  const l = await call(api.login, { method: "POST", body: { email, password: "factory-pass-1" } });
  return cookieOf(l);
};
const operatorCookie = await mkStaff("Ola Operator", "operator@oketex.test", "operator");
const qcCookie = await mkStaff("Queen QC", "qc@oketex.test", "qc");
const warehouseCookie = await mkStaff("Wale Warehouse", "warehouse@oketex.test", "warehouse");
const dispatchCookie = await mkStaff("Dan Dispatch", "dispatch@oketex.test", "dispatch");
r = await call(api.production, { method: "POST", headers: { cookie: adminCookie }, body: { orderCode: "ORD-SMOKE-1", customerName: "Factory Customer", address: "12 Test Close, Ibafo", product: { name: "Longspan 0.45", gauge: "0.45mm", colour: "Forest Green" }, cuttingList: [{ lengthM: 5.08, qty: 24 }] } });
check("production job created — cutting total 24 × 5.08 = 121.92m server-side", r.status === 201 && r.json?.job?.totalMetres === 121.92 && r.json?.job?.status === "Queued", `got ${r.status}: ${r.raw.slice(0, 200)}`);
const prdCode = r.json?.job?.code;
r = await call(api.production, { method: "POST", headers: { cookie: adminCookie }, body: { orderCode: "ORD-SMOKE-1", customerName: "Factory Customer", cuttingList: [] } });
check("re-creating for the same order dedupes to the open job", r.status === 200 && r.json?.existing === true && r.json?.job?.code === prdCode, `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.production, { method: "PATCH", headers: { cookie: adminCookie }, body: { code: prdCode, action: "assign", operatorName: "Ola Operator" } });
check("manager assigns the operator", r.status === 200 && r.json?.job?.operatorName === "Ola Operator", `got ${r.status}`);
r = await call(api.production, { method: "PATCH", headers: { cookie: operatorCookie }, body: { code: prdCode, action: "start" } });
check("assigned operator starts → In Production", r.status === 200 && r.json?.job?.status === "In Production", `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.production, { method: "PATCH", headers: { cookie: operatorCookie }, body: { code: prdCode, action: "finish", metresProduced: 121.92, scrapNote: "2m offcuts" } });
check("operator finishes → Produced with metres + scrap note", r.status === 200 && r.json?.job?.status === "Produced" && r.json?.job?.metresProduced === 121.92, `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.production, { method: "PATCH", headers: { cookie: operatorCookie }, body: { code: prdCode, action: "qc", result: "pass" } });
check("operator CANNOT QC-pass their own job (403)", r.status === 403, `got ${r.status}`);
r = await call(api.settings, { method: "PUT", headers: { cookie: qcCookie }, body: { partnerTerms: { referralCommissionPct: 3 } } });
check("qc staff CANNOT edit settings (403)", r.status === 403, `got ${r.status}`);
r = await call(api.production, { method: "PATCH", headers: { cookie: warehouseCookie }, body: { code: prdCode, action: "bundle" } });
check("bundle BEFORE QC pass rejected — QC cannot be skipped (400)", r.status === 400, `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.production, { method: "PATCH", headers: { cookie: qcCookie }, body: { code: prdCode, action: "qc", result: "pass", notes: "Gauge + colour verified" } });
check("qc passes → QC Passed", r.status === 200 && r.json?.job?.status === "QC Passed" && r.json?.job?.qc?.result === "pass", `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.production, { method: "PATCH", headers: { cookie: warehouseCookie }, body: { code: prdCode, action: "bundle" } });
check("warehouse bundles → Bundled", r.status === 200 && r.json?.job?.status === "Bundled", `got ${r.status}`);
r = await call(api.production, { method: "PATCH", headers: { cookie: dispatchCookie }, body: { code: prdCode, action: "dispatch" } });
check("dispatch sends → Dispatched", r.status === 200 && r.json?.job?.status === "Dispatched", `got ${r.status}`);
r = await call(api.production, { method: "PATCH", headers: { cookie: dispatchCookie }, body: { code: prdCode, action: "deliver" } });
check("dispatch closes the loop → Delivered", r.status === 200 && r.json?.job?.status === "Delivered", `got ${r.status}`);
// Supply: two sellers quote a broadcast; a pro-only partner sees nothing.
const sellerBody = { ...partnerBody, role: "seller", trades: [], categories: ["Rainwater Goods"], products: [] };
await call(api.partners, { method: "POST", body: { ...sellerBody, code: "PRT-2026-SELLA", businessName: "Seller A Ltd", email: "sella@partner.test", phone: "08031113333" } });
await call(api.partners, { method: "POST", body: { ...sellerBody, code: "PRT-2026-SELLB", businessName: "Seller B Ltd", email: "sellb@partner.test", phone: "08034445555" } });
await call(api.adminPartners, { method: "PATCH", headers: { cookie: adminCookie }, body: { code: "PRT-2026-SELLA", status: "approved" } });
await call(api.adminPartners, { method: "PATCH", headers: { cookie: adminCookie }, body: { code: "PRT-2026-SELLB", status: "approved" } });
r = await call(api.supply, { method: "POST", headers: { cookie: adminCookie }, body: { code: "SUP-2026-SMOKE", type: "buy", item: "Aluminium rain gutter & downpipe", qty: 40, unit: "pcs", targetPartnerCodes: [] } });
check("admin raises a broadcast supply request (201, Open)", r.status === 201 && r.json?.request?.status === "Open", `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.supply, { method: "GET", query: { partnerCode: "PRT-2026-SMOKE", phone: "08031112222" } });
check("pro-only partner does NOT see seller broadcasts", r.status === 200 && !(r.json?.requests || []).some(x => x.code === "SUP-2026-SMOKE"), `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.supply, { method: "GET", query: { partnerCode: "PRT-2026-SELLA", phone: "08031113333" } });
check("approved seller sees the broadcast", r.status === 200 && (r.json?.requests || []).some(x => x.code === "SUP-2026-SMOKE"), `got ${r.status}`);
r = await call(api.supply, { method: "PATCH", body: { code: "SUP-2026-SMOKE", action: "quote", partnerCode: "PRT-2026-SELLA", phone: "08031113333", unitPriceNgn: 12500, leadDays: 3, note: "Ex-stock" } });
check("seller A quotes ₦12,500 × 40 — server total ₦500,000, status Quoted", r.status === 200 && r.json?.request?.status === "Quoted" && r.json?.request?.quotes?.[0]?.totalNgn === 500000, `got ${r.status}: ${r.raw.slice(0, 200)}`);
r = await call(api.supply, { method: "PATCH", body: { code: "SUP-2026-SMOKE", action: "quote", partnerCode: "PRT-2026-SELLB", phone: "08034445555", unitPriceNgn: 13000, leadDays: 5, note: "" } });
check("seller B quotes ₦13,000 × 40 = ₦520,000", r.status === 200 && (r.json?.request?.quotes || []).some(q => q.partnerCode === "PRT-2026-SELLB" && q.totalNgn === 520000), `got ${r.status}: ${r.raw.slice(0, 200)}`);
r = await call(api.supply, { method: "GET", query: { partnerCode: "PRT-2026-SELLA", phone: "08031113333" } });
const aView = (r.json?.requests || []).find(x => x.code === "SUP-2026-SMOKE");
check("partner read strips OTHER partners' quotes (A sees only A's)", !!aView && aView.quotes.length === 1 && aView.quotes[0].partnerCode === "PRT-2026-SELLA", r.raw.slice(0, 200));
r = await call(api.supply, { method: "PATCH", headers: { cookie: adminCookie }, body: { code: "SUP-2026-SMOKE", action: "approve", partnerCode: "PRT-2026-SELLA" } });
check("admin approves A — chosen total ₦500,000 recorded", r.status === 200 && r.json?.request?.status === "Approved" && r.json?.request?.chosenPartnerCode === "PRT-2026-SELLA" && r.json?.request?.chosenTotalNgn === 500000, `got ${r.status}: ${r.raw.slice(0, 200)}`);
r = await call(api.supply, { method: "PATCH", headers: { cookie: adminCookie }, body: { code: "SUP-2026-SMOKE", action: "received" } });
check("admin marks Received", r.status === 200 && r.json?.request?.status === "Received", `got ${r.status}`);

// ---------- 20. Living knowledge — Teach the system (2026-10-26) ----------
console.log("\n[20] Knowledge — partner submits → pending hidden → staff approves → public → confirm once → reject path");
r = await call(api.knowledge, { method: "POST", body: { kind: "fix", trade: "Roofing", title: "Customer attempt", body: "Customers should not be able to teach the system at all.", tools: [], partnerCode: "PRT-NOPE", phone: "08000000000" } });
check("customer (unknown partner) cannot contribute (404)", r.status === 404, `got ${r.status}: ${r.raw.slice(0, 140)}`);
r = await call(api.knowledge, { method: "POST", body: { kind: "fix", trade: "Roofing", title: "Wrong phone", body: "A real fix body that is long enough to pass validation.", tools: [], partnerCode: "PRT-2026-SMOKE", phone: "08039998888" } });
check("partner with WRONG phone cannot contribute (403)", r.status === 403, `got ${r.status}`);
r = await call(api.knowledge, { method: "POST", body: { kind: "fix", trade: "Astrology", title: "Bad trade", body: "A real fix body that is long enough to pass validation.", tools: [], partnerCode: "PRT-2026-SMOKE", phone: "08031112222" } });
check("unknown trade rejected (400)", r.status === 400, `got ${r.status}`);
r = await call(api.knowledge, { method: "POST", body: { kind: "fix", trade: "Interior & Cabinetry", title: "Swollen sink-unit edge — the marine ply fix", body: "Cut back to sound board, replace the sink carcass base with marine plywood, seal every cut edge twice and fix the leak source first.", tools: ["Drill machine"], partnerCode: "PRT-2026-SMOKE", phone: "08031112222" } });
check("approved partner submits (Interior & Cabinetry trade) -> 201 pending", r.status === 201 && r.json?.entry?.status === "pending" && r.json?.entry?.trade === "Interior & Cabinetry", `got ${r.status}: ${r.raw.slice(0, 200)}`);
const knwId = r.json?.entry?.id;
r = await call(api.knowledge, { method: "GET" });
check("pending entry is NOT in the public list", !(r.json?.entries || []).some(e => e.id === knwId), r.raw.slice(0, 140));
r = await call(api.knowledge, { method: "GET", query: { mine: "PRT-2026-SMOKE", phone: "08031112222" } });
check("partner sees their own pending submission via ?mine", (r.json?.entries || []).some(e => e.id === knwId && e.status === "pending"), r.raw.slice(0, 140));
r = await call(api.knowledge, { method: "PATCH", headers: { cookie: loginCookie }, body: { id: knwId, action: "approve" } });
check("non-staff cannot approve (401/403)", r.status === 401 || r.status === 403, `got ${r.status}`);
r = await call(api.knowledge, { method: "PATCH", headers: { cookie: adminCookie }, body: { id: knwId, action: "approve" } });
check("staff approves -> status approved", r.status === 200 && r.json?.entry?.status === "approved", `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.knowledge, { method: "GET" });
check("approved entry IS in the public list", (r.json?.entries || []).some(e => e.id === knwId), r.raw.slice(0, 140));
check("public shape hides confirmedBy internals", (r.json?.entries || []).find(e => e.id === knwId)?.confirmedBy === undefined);
r = await call(api.knowledge, { method: "PATCH", body: { id: knwId, action: "confirm", partnerCode: "PRT-2026-SMOKE", phone: "08031112222" } });
check("first confirmation counts (1)", r.status === 200 && r.json?.entry?.confirmations === 1 && r.json?.alreadyConfirmed === false, `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.knowledge, { method: "PATCH", body: { id: knwId, action: "confirm", partnerCode: "PRT-2026-SMOKE", phone: "08031112222" } });
check("second confirmation from same partner is a no-op", r.status === 200 && r.json?.entry?.confirmations === 1 && r.json?.alreadyConfirmed === true, `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.knowledge, { method: "PATCH", body: { id: "longspan", action: "confirm", partnerCode: "PRT-2026-SMOKE", phone: "08031112222", seedTitle: "Aluminium Longspan", seedTrade: "Roofing" } });
check("seed confirmation upserts a seedref pointer (count 1)", r.status === 200 && r.json?.entry?.kind === "seedref" && r.json?.entry?.confirmations === 1, `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.knowledge, { method: "POST", headers: { cookie: adminCookie }, body: { kind: "tip", trade: "Tiling", title: "Staff tip to be rejected", body: "A staff-submitted tip long enough to pass validation, destined for rejection.", tools: [] } });
check("staff can submit directly (source staff)", r.status === 201 && r.json?.entry?.source === "staff", `got ${r.status}: ${r.raw.slice(0, 160)}`);
const staffTipId = r.json?.entry?.id;
r = await call(api.knowledge, { method: "PATCH", headers: { cookie: adminCookie }, body: { id: staffTipId, action: "reject", note: "Not field-proven — rewrite with measurements" } });
check("staff rejects with a note", r.status === 200 && r.json?.entry?.status === "rejected", `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.knowledge, { method: "GET" });
check("rejected entry never reaches the public list", !(r.json?.entries || []).some(e => e.id === staffTipId), r.raw.slice(0, 140));
r = await call(api.knowledge, { method: "GET", query: { all: "1" }, headers: { cookie: adminCookie } });
check("staff ?all=1 sees every status incl. the rejection", (r.json?.entries || []).some(e => e.id === staffTipId && e.status === "rejected" && (e.rejectNote || "").includes("field-proven")), r.raw.slice(0, 200));

// ---------- 21. Global Sourcing (SC) — create, quote privacy, approve ----------
console.log("\n[21] Source requests — create, staff quote, customer sees landed total only, phone-proof approve");
r = await call(api.sourceRequests, { method: "POST", body: { code: "SC-2026-SMOKE", productName: "Italian marble tiles 120x60", description: "Polished, for a duplex in Lekki", quantity: 20, area: "lagos-lekki-ajah", customerName: "Source Tester", customerPhone: "08031234567" } });
check("source request created (201, Received)", r.status === 201 && r.json?.request?.status === "Received", `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.sourceRequests, { method: "PATCH", body: { code: "SC-2026-SMOKE", action: "quote", quote: { itemNgn: 400000, shippingNgn: 150000, serviceNgn: 183500, costTotalNgn: 550000, leadDays: 21, note: "Air freight" } } });
check("quote without staff rejected", r.status === 401 || r.status === 403, `got ${r.status}`);
r = await call(api.sourceRequests, { method: "PATCH", headers: { cookie: adminCookie }, body: { code: "SC-2026-SMOKE", action: "quote", quote: { itemNgn: 400000, shippingNgn: 150000, serviceNgn: 183500, costTotalNgn: 550000, leadDays: 21, note: "Air freight" } } });
check("staff quote → Quoted, server landed total ₦733,500", r.status === 200 && r.json?.request?.status === "Quoted" && r.json?.request?.landedTotalNgn === 733500, `got ${r.status}: ${r.raw.slice(0, 200)}`);
r = await call(api.sourceRequests, { method: "GET", query: { code: "SC-2026-SMOKE" } });
check("public lookup hides phone AND the quote cost side", r.json?.request?.customerPhone === "" && r.json?.request?.quote?.costTotalNgn === undefined && r.json?.request?.landedTotalNgn === 733500, r.raw.slice(0, 240));
r = await call(api.sourceRequests, { method: "PATCH", body: { code: "SC-2026-SMOKE", action: "approve", phone: "08099999999" } });
check("approve with the wrong phone rejected (403)", r.status === 403, `got ${r.status}`);
r = await call(api.sourceRequests, { method: "PATCH", body: { code: "SC-2026-SMOKE", action: "approve", phone: "08031234567" } });
check("customer approves → Approved", r.status === 200 && r.json?.request?.status === "Approved", `got ${r.status}: ${r.raw.slice(0, 160)}`);
r = await call(api.sourceRequests, { method: "GET", query: { all: "1" }, headers: { cookie: adminCookie } });
check("staff queue lists the SC request", (r.json?.requests || []).some(x => x.code === "SC-2026-SMOKE" && x.quote?.costTotalNgn === 550000), r.raw.slice(0, 200));

console.log(`\nSMOKE RESULT: ${pass} passed, ${fail} failed${fail ? " — failures: " + failures.join("; ") : ""}`);
process.exit(fail ? 1 : 0);
