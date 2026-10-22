# Oketex & Sons Aluminum Co. — Enhanced Website

Industrial aluminium roofing & building-materials site with an engineering-grade
roof calculator, photo Snap-Measure, and a real-time Visualizer Studio.
Standalone frontend — **no backend, database or login service required**.

## Run locally
```bash
npm install
npm run dev      # development
npm run build    # production build -> dist/
npm run preview  # serve the production build
```

## Deploy on Vercel
1. Import this repo in Vercel (framework: **Vite**).
2. Build command `npm run build`, output directory `dist` (auto-detected).
3. `vercel.json` in this repo already provides the SPA fallback rewrite so
   deep links like `/quote` work.

## Pages
- `/` Home · `/shop` · `/product/:slug` · `/checkout` · `/track` · `/gallery`
- `/quote` — **Pro Roof Calculator**: dimensions + pitch + profile -> true slope
  area, sheet cutting list, tiles, ridge, fasteners, gutters, labour, delivery,
  full Bill of Quantities (print/PDF, WhatsApp, save). Demo quotes are stored in
  the browser (localStorage).
- `/snap-measure` — photograph a building, calibrate on a known object
  (e.g. a 2.1 m door), draw measurement lines, send dimensions to the calculator.
- `/visualizer` — real-time house visualizer: roof shapes, profile patterns,
  14 colours, wall types (plaster, brick, stone, ACP, timber), cinematic
  lighting presets + tour, PNG snapshot, "Price this look".
- `/tools` — Pitch Finder, Aluminium Weight, Gutter & Rainwater Sizer,
  Window & Door Pricer, Coverage Converter.
- `/services` — 8 services in detail. `/assistant` — offline product advisor.
- `/admin` — demo admin (password `admin123`), reads locally saved quotes/orders.

## Before launch — confirm with the owner
Business phone/WhatsApp (+234 803 555 0192), email, address and the headline
stats in `src/data/catalog.ts` / `src/contracts/constants.ts` came from the
original template and may be placeholders. Estimator-only rates (ridge
NGN 4,500/m, timber NGN 1,800/m, installation NGN 2,200/m2, delivery zones)
are labelled "estimator rate" in the UI and live in `src/lib/roofEngine.ts`.

Engineering notes: see `BUILD_NOTES.md` one level up in the handover package,
or `src/lib/roofEngine.ts` for the formulas (slope factor 1/cos(pitch), etc.).
