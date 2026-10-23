# Oketex & Sons — Enhanced Build Notes

## What was built
A standalone, deploy-anywhere (Vercel/static) version of Oketex & Sons Aluminum Co. at `oketex-enhanced/app`. No backend, no Kimi OAuth, no MySQL. Catalog/gallery are typed local data (`src/data/catalog.ts`, ported exactly from the original `db/seed.ts`: 5 categories, 13 products, 6 gallery projects, same NGN prices). Cart, quotes and orders persist in localStorage; quote/order submission saves locally and offers a WhatsApp deep link (`wa.me/2348035550192`). Demo admin at `/admin`, password `admin123`, clearly labelled demo, reads local quotes/orders.

Visual identity preserved: dark `#212121` theme, primary orange `#FF6026`, Rajdhani / IBM Plex Sans / IBM Plex Mono, hairline borders, brand-gradient, marquee bar, logo mark. All 20 original images copied to `public/images/`.

> ⚠️ Placeholder warning (also flagged in `src/data/catalog.ts` / `src/contracts/constants.ts`): BUSINESS phone `+234 803 555 0192`, email `sales@oketexandsons.ng`, address, and stats (Est. 2009, 2,400 roofs, 36 states, RC in original footer) came from the original template and look like placeholders — confirm with the owner before launch.

## Routes
- `/` Home — hero, stats, categories, featured, Tools band (3 flagship tools), 8 services, process Measure → Fabricate → Deliver → Install → Warranty, factory band, projects, CTA
- `/shop`, `/product/:slug`, `/checkout`, `/track` (local orders by OKX- code or phone), `/gallery`, `/account` (local orders/quotes)
- `/quote` — **Pro Roof Calculator** (flagship, see below)
- `/snap-measure` — photo calibration + drawing measurement, sends dimensions to calculator
- `/visualizer` — SVG 2.5D house, patterns/colours/walls/lighting, Cinematic Tour, PNG download, "Price this look"
- `/tools` — Pitch Finder, Aluminium Weight, Gutter/Rainwater Sizer, Window & Door Pricer, Coverage Converter (all live)
- `/services` — 8 services in detail
- `/assistant` — offline rule-based advisor, prices only from catalog data
- `/admin` — demo admin (admin123)
- `*` — 404. SEO: OG/Twitter tags, `/favicon.svg`, `robots.txt`, `sitemap.xml`, JSON-LD LocalBusiness, floating WhatsApp button, print stylesheet for BOQ.

## Roof engine (`src/lib/roofEngine.ts`) — how the math works
- `slopeFactor = 1/cos(pitch)`; effective plan dims include overhang on all sides; `trueRoofArea = effectivePlanArea × slopeFactor` (flat roofs forced to minimum 3° pitch, disclosed in UI).
- `slopeLength = (effWidth/2)/cos(pitch)` for gable/hip; full-width slope for shed/flat.
- Longspan (cover 1.0m, ₦9,800/m @0.45, ₦11,500/m @0.55) / Metcoppo (0.96m, ₦12,800/m): `sheetsAcross = ceil(effLength/cover)`, `totalMetres = sheetsAcross × slopeLength × slopes × (1+waste)`, with a cutting list ("24 sheets × 5.08 m"). Corrugated handled per 3m sheet (0.9m cover, ₦8,900/sheet). Stone-coated: `tiles = ceil(trueArea×(1+waste)/0.48)` @ ₦6,900/tile.
- Ridge: gable = effLength; hip ridge = max(effLength−effWidth,0) + 4 hip rafters, hip rafter = sqrt(slopeLength² + (effWidth/2)²); priced ₦4,500/m — **estimator rate** (labelled in UI).
- Fasteners ≈7 screws/m² in 500pc buckets @ ₦38,500. Purlins: rows every 0.9m, ₦1,800/m — **estimator rate**. Insulation rolls = ceil(area/30) @ ₦46,500. Gutters ₦6,500/m (gable 2×effLength, hip = perimeter). Installation ₦2,200/m² of true area — **estimator rate**. Delivery zones: Pickup ₦0, Ogun/Lagos ₦45,000, South-West ₦85,000, South-South/South-East ₦145,000, Abuja/North ₦185,000. Waste auto by style (gable 8%, hip/mansard 12%, shed/flat 5%), adjustable.
- Output is a full BOQ table (item/spec/qty/unit/rate/total), subtotal, transport, grand total in NGN + USD at ₦1,550/$, with Save (localStorage, QT-2026-XXXXX), Print/PDF, WhatsApp and Copy actions, plus a "How this is calculated" formula panel.

### Verified example (engine run directly, pickup, no extras)
10m × 8m, gable, 25°, Longspan 0.45, overhang 0.6m → effective 11.2 × 9.2m, plan 103.04m², slope factor 1.103, **true area 113.69m², slope length 5.08m, 12 across × 2 slopes = 24 sheets × 5.08m, 131.6m ordered** (₦1,289,680), ridge 13m ₦58,500, screws 796 → 2 buckets ₦77,000, **grand total ₦1,425,180** (pickup; +₦45,000 for Ogun/Lagos delivery).

## Phase 2 (Pro Workspace, Pro Tools, Bookings, Build A–Z)

### New routes
- `/workspace` — **Pro Workspace** for roofers/carpenters/engineers: project list (create/open/duplicate/delete), Roof Take-Off Spreadsheet (rows priced live by `calculateRoof` per section — area, cutting list, subtotal, totals), Building Measurement Sheet (L×W area or L×W×H volume per row × qty), site notes, materials/kit checklist, CSV download, print sheet, WhatsApp summary, per-row "Open in Pro Calculator" (writes `oketex-prefill` + `/quote` search params). Seeded with a clearly-labelled sample project.
- `/book` — **Customer Bookings**: 7 services, date (not past) + slot, Nigerian phone validation (≥10 digits), booking code `BK-YYYY-XXXXX`, WhatsApp confirmation summary, success screen with next steps. `/book?service=<id>` preselects a service.
- `/build` — **Build A–Z Hub**: 14-stage interactive Build Journey with persistent progress (ring + bar + per-stage tick), each stage expandable with involves/materials/duration/pro tips, **Supplied by Oketex** (stages 5 Roofing, 6 Windows & Doors, 13 ACP Cladding, 14 Gutters — Shop category links) vs **Partner trade** (Book a pro → `/book?service=consultation`; Oketex stages book their own service).
- `/tools` gained sections (f)–(j): Tape & Fraction Converter (with live SVG tape strip), Square & Diagonal Check (3-4-5 SVG explainer), Cut-Length Optimizer, Block & Concrete Estimator, Pro Equipment Guide (13 items, specs only — no invented prices, WhatsApp "ask for supply").
- `/track` now has Orders / Bookings tabs (booking lookup by BK- code or phone, status pipeline Pending → Confirmed → Scheduled → Completed/Cancelled). `/admin` gained tabs incl. **Bookings** with status-change controls (demo-labelled). `/account` lists bookings. Home gained a Build A–Z 14-stage band and a Pro Workspace + Bookings band. Header nav is now: Shop, Quote, Visualizer, Tools, Build A–Z, Workspace, Book, Gallery, Track, Assistant (Snap-Measure & Services stay in the mobile menu and page links). Assistant answers booking / spreadsheet / building-section questions with links to /book, /workspace, /build. `sitemap.xml` includes the three new routes.

### Storage keys (Phase 2, all localStorage)
- `oketex-pro-projects` — Pro Workspace projects (take-off rows, measurement rows, notes, checklist)
- `oketex-bookings` — customer bookings
- `oketex-journey` — Build A–Z stage completion map

### New estimator formulas (implemented in `src/lib/proTools.ts`, verified headlessly)
- **Tape conversion**: parses `12' 7 3/8"`, `12 ft 7 3/8 in`, metric suffixes, and bare numbers (= mm); metres→imperial rounds the inch fraction to nearest 1/8, 1/16 or 1/32 and reduces it (verified: 12' 7 3/8" = 3.844925 m; 3.851 m @1/16 → 12' 7 5/8").
- **Square check**: expected diagonal = √(L²+W²); layout is square when |diagA − diagB| ≤ 5mm per 10m of the longer side.
- **Cut optimizer**: first-fit decreasing bin packing with kerf per cut; waste % = (stock bought − cut length) / stock bought (kerf counts as waste); offcuts ≥0.3m listed as reusable.
- **Blocks**: blocks = wall area × 10/m² (450×225mm block face + 10mm mortar joint ≈ 9.9/m², site rule 10) × 1.05 breakage. Mortar (estimator): 0.03 m³/m² for 9" block, 0.02 m³/m² for 6".
- **Concrete (dry-volume method)**: wet volume = L×W×thickness; dry volume = wet × 1.54; split dry volume by mix ratio parts; cement at 1440 kg/m³ in 50kg bags, sharp sand at 1600 kg/m³, granite at 1550 kg/m³.

### Verified worked examples (run against the shipped code)
- **Concrete**: 10m × 8m slab, 150mm thick, mix 1:2:4 → wet 12.00 m³, dry 18.48 m³, cement 2.64 m³ = 3,801.6 kg = 76.03 bags → **77 bags**, sharp sand **8.45 tonnes**, granite **16.37 tonnes**.
- **Cut optimizer**: stock 6.0m, kerf 3mm, cuts 2.4m×4 + 1.8m×3 + 1.2m×5 → **5 bars**: [2.4, 2.4] · [2.4, 2.4] · [1.8, 1.8, 1.8] · [1.2, 1.2, 1.2, 1.2] · [1.2]; waste **30.0%**; reusable offcuts 1.197m, 1.197m, 0.594m, 1.191m, 4.800m.
- **Blocks**: 10m × 3m wall, 9" → 30 m², 300 raw → **315 blocks**, mortar **0.90 m³**.

### Phase 2 build
- `npm run build` (tsc + vite) passes clean — 1,810 modules transformed.

## Phase 3 (Style & Photo Project Estimator)

### New route
- `/estimator` — **Project Estimator** wizard: **1 Trade → 2 Style → 3 Photo & Dimensions → 4 Materials List & Estimate.** 7 trades (Roofing, Tiling & Floors, Woodwork & Carpentry, Plumbing, Interior Room, Windows & Doors, Exterior & Cladding) and 27 styles, each style card with a live inline-SVG pattern preview (herringbone, subway, checkerboard, stone bond, ACP grid, brick, louvre, shaker, façade types…). Photo upload (`accept="image/*"`, `capture="environment"`) is held as a session object URL only — shown on the result, **never written to localStorage**; saved estimates record only `photoAttached: yes/no`. Step 3 links to `/snap-measure` for unknown measurements. Dimension forms are per-trade (roof L/W/pitch/style/overhang/extras/zone reusing the roof engine inputs; tiling room + wall % + tile size; woodwork frontage/height/door override; plumbing fixture counts adjustable ± with water-heater and bathroom-tiling add-ons; interior L×W×H − openings% with POP/plasterboard/PVC ceiling and optional tiled floor; windows count × average size or direct m²; exterior wall × elevations − openings%).
- Result: grouped tick-off checklist (**Main Materials / Accessories & Fixings / Consumables / Tools & Equipment / Labour**) with per-line price basis badges (CATALOG / ESTIMATOR RATE / CONFIRM PRICE), priced subtotal + "N items to confirm price", waste + assumptions panel. Actions: **Save estimate**, **Create Workspace Project** (writes an `oketex-pro-projects` project: estimate lines become measurement-sheet rows AND checklist items; roofing also writes its take-off row), **Download CSV**, **Print** (print-boq), **WhatsApp summary**, **Book a pro** → `/book?service=` mapped per trade (roofing → installation, windows → windows-doors-survey, exterior → cladding-survey, others → consultation). Saved estimates list with load/delete. Nav gains "Estimator" after Quote (desktop + mobile); Home gains the "Snap it. Style it." band; Assistant routes materials-list/style/herringbone/wardrobe/bathroom queries to /estimator; `sitemap.xml` includes `/estimator`.

### Recipes approach (`src/data/styleRecipes.ts` + `src/lib/projectEstimator.ts`)
- Each recipe line is a template: `{group, driver, rate, perKey, rounding, wasteApplies, catalogSlug | estimatorPriceNgn}`. The engine computes drivers per trade (area, perimeter, frontage, doors, fixtures/wet points, openings, ceiling/wall area) and evaluates `qty = driver × rate ÷ per` (per: tileArea from tile size, boardArea 2.98m², sheetArea 2.88m²), applying pattern waste where flagged.
- **Pricing honesty:** prices come only from the catalog by slug (ACP sheets ₦58,000, extrusion profiles ₦42,000, roof lines via `calculateRoof`) or from labelled estimator rates (tiles by size, boards, hardware, paint, labour…). **Plumbing fixtures have no price at all** — quantities only. Windows main line is priced per m² prorated from the catalog (casement ₦145,000 ÷ 1.44m²; sliding/full-glaze ₦385,000 ÷ 5.04m²) with the basis printed on the line. Roofing reuses the Phase 1 roofEngine BOQ, regrouped, transport shown as its own line. Interior floor finish reuses the tiling recipe (skirting excluded); plumbing tiling add-on reuses it with a "Bathroom tiling —" prefix.
- **Tiling waste table:** Large-Format Straight 7% · Subway Brick 10% · Checkerboard 10% · Mosaic 10% · Diagonal Diamond 12% · Herringbone 15% (applies to the tile count only). Exterior stone/brick cutting waste 10%.
- Key rates (all stated in code comments): adhesive 1×20kg bag / 4m² · grout 0.5kg/m² · spacers 1 pack / 10m² · tiling labour ₦2,500/m² · boards = frontage area × carcass factor (wardrobe 1.6, kitchen 1.9, shelving 1.3) ÷ 2.98m² · hinges 2/door · plumbing pipework ≈6m per wet point, labour ₦15,000/point · paint emulsion 11m²/L/coat × 2 coats, primer 12m²/L · POP 1×25kg bag ≈ 2.5m² · PVC panel 1.5m² each · silicone ≈1 tube / 3m² of opening.

### Storage key (Phase 3)
- `oketex-estimates` — saved estimates (`EST-YYYY-XXXXX`) with full inputs + computed groups, **without any photo data**.

### Verified worked example (run headlessly against the shipped engine)
**Herringbone tiling, room 4m × 3m (floor only), 600 × 600mm tiles (0.36m², estimator ₦2,400/tile), pattern waste 15%:**
- Floor area 12.0m², perimeter 14m → **tiles: ceil(12 × 1.15 ÷ 0.36) = 39 tiles = ₦93,600**
- Tile adhesive: ceil(12 ÷ 4) = **3 bags = ₦19,500** · Grout: 12 × 0.5 = **6kg = ₦2,700** · Spacers: **2 packs = ₦2,400**
- Skirting: **14m = ₦12,600** · Edge trim: **2m = ₦3,000** · Tile cutter hire: **1 day = ₦5,000** · Tiling labour: 12m² × ₦2,500 = **₦30,000**
- **Priced total ₦168,800, 0 items to confirm price.**
- Cross-checks in the same headless run: roofing via the estimator (10×8m gable, Longspan 0.45, gutters+installation+timber, Ogun/Lagos) ₦2,113,480 with the Phase 1 cutting list; luxury bathroom + water heater + tiling add-on = 22 lines / 12 unpriced fixture lines; windows casement main line ₦100,694/m² catalog-prorated; ACP 10×3m wall (net 25.5m²) = 9 sheets ₦522,000 catalog.

### Phase 3 build
- `npm run build` (tsc + vite) passes clean — 1,813 modules transformed.

## Phase 4 (Partner Network — pro & seller marketplace with revenue engine)

### New routes
- `/partners` — **Directory**: approved partners only, featured first (then verified), search + role (All/Pros/Sellers) + trade/category + location filters. Cards show role chip, Verified badge, Featured ribbon, trades/categories, location/areas, seller "From ₦…" (lowest listed product) and sample labels.
- `/partners/:code` — **Profile / Storefront**: full details; sellers get a product table with per-product "Order on WhatsApp" (wa.me to the PARTNER's own number) plus an "Order via Oketex" lead form in the sidebar; pros get a "Request this pro" job-lead form. Customer forms create tracked leads; the customer never sees commission charged to them (a note states the % is the partner's referral term). Pending/rejected partners show a "not yet approved" page if visited directly.
- `/join` — **Registration**: Pro/Seller toggle, full form (sellers add product rows dynamically), launch-terms box with mandatory agree checkbox, phone ≥10-digit validation. Applications land as `pending`; the success screen issues a big copyable partner code (PRT-YYYY-XXXXX) + WhatsApp notify link.
- `/partner-status` — **Partner dashboard by code**: status banner; pending view explains next steps; approved partners see their leads (read-only, with per-lead commission snapshot), their supply-offers inbox (audience-filtered, "take offer" via WhatsApp), and upgrade cards — Verified badge / Featured placement — with "Activate via WhatsApp"; activation itself is done by the admin after payment confirmation (stated on the card).
- `/admin` gained a **Partners** tab (demo-labelled): approvals queue (full application details, Approve/Reject), all-partners table with Verified/Featured toggles, a Leads & Revenue dashboard (total leads, won value, commission earned = leads marked `paid`, commission pipeline = `won` unpaid; per-lead status select new→contacted→won→paid→lost + delete), and a Push Supply Offer form (product with catalog datalist, price, unit, note, audience all/pros/sellers) + pushed-offers list with delete.

### Terms & revenue model
- `src/data/partnerTerms.ts` is the single source of the **LAUNCH TERMS**: referral commission **5%** of won lead value (charged to the partner, snapshotted onto each lead at creation), Verified badge **₦15,000 one-time**, Featured placement **₦20,000/month**. All revenue math reads these terms (or their admin overrides — below); no other file hard-codes them.
- Revenue flow: customer requests a partner through Oketex → lead tracked → partner wins the work → partner settles 5% with Oketex (lead marked `paid` = commission earned; `won` = pipeline). Optional partner-paid upgrades (Verified, Featured) are the second revenue line; supply offers pushed by admin are the third (network supply margin handled off-platform in this demo).
- **Demo mode:** partners/leads/offers live in localStorage on one device. The 5 seeded partners are clearly labelled SAMPLE listings (2 pros — Lagos roofer, Abuja engineer; 3 sellers — Ibafo roofing depot, Lagos tiles, Ibadan timber, each with sample products/prices, excluded from any "real data" claim). **Production step:** move partners/leads/offers/settings to a real backend (Neon Postgres), add real auth for partners/admin, and settle verification fees, featured fees and commissions via **Paystack** (payment links/webhooks marking leads `paid` automatically).

### Storage keys (Phase 4, all localStorage)
- `oketex-partners` — Partner records (seeded with the 5 samples on first read)
- `oketex-leads` — Lead records with commission snapshot (`commissionPct`, `commissionNgn` frozen at creation)
- `oketex-offers` — supply offers pushed by admin

### Admin Settings & Rates (`oketex-settings`) — all platform numbers are admin-editable
`src/lib/settings.ts` merges admin overrides over code defaults at call time: `getPartnerTerms()`, `getRates()`, `getBusiness()`. The Admin **Settings & Rates** tab (demo-labelled) edits all three groups, shows default vs current effective values plus an overridden-vs-default summary, and has Reset-all-to-defaults. Business-details save triggers a reload ("Save & reload") so shell components pick up new values.
- **Partner terms (fully wired end-to-end):** commission %, verification fee, featured fee. Consumed by: /join terms box + success screen, /partners directory notes & join band, /partners/:code lead-form note, /partner-status upgrade cards, Admin partners tab (headers, queue text, revenue dashboard %), and — critically — `partnerStorage.addLead`, which snapshots the EFFECTIVE % onto each new lead. Editing terms never rewrites existing leads (verified headlessly: lead created at 7% stayed 7%/₦14,000 after terms were changed to 10%).
- **Engineering rates (wired into the roof engine):** delivery prices for all 5 zones, installation labour ₦/m², ridge caps ₦/m (also used for stone-coated ridge pieces, the same rate), timber purlins ₦/m. `calculateRoof` calls `getRates()` per calculation, so the Quote page (including its delivery-zone dropdown labels) and the Workspace take-off follow admin settings automatically. Catalog material prices are NOT admin-editable here (they are the catalog's job). Verified headlessly: with defaults the Phase 1 worked example still totals exactly ₦1,425,180; with overrides (ridge ₦6,000, installation ₦3,000, Ogun/Lagos ₦60,000) the same roof repriced accordingly.
- **Business details:** phone, WhatsApp, email, address, hours (`getBusiness()`; name/shortName stay in code). Applied in SiteHeader, SiteFooter, the floating WhatsApp button (SiteShell) and every page that prints contact details or builds WhatsApp links — migrated files: Home, Track, Checkout, Quote, Assistant (its delivery answer now quotes the live `getRates()` zone prices), Book, Workspace, Estimator, Partners, PartnerProfile, Join, PartnerStatus, and ProToolsSections (Tools equipment guide). WhatsApp CTAs now build links via `businessWaLink()` from the effective number; the static `WHATSAPP_LINK` constant remains only as the compile-time default source inside settings.

### Phase 4 build
- `npm run build` (tsc + vite) passes clean — 1,820 modules transformed. Headless verification of terms/rates/business overrides and lead snapshotting all passed (see above).

## Deviations / notes
- Corrugated in the calculator uses the colour sheet price (₦8,900) as the default estimator price (mill ₦7,500 is in the shop catalog) — documented in code.
- Stone-coated nails are an estimator-rate line (₦45/pc, ~12/m²) — no catalog nail product exists.
- Snap-Measure sends Roof Width as calculator length and derives width as 2× slope length as a starting point (explained in its UI); pitch still needs setting in the calculator. It is honest assisted measurement, not AI.
- Window Pricer glass/finish multipliers are labelled estimates anchored to the catalog casement baseline (₦145,000 per 1.44m²).
- `npm run build` (tsc + vite) passes clean. Deploy: any static host / Vercel with root `oketex-enhanced/app`, build `npm run build`, output `dist`. SPA fallback rewrite to `index.html` is needed on the host for deep links.

---

# Phase 5 — Production Backend (Neon + Auth + Paystack), 2026-10-23

The site now ships a real backend that **activates only when env vars exist**. With no env vars, every API call fails soft and the app behaves exactly as the Phase 1–4 demo (all localStorage paths are intact — nothing was deleted). The frontend decides LIVE vs DEMO by probing `GET /api/health` once per load: LIVE only when the database answers (`health.db === true`); the flag is cached in localStorage key `oketex-api-live` and every store wrapper tries the API first, falling back to the local implementation on ANY error.

## Architecture
- **API**: plain Vercel Node functions, one file per route under repo-root `/api` (req/res style, tiny helpers in `server/http.ts`). Shared code in `/server` (never routes; Vercel bundles the imports): `db.ts`, `auth.ts`, `paystack.ts`, `schema.sql.ts`, `records.ts` (row→frontend-shape mappers), `siteSettings.ts`, `http.ts`.
- **DB access**: `server/db.ts` exposes parameterised `dbQuery()` + `dbPing()` + a drizzle instance. Driver is chosen lazily from `DATABASE_URL`: Neon hosts → `@neondatabase/serverless` HTTP + `drizzle-orm/neon-http`; any other `postgres://` URL → `pg` Pool + `drizzle-orm/node-postgres` (this is also what lets the smoke tests exercise the real SQL). No `DATABASE_URL` → `isDbConfigured()` false, every endpoint degrades gracefully (below).
- **tsconfig**: `api/` and `server/` live OUTSIDE `src`, so the app build (`tsc -b && vite build`) does not type-check them and stays green; they are plain TS with pragmatic `any` types, bundled by Vercel/esbuild at deploy and by the smoke harness locally.

## Schema (applied by POST /api/setup — 13 statements, all IF NOT EXISTS)
Tables: `users` (id serial, name, email unique, phone, password_hash, role customer|partner|admin, partner_code), `partners` (core columns + `data` jsonb holding the full frontend Partner record), `leads`, `bookings`, `orders` (`items` jsonb, `paid` flag), `quotes`, `payments` (reference unique, purpose, ref_id, amount_kobo, status), `settings` (key/value jsonb; the site document lives under key `site`), `offers`. Wide/volatile shapes (partner record, order items) are jsonb by design; money/status fields that the business queries on are real columns.

## Endpoints
- `GET /api/health` → `{ok, db, auth, payments, ts}` — the frontend's LIVE gate and the post-deploy check.
- `POST /api/setup` — header `x-setup-secret` must equal env `SETUP_SECRET`; applies the DDL idempotently; this is the production bootstrap (no shell DB access needed).
- Auth: `POST /api/auth/register` (bcryptjs cost 10; duplicate email → 409), `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` (401 `{user:null}` when signed out). Session = `jose` JWT (7 days) in httpOnly cookie `oketex_session`, secret env `AUTH_SECRET`. **Admin bootstrap**: env `ADMIN_EMAIL` + `ADMIN_PASSWORD` log in as admin with no users row.
- `GET /api/partners` (approved only) · `POST /api/partners` (→ pending) · `GET /api/partners/[code]` (full record by code = the partner's capability credential).
- `GET|PATCH /api/admin/partners` (admin session only) — list all; approve/reject, verified, featured flags.
- `POST /api/leads` (public; **commission % snapshotted server-side** from effective terms) · `GET /api/leads?partnerCode=` or admin-all · `PATCH/DELETE` admin.
- `POST /api/bookings`, `GET ?code=|?phone=` (phone match on last 10 digits), admin list + `PATCH` status. Same pattern for `POST /api/orders` + lookups; `POST /api/quotes` + admin list.
- `GET /api/settings` → `{live:false}` when no DB, else the stored document (or null). `PUT /api/settings` (admin) upserts key `site`. Resolution order everywhere: **server settings → local admin override → code defaults** (`src/lib/settings.ts` merges a cached server copy over the local doc per-field; the roof engine, terms and business details all read the merged result).
- `GET /api/offers` (public) · `POST/DELETE` (admin).
- Payments (Paystack, **fail-closed**): `POST /api/payments/initialize {email, amountNgn≥50, purpose, refId}` → no `PAYSTACK_SECRET_KEY` ⇒ `{enabled:false}` and the UI keeps the WhatsApp flow; else creates a `pending` payment row and returns `authorizationUrl` + `reference` (default callback `<origin>/payment/return`). `GET /api/payments/verify?reference=` → asks Paystack, **amount must match the stored row** before any effect. `POST /api/payments/webhook` (`bodyParser:false`; verifies `x-paystack-signature` = HMAC-SHA512 hex of the RAW body, timing-safe; amount match enforced; effects are idempotent): `partner_verification` → `partners.verified=true`; `partner_featured` → `featured=true, featured_until=now()+30d`; `order` → `orders.paid=true`; `booking_deposit` → `bookings.deposit_paid=true`. Money effects happen ONLY on these two verified paths — never on the browser's say-so.

## Frontend migration (API-first, demo fallback — localStorage code NOT deleted)
- `src/lib/api.ts`: `probeApi()` health gate, `apiFetch` (cookies included), `useApiLive()`, `paymentsApi`.
- `src/lib/auth.ts`: session client (the JWT never touches JS — httpOnly cookie only) + `useAuthUser()`.
- Async wrappers beside the sync stores: `storage.ts` (`saveOrderAsync`, `findOrdersAsync` merges server+local deduped by code, quotes…), `proStorage.ts` (bookings), `partnerStorage.ts` (partners, leads, offers), `settings.ts` (`fetchServerSettings`, `saveSettingsAsync` PUTs the full effective doc so saving one group never wipes another).
- Pages: `/account` is real login/register when live (demo explainer + device lists otherwise; signed-in users also pull their phone's server orders/bookings); header shows the account name / Sign-in; `/join` gained an optional password → creates the partner's login attached to their code; `/partner-status` looks up via API and its upgrade cards have **Pay with Paystack** beside WhatsApp; checkout has **Pay now with Paystack** (redirects only when the server says enabled); new `/payment/return` page verifies the reference server-side and shows the outcome; `/track` merges server results and shows "Paid online via Paystack ✓".
- **Admin**: LIVE/DEMO badge from `/api/health`. LIVE → email+password sign-in via `/api/auth` (bootstrap admin or admin-role user; the demo `sessionStorage` flag alone no longer suffices — mount re-verifies `role==="admin"` via `/auth/me`), all tabs hydrate through the async wrappers (server data), settings saves PUT to the server. DEMO → the exact old `admin123` gate and local data.

## ENV CHECKLIST (Vercel project → Settings → Environment Variables)
| Var | Purpose | While missing |
|---|---|---|
| `DATABASE_URL` | Neon (or any Postgres) connection string | Whole backend inert: health `db:false`, site runs 100% demo |
| `AUTH_SECRET` | JWT signing (≥16 chars, long random) | `auth:false` in health; logins can't issue sessions |
| `SETUP_SECRET` | Guards `POST /api/setup` | Setup endpoint refuses all calls (safe) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Bootstrap admin login | No bootstrap admin; only users-table admins (none until one is promoted in SQL) |
| `PAYSTACK_SECRET_KEY` | Server-side Paystack (use `sk_test_…` first) | Payments `{enabled:false}`; WhatsApp flow everywhere, nothing breaks |
| `PAYSTACK_PUBLIC_KEY` | Reserved for future inline checkout | Unused by the current redirect flow |

## Go-live runbook
1. Create a Neon project → copy the pooled `DATABASE_URL`. Set all env vars above in Vercel (Production), redeploy.
2. **POST-DEPLOY CHECK #1**: `curl https://oketex-and-sons-aluminum-company.vercel.app/api/health` must return **JSON** (`{"ok":true,"db":false,...}` before the DB var, `"db":true` after). If it returns `index.html`, the SPA rewrite swallowed the function — stop and fix routing before anything else. (Current `vercel.json` was left unchanged on purpose: Vercel serves `/api` functions with filesystem precedence over rewrites, and the existing fallback already excludes `api/` via its negative lookahead — the live site's deep links depend on that structure.)
3. Bootstrap schema: `curl -X POST …/api/setup -H "x-setup-secret: <SETUP_SECRET>"` → `{ok:true, statementsApplied:13}`.
4. Sign in at `/admin` with `ADMIN_EMAIL`/`ADMIN_PASSWORD` → badge must read **Mode: LIVE (database)**.
5. Paystack: start with **TEST keys** from the business's Paystack dashboard (Settings → API Keys & Webhooks); register the webhook URL **`https://oketex-and-sons-aluminum-company.vercel.app/api/payments/webhook`**; run a ₦100 test payment from a partner upgrade card and confirm the badge activates via `/payment/return` + dashboard. Switch to live keys only after that passes. Amounts are verified against the stored payment row on both verify and webhook paths, so a tampered callback cannot apply effects.

## Verification (this sandbox — no real Neon/Paystack reachable)
- `npm run build` green (tsc + vite).
- `npm run test:api` — **41 checks, all passing**. esbuild bundles the REAL handlers/server libs with only `server/db` swapped for a pg-mem-backed mock (same SQL, in-memory Postgres): schema applies (13 statements, 9 tables), health flags, register/login/cookie/duplicate-409/wrong-password-401, JWT round-trip + tamper rejection, bcrypt verify, admin bootstrap, partner pending→approve→public flow with non-admin gates, lead snapshots at default 5% then at admin-PUT 9%, orders/bookings/quotes round-trips (incl. phone lookup), payments fail-closed, webhook HMAC accept/reject, verification effect applied, replay-safe, amount-mismatch blocked. Honest gaps: pg-mem can't re-apply `CREATE TABLE IF NOT EXISTS` over tables with literal defaults (real Postgres treats it as a no-op — idempotency asserted via table-existence instead), and pg-mem lacks the 4-arg `regexp_replace` so the mock registers a faithful JS equivalent (production SQL unchanged).
- **Still unverifiable until production env exists**: the live Neon HTTP transport end-to-end, Paystack's live initialize/verify round-trip against api.paystack.co, cookie behaviour on the real domain, and the `/api/health`-returns-JSON check — all covered by the runbook above.
- Demo-fallback proof: the built bundle contains the `/api/health` probe, the `oketex-api-live` cache flag and both mode badges; with no env the probe fails → `live=false` → every wrapper uses the untouched localStorage implementations (Phases 1–4 behaviour byte-for-byte the fallback path).
