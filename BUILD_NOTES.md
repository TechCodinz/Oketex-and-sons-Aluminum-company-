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

## Deviations / notes
- Corrugated in the calculator uses the colour sheet price (₦8,900) as the default estimator price (mill ₦7,500 is in the shop catalog) — documented in code.
- Stone-coated nails are an estimator-rate line (₦45/pc, ~12/m²) — no catalog nail product exists.
- Snap-Measure sends Roof Width as calculator length and derives width as 2× slope length as a starting point (explained in its UI); pitch still needs setting in the calculator. It is honest assisted measurement, not AI.
- Window Pricer glass/finish multipliers are labelled estimates anchored to the catalog casement baseline (₦145,000 per 1.44m²).
- `npm run build` (tsc + vite) passes clean. Deploy: any static host / Vercel with root `oketex-enhanced/app`, build `npm run build`, output `dist`. SPA fallback rewrite to `index.html` is needed on the host for deep links.
