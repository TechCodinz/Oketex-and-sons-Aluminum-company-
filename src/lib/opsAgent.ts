// Oketex Ops Agent (Staff System, 2026-10-25) — RULES MODE. Pure functions
// over the same stores the Admin tabs load: no AI calls, no invented
// prices, and the agent NEVER sends or saves anything by itself — it
// drafts, flags and recommends; people approve money, prices and
// assignments. When the AI_VISION env slot is connected elsewhere in the
// app this module stays rules-based and is labelled as such in the UI.
import { needsAttention, type AttentionRow } from "./needsAttention";
import { renderTemplate, ngWaDigits, type NotifyTemplateKey } from "./notify";
import { invoiceBalance, invoiceDisplayStatus, type DocInvoice } from "./docStorage";
import { summarizeReviews, type Review } from "./reviews";
import { partnerAvailable, type Partner, type Lead } from "./partnerStorage";
import { lowStockFlags, type StockDoc, type CoilStock } from "./stock";
import { formatNGN } from "./money";
import { knowledgeBriefing, type KnowledgeEntry } from "./knowledge";
import { marginPct, realizedProfit } from "./profit";
import { aggregateDemand, type SourceRequest } from "./sourceRequests";
import type { LocalOrder, LocalQuote } from "./storage";
import type { LocalBooking } from "./proStorage";
import type { SnapRequest } from "./snapRequests";
import type { ProductionJob } from "./production";
import type { SupplyRequest } from "./supply";

export interface OpsData {
  orders: LocalOrder[]; quotes: LocalQuote[]; bookings: LocalBooking[]; leads: Lead[];
  snapRequests: SnapRequest[];
  jobs: { status: string; bids?: unknown[]; code?: string; createdAt?: string }[];
  verifyRequests: { code: string; status: string; createdAt: string }[];
  partners: Partner[]; reviews: Review[];
  invoices: DocInvoice[]; productionJobs: ProductionJob[];
  stock: StockDoc; staffPhones?: { name: string; phone: string }[];
  supplyRequests?: SupplyRequest[];
  knowledgeEntries?: KnowledgeEntry[];
  /** Profit Intelligence (2026-10-26): effective price/cost rows for the
   *  whole catalogue + the admin target margin. */
  profit?: { rows: { price: number; cost: number | null }[]; targetMarginPct: number };
  /** Source-Anything queue for the sourcing tile. */
  sourceRequests?: SourceRequest[];
}

const HOUR = 3600_000;
const ageHours = (ts: string, now: Date) => Math.max(0, Math.round((now.getTime() - new Date(ts).getTime()) / HOUR));
const sameDay = (ts: string, now: Date) => { const d = new Date(ts); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate(); };
const withinDays = (ts: string, now: Date, days: number) => now.getTime() - new Date(ts).getTime() <= days * 24 * HOUR;

// ---------------- Briefing ----------------
export interface StuckItem { kind: string; code: string; label: string; ageHours: number; tab: string }
export interface OpsBriefing {
  newToday: { key: string; label: string; count: number }[];
  stuck: StuckItem[];
  money: { ordersTodayNgn: number; ordersWeekNgn: number; ordersTodayCount: number; commissionsEarnedNgn: number; commissionsPipelineNgn: number };
  pending: AttentionRow[];
  production: { queuedStale: ProductionJob[]; qcFailuresToday: number; lowStock: CoilStock[]; bundledStale: ProductionJob[] };
  supply: { awaitingQuotesStale: SupplyRequest[]; approvedOverdue: SupplyRequest[] };
  knowledge: { pendingReview: number; topFixThisWeek: { title: string; confirmations: number } | null };
  /** Profit tile: products priced below the target margin + the biggest
   *  realized-profit category from order cost snapshots (null = no
   *  costed orders yet — the honest state, never a fabricated number). */
  profit: { belowTargetCount: number; topRealizedCategory: string | null; hasCostedOrders: boolean };
  /** Sourcing tile: unquoted Source-Anything requests + top demanded keyword. */
  sourcing: { unquoted: number; topKeyword: string | null };
}
export function buildBriefing(data: OpsData, now: Date = new Date()): OpsBriefing {
  const newToday = [
    { key: "orders", label: "New orders", count: data.orders.filter(o => sameDay(o.createdAt, now)).length },
    { key: "quotes", label: "New quotes", count: data.quotes.filter(q => sameDay(q.createdAt, now)).length },
    { key: "bookings", label: "New bookings", count: data.bookings.filter(b => sameDay(b.createdAt, now)).length },
    { key: "snap", label: "New Snap & Send", count: data.snapRequests.filter(r => sameDay(r.createdAt, now)).length },
    { key: "leads", label: "New partner leads", count: data.leads.filter(l => sameDay(l.createdAt, now)).length },
    { key: "production", label: "New production jobs", count: data.productionJobs.filter(j => sameDay(j.createdAt, now)).length },
  ];
  const stuck: StuckItem[] = [];
  const pushStuck = (kind: string, code: string, label: string, ts: string, tab: string) => {
    const age = ageHours(ts, now);
    if (age > 24) stuck.push({ kind, code, label, ageHours: age, tab });
  };
  for (const o of data.orders) if (o.status === "pending") pushStuck("order", o.code, `Order from ${o.name} — ${formatNGN(o.totalNgn)}`, o.createdAt, "orders");
  for (const q of data.quotes) if (q.status === "new") pushStuck("quote", q.code, `Quote for ${q.name} — ${formatNGN(q.estimateNgn)}`, q.createdAt, "quotes");
  for (const b of data.bookings) if (b.status === "pending") pushStuck("booking", b.code, `${b.serviceLabel} for ${b.name}`, b.createdAt, "bookings");
  for (const r of data.snapRequests) if (!["Completed", "Declined"].includes(r.status)) pushStuck("snap", r.code, `Snap & Send (${r.status}) — ${r.customerName}`, r.updatedAt || r.createdAt, "snap");
  for (const v of data.verifyRequests) if (v.status === "Requested") pushStuck("verify", v.code, "Pro Check verification waiting", v.createdAt, "verify");
  for (const l of data.leads) if (l.status === "new") pushStuck("lead", l.id, `Lead for ${l.partnerName} — ${l.customerName}`, l.createdAt, "partners");
  for (const j of data.productionJobs) if (!["Delivered"].includes(j.status)) pushStuck("production", j.code, `Production ${j.product.name} (${j.status})`, j.updatedAt || j.createdAt, "production");
  stuck.sort((a, b) => b.ageHours - a.ageHours);

  const liveOrders = data.orders.filter(o => o.status !== "cancelled");
  const money = {
    ordersTodayNgn: liveOrders.filter(o => sameDay(o.createdAt, now)).reduce((s, o) => s + o.totalNgn, 0),
    ordersWeekNgn: liveOrders.filter(o => withinDays(o.createdAt, now, 7)).reduce((s, o) => s + o.totalNgn, 0),
    ordersTodayCount: liveOrders.filter(o => sameDay(o.createdAt, now)).length,
    commissionsEarnedNgn: data.leads.filter(l => l.status === "paid").reduce((s, l) => s + l.commissionNgn, 0),
    commissionsPipelineNgn: data.leads.filter(l => l.status === "won").reduce((s, l) => s + l.commissionNgn, 0),
  };
  const pending = needsAttention({
    orders: data.orders, quotes: data.quotes, bookings: data.bookings,
    verifyRequests: data.verifyRequests, partners: data.partners,
    jobs: data.jobs, snapRequests: data.snapRequests, leads: data.leads,
    sourceRequests: data.sourceRequests,
  });
  const production = {
    queuedStale: data.productionJobs.filter(j => j.status === "Queued" && ageHours(j.updatedAt || j.createdAt, now) > 24),
    qcFailuresToday: data.productionJobs.reduce((s, j) => s + (j.qcHistory || []).filter(q => q.result === "fail" && sameDay(q.at, now)).length, 0),
    lowStock: lowStockFlags(data.stock),
    bundledStale: data.productionJobs.filter(j => j.status === "Bundled" && ageHours(j.updatedAt || j.createdAt, now) > 24),
  };
  const supplyReqs = data.supplyRequests || [];
  const supply = {
    awaitingQuotesStale: supplyReqs.filter(r => r.status === "Open" && ageHours(r.createdAt, now) > 48),
    approvedOverdue: supplyReqs.filter(r => r.status === "Approved" && !!r.neededBy && r.neededBy < now.toISOString().slice(0, 10)),
  };
  const knowledge = knowledgeBriefing(data.knowledgeEntries || [], now);
  const profitRows = data.profit?.rows || [];
  const target = data.profit?.targetMarginPct ?? 25;
  const realized = realizedProfit(data.orders || []);
  const profit = {
    belowTargetCount: profitRows.filter(r => r.cost != null && r.cost > 0 && marginPct(r.price, r.cost) < target).length,
    topRealizedCategory: realized.perCategory[0]?.categorySlug ?? null,
    hasCostedOrders: realized.costedLines > 0,
  };
  const srcReqs = data.sourceRequests || [];
  const demand = aggregateDemand(srcReqs);
  const sourcing = { unquoted: srcReqs.filter(r => r.status === "Received").length, topKeyword: demand[0]?.keyword ?? null };
  return { newToday, stuck, money, pending, production, supply, knowledge, profit, sourcing };
}

// ---------------- Chasers ----------------
export interface ChaserItem {
  kind: "snap_approval" | "snap_progress" | "invoice_payment" | "operator_stale";
  code: string; audience: "customer" | "partner" | "staff";
  name: string; phone: string; message: string; waLink: string | null;
  reason: string; ageHours: number;
}
function chase(kind: ChaserItem["kind"], code: string, audience: ChaserItem["audience"], name: string, phone: string, template: NotifyTemplateKey, vars: Record<string, string>, reason: string, age: number): ChaserItem {
  const message = renderTemplate(template, vars);
  const digits = ngWaDigits(phone || "");
  return { kind, code, audience, name, phone, message, waLink: digits.length >= 10 ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null, reason, ageHours: age };
}
export function buildChasers(data: OpsData, now: Date = new Date()): ChaserItem[] {
  const out: ChaserItem[] = [];
  const partnerByCode = new Map(data.partners.map(p => [p.code, p]));
  for (const r of data.snapRequests) {
    const age = ageHours(r.updatedAt || r.createdAt, now);
    if (r.status === "Priced" && age > 24) {
      out.push(chase("snap_approval", r.code, "customer", r.customerName, r.customerPhone, "chase_snap_approval",
        { name: r.customerName, code: r.code, amount: formatNGN(r.totalNgn) },
        `Priced ${age}h ago — customer has not approved yet`, age));
    }
    if ((r.status === "Assigned" || r.status === "In Progress")) {
      const lastTs = r.timeline.length ? r.timeline[r.timeline.length - 1].ts : r.updatedAt;
      const idle = ageHours(lastTs || r.updatedAt, now);
      if (idle > 48) {
        const p = r.assignedPartnerCode ? partnerByCode.get(r.assignedPartnerCode) : undefined;
        out.push(chase("snap_progress", r.code, "partner", r.assignedPartnerName || p?.businessName || "Assigned pro", p?.phone || "", "chase_partner_progress",
          { partner: r.assignedPartnerName || p?.businessName || "", code: r.code },
          `No progress update in ${idle}h on an assigned job`, idle));
      }
    }
  }
  const todayISO = now.toISOString().slice(0, 10);
  for (const inv of data.invoices) {
    const display = invoiceDisplayStatus(inv);
    const balance = invoiceBalance(inv);
    if (balance > 0 && inv.dueDate && inv.dueDate < todayISO && ["Sent", "Part Paid", "Overdue"].includes(display)) {
      out.push(chase("invoice_payment", inv.code, "customer", inv.clientName, inv.clientPhone, "chase_invoice_payment",
        { name: inv.clientName, code: inv.code, balance: formatNGN(balance), due: inv.dueDate },
        `Invoice balance ${formatNGN(balance)} past due (${inv.dueDate})`, ageHours(inv.updatedAt || inv.createdAt, now)));
    }
  }
  for (const j of data.productionJobs) {
    const idle = ageHours(j.updatedAt || j.createdAt, now);
    if (j.status === "In Production" && idle > 48) {
      const staff = (data.staffPhones || []).find(s => s.name.trim().toLowerCase() === (j.operatorName || "").trim().toLowerCase());
      out.push(chase("operator_stale", j.code, "staff", j.operatorName || "Operator", staff?.phone || "", "chase_operator_stale",
        { name: j.operatorName || "Operator", code: j.code, title: j.product.name },
        `In Production for ${idle}h without a finish update`, idle));
    }
  }
  return out.sort((a, b) => b.ageHours - a.ageHours);
}

// ---------------- Assessment drafter ----------------
export interface DraftItem { name: string; qty: number; unitPrice: number; matched: boolean; note: string }
export interface AssessmentDraft {
  items: DraftItem[]; transportNgn: number; transportNote: string;
  workmanshipNgn: 0; flags: string[]; tools: string[];
}
/** Tools the drafter suggests from the customer's own words — a small,
 *  honest rule table (no rule, no suggestion). The admin ticks/edits the
 *  final list in the assessment editor; tools are never priced lines. */
export const TOOL_RULES: { test: RegExp; tools: string[] }[] = [
  { test: /leak|drip|seep/, tools: ["Sealant gun"] },
  { test: /plumb|pipe|tap\b|toilet|basin|water damage|burst/, tools: ["Pipe wrench", "Water pump pliers"] },
  { test: /roof|sheet|gutter|ridge|ceiling/, tools: ["Ladder", "Drill machine", "Measuring tape", "Safety boots/gloves"] },
  { test: /tile|tiling|plaster|screed|render/, tools: ["Trowel", "Spirit level"] },
  { test: /weld|gate|steel|iron|metal/, tools: ["Welding machine", "Angle grinder", "Safety boots/gloves"] },
  { test: /electric|wiring|socket|breaker|lighting|fan\b/, tools: ["Screwdriver set"] },
  { test: /scaffold|storey|high-rise|tall building/, tools: ["Scaffold"] },
];
export function suggestTools(description: string): string[] {
  const text = (description || "").toLowerCase();
  const out: string[] = [];
  for (const rule of TOOL_RULES) if (rule.test.test(text)) for (const t of rule.tools) if (!out.includes(t)) out.push(t);
  return out;
}
interface CatalogLike { name: string; priceNgn: number; unit: string }
const ZONE_KEYWORDS: { zone: string; words: string[] }[] = [
  { zone: "abuja-north", words: ["abuja", "fct", "kaduna", "kano", "jos", "zaria", "minna", "north"] },
  { zone: "ss-se", words: ["port harcourt", "ph city", "delta", "asaba", "benin city", "edo", "enugu", "owerri", "anambra", "imo", "uyo", "calabar", "south-east", "south-south", "warri", "bayelsa"] },
  { zone: "south-west", words: ["ibadan", "oyo", "osun", "osogbo", "ondo", "akure", "ekiti", "ado ekiti", "ilorin"] },
  { zone: "ogun-lagos", words: ["lagos", "ogun", "ibafo", "magboro", "mowe", "sango", "ota", "abeokuta", "berger", "ikeja", "lekki", "ajah", "ikorodu", "sagamu"] },
];
/** Rules-mode draft for a Snap & Send assessment. Prices come ONLY from the
 *  live catalogue (matched by name) or are left at 0 with a flag — the
 *  agent never invents a price, and workmanship is always left for a human. */
export function draftAssessment(
  input: { description: string; intent: string; address: string },
  products: CatalogLike[],
  rates: { deliveryZones: Record<string, number> },
): AssessmentDraft {
  const text = `${input.description || ""}`.toLowerCase();
  const flags: string[] = [];
  const items: DraftItem[] = [];
  const findProduct = (needle: string) => products.find(p => p.name.toLowerCase().includes(needle));
  const metresInText = (() => { const m = text.match(/(\d+(?:\.\d+)?)\s*(m|metre|meter)\b/); return m ? parseFloat(m[1]) : null; })();
  const pushMatched = (product: CatalogLike, qty: number, note: string) => {
    if (!items.some(i => i.name === product.name)) items.push({ name: product.name, qty, unitPrice: product.priceNgn, matched: true, note });
  };
  if (input.intent === "sell") flags.push("Sell request — convert it to a partner lead instead of pricing a repair job.");
  if (/gutter|downpipe|rainwater/.test(text)) {
    const g = findProduct("gutter");
    if (g) pushMatched(g, metresInText ?? 1, metresInText ? "Length read from the customer's description — confirm on site" : "Qty 1 — confirm the gutter length on site");
  }
  if (/leak|drip/.test(text)) {
    items.push({ name: "Leak repair — sealant, flashing & fixings (confirm scope on site)", qty: 1, unitPrice: 0, matched: false, note: "No catalogue line for leak sealing — price it after inspection" });
    flags.push("Leak reported — the sealant/flashing line is unpriced on purpose; a human prices it after inspection.");
    const sil = findProduct("silicone sealant");
    if (sil) pushMatched(sil, 1, "Silicone sealant stocked — confirm cartridge count on site");
  }
  if (/rust|corrod/.test(text) || (/replace/.test(text) && /sheet/.test(text)) || /\bsheet/.test(text)) {
    const s = findProduct("longspan") || findProduct("sheet");
    if (s) pushMatched(s, 1, "Sheet work mentioned — confirm gauge, colour and quantity on site");
  }
  if (/stone|tile/.test(text) && /roof|sheet|replace|install/.test(text)) {
    const t = findProduct("stone-coated");
    if (t) pushMatched(t, 1, "Stone-coated tiles mentioned — confirm quantity on site");
  }
  if (/window/.test(text)) { const w = findProduct("window"); if (w) pushMatched(w, 1, "Window mentioned — confirm size and count"); }
  if (/insulation|foil/.test(text)) { const f = findProduct("insulation"); if (f) pushMatched(f, 1, "Insulation mentioned — confirm roll count"); }
  if (/screw|fastener|nail/.test(text)) { const f = findProduct("fastener"); if (f) pushMatched(f, 1, "Fasteners mentioned — confirm bucket count"); }
  // ---- Store Stock-Up categories (2026-10-26): the drafter prices the
  // new shelves from the same catalogue — every rule no-ops when the
  // product is not in the passed catalogue.
  if (/ridge/.test(text)) { const r = findProduct("ridge cap"); if (r) pushMatched(r, metresInText ?? 1, "Ridge cap mentioned — confirm metres on site"); }
  if (/sealant|silicone/.test(text)) { const s = findProduct("silicone sealant"); if (s) pushMatched(s, 1, "Sealant mentioned — confirm cartridge count"); }
  if (/til(e|es|ing)\b/.test(text) && !/roof/.test(text)) {
    const t = findProduct("ceramic floor tiles") || findProduct("porcelain");
    if (t) pushMatched(t, 1, "Tiling mentioned — confirm tile area and carton count");
    const a = findProduct("tile adhesive");
    if (a) pushMatched(a, 1, "Tile adhesive (gum cement) — roughly 1 bag per 4–5m²");
  }
  if (/grout/.test(text)) { const g = findProduct("tile grout"); if (g) pushMatched(g, 1, "Grout mentioned — confirm bag count"); }
  if (/paint|repaint/.test(text)) { const p = findProduct("emulsion paint"); if (p) pushMatched(p, 1, "Painting mentioned — emulsion priced; confirm drums and colour"); }
  if (/\bpop\b/.test(text)) { const p = findProduct("pop cement"); if (p) pushMatched(p, 1, "POP work mentioned — confirm bag count"); }
  if (/screed/.test(text)) { const p = findProduct("screeding putty"); if (p) pushMatched(p, 1, "Screeding mentioned — confirm bag count"); }
  if (/cement|blockwork|foundation|slab|concrete/.test(text)) { const c = findProduct("portland cement"); if (c) pushMatched(c, 1, "Cement mentioned — confirm bag count (day price on order)"); }
  if (/rod|rebar|reinforcement/.test(text)) { const r = findProduct("reinforcement rod 12mm"); if (r) pushMatched(r, 1, "Reinforcement mentioned — 12mm priced; confirm sizes and lengths from the drawing"); }
  if (/binding wire/.test(text)) { const w = findProduct("binding wire"); if (w) pushMatched(w, 1, "Binding wire mentioned — confirm rolls"); }
  if (/\bwc\b|toilet|water closet/.test(text)) { const w = findProduct("water closet"); if (w) pushMatched(w, 1, "WC mentioned — confirm rough-in (wall/floor outlet)"); }
  if (/basin/.test(text)) { const b = findProduct("wash hand basin"); if (b) pushMatched(b, 1, "Basin mentioned — confirm count"); }
  if (/tank|water storage/.test(text)) { const t = findProduct("water tank"); if (t) pushMatched(t, 1, "Water tank mentioned — confirm capacity"); }
  if (/heater|hot water/.test(text)) { const h = findProduct("water heater"); if (h) pushMatched(h, 1, "Water heater mentioned — confirm capacity"); }
  if (/pipe|pvc|ppr/.test(text)) { const p = /drain|waste|soil/.test(text) ? findProduct("drainage pipe") : findProduct("pressure pipe"); if (p) pushMatched(p, 1, "Pipe mentioned — confirm lengths and fittings"); }
  if (/tap|mixer/.test(text)) { const t = findProduct("basin mixer"); if (t) pushMatched(t, 1, "Tap mentioned — confirm count"); }
  if (/cable|wiring/.test(text)) { const c = findProduct("copper cable 2.5mm"); if (c) pushMatched(c, 1, "Wiring mentioned — 2.5mm priced; confirm sizes (1.5mm lights / 4mm heavy loads) and coils"); }
  if (/socket/.test(text)) { const s = findProduct("double socket"); if (s) pushMatched(s, 1, "Sockets mentioned — confirm point count"); }
  if (/switch/.test(text)) { const s = findProduct("2-gang"); if (s) pushMatched(s, 1, "Switches mentioned — confirm count"); }
  if (/\bfan\b/.test(text)) { const f = findProduct("ceiling fan"); if (f) pushMatched(f, 1, "Ceiling fan mentioned — confirm count"); }
  if (/distribution board|\bdb\b/.test(text)) { const d = findProduct("distribution board"); if (d) pushMatched(d, 1, "Distribution board mentioned — confirm ways"); }
  if (/lock/.test(text)) { const l = findProduct("mortise lock"); if (l) pushMatched(l, 1, "Lock mentioned — confirm door count"); }
  if (/hinge/.test(text)) { const h = findProduct("soft-close cabinet hinges"); if (h) pushMatched(h, 1, "Hinges mentioned — confirm door count (sold per pair)"); }
  if (!items.length && input.intent !== "sell") flags.push("No catalogue match in the description — add the items manually.");

  const addr = (input.address || "").toLowerCase();
  let transportNgn = 0; let transportNote = "Set transport — the site address zone was not recognised.";
  for (const z of ZONE_KEYWORDS) {
    if (z.words.some(w => addr.includes(w))) {
      transportNgn = Math.max(0, Math.round(rates.deliveryZones[z.zone] || 0));
      transportNote = transportNgn > 0 ? `Matched the ${z.zone} delivery zone from the address` : "Pickup zone — no transport fee";
      break;
    }
  }
  if (!transportNgn) flags.push(transportNote);
  flags.push("Set workmanship — the agent never prices labour; a human sets it.");
  const tools = suggestTools(input.description || "");
  if (tools.length) flags.push(`Suggested tools from the description: ${tools.join(", ")} — confirm in the editor.`);
  return { items, transportNgn, transportNote, workmanshipNgn: 0, flags, tools };
}

// ---------------- Assignment recommender ----------------
export interface PartnerCandidate {
  partner: Partner; score: number; rating: number; ratingCount: number; ratingLabel: string;
  load: number; distanceKm: number | null; areaMatch: string | null; reasons: string[];
}
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371; const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat); const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}
const AREA_STOPWORDS = new Set(["street", "st", "road", "rd", "avenue", "ave", "close", "crescent", "drive", "lane", "state", "nigeria", "off", "opp", "near", "along", "expressway", "area", "zone", "phase", "plot", "house", "no"]);
/** Normalised area tokens from a free-text address ("14 Unity Rd, Ibafo,
 *  Ogun State" → ["unity", "ibafo", "ogun"]). */
export function addressTokens(address: string): string[] {
  return Array.from(new Set((address || "").toLowerCase().split(/[^a-z0-9]+/).map(t => t.trim()).filter(t => t.length >= 3 && !AREA_STOPWORDS.has(t))));
}
const labelTokensOf = (label: string) => label.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 3 && !AREA_STOPWORDS.has(t));
/** Does this partner list the customer's area? `areas` entries match on
 *  ANY of their tokens — partners write their coverage freely ("Lekki,
 *  Ajah", "delivery across Lagos"). The base `location` is only a
 *  fallback and matches on its FIRST token (the base town in "Ibafo,
 *  Ogun") — otherwise every Lagos-based partner would "cover" every
 *  Lagos address through the shared state word. Returns the label AS THE
 *  PARTNER WROTE IT (for the reason line), or null. */
export function partnerAreaMatch(p: Partner, tokens: string[]): string | null {
  if (!tokens.length) return null;
  const tokenSet = new Set(tokens);
  for (const label of String(p.areas || "").split(/[,;]/).map(s => s.trim()).filter(Boolean)) {
    if (labelTokensOf(label).some(t => tokenSet.has(t))) return label;
  }
  const location = String(p.location || "").trim();
  const first = location ? labelTokensOf(location)[0] : undefined;
  if (location && first && tokenSet.has(first)) return location;
  return null;
}
const AREA_BONUS = 60;   // region-first: a pro who covers the area outranks a higher-rated outsider
const BUDGET_BONUS = 15; // only when NO candidate covers the area (see below)
/** Rank approved + available partners for a job, REGION FIRST:
 *  trade is a HARD filter. A partner whose listed areas (or base location)
 *  cover the customer's address gets a strong bonus and the reason
 *  "Covers your area — {area}". Score otherwise = rating × 10 − active
 *  load × 8 + a distance bonus inside 20 km. When NO candidate covers the
 *  area, the top picks carry "No pro lists this area — best available by
 *  rating & workload", and — only when an agreed/budget figure AND past
 *  lead values exist — the candidate whose past work came closest UNDER
 *  that figure is preferred (no lead data → rating & workload only; the
 *  agent never invents a partner price). Unrated partners get a clearly
 *  labelled neutral 3.0 baseline. The admin still assigns manually. */
export function recommendPartners(input: {
  trade?: string; partners: Partner[]; reviews: Review[];
  snapRequests: SnapRequest[]; siteGeo?: { lat: number; lng: number } | null;
  address?: string; agreedPriceNgn?: number | null; leads?: Lead[];
}): PartnerCandidate[] {
  const trade = (input.trade || "").trim();
  const candidates = input.partners.filter(p => {
    if (p.status !== "approved" || !partnerAvailable(p)) return false;
    if (!trade) return true;
    return p.trades.includes(trade) || p.categories.includes(trade);
  });
  const tokens = addressTokens(input.address || "");
  const areaMatches = new Map(candidates.map(p => [p.code, partnerAreaMatch(p, tokens)]));
  const anyAreaCovered = [...areaMatches.values()].some(Boolean);
  // Budget fallback data: each candidate's largest past lead at/under the
  // agreed figure. Computed only when the area route found nobody.
  const budget = input.agreedPriceNgn != null && input.agreedPriceNgn > 0 ? input.agreedPriceNgn : null;
  const bestUnder = new Map<string, number>();
  if (!anyAreaCovered && tokens.length && budget && input.leads?.length) {
    for (const p of candidates) {
      const under = input.leads.filter(l => l.partnerCode === p.code && l.estValueNgn > 0 && l.estValueNgn <= budget).map(l => l.estValueNgn);
      if (under.length) bestUnder.set(p.code, Math.max(...under));
    }
  }
  const closestUnder = bestUnder.size ? Math.max(...bestUnder.values()) : null;
  const scored = candidates.map(partner => {
    const summary = summarizeReviews(input.reviews.filter(r => r.partnerCode === partner.code && r.status === "Published"));
    const rated = summary.count > 0;
    const rating = rated ? summary.avg : 3.0;
    const ratingLabel = rated ? `${summary.avg}★ from ${summary.count} review${summary.count === 1 ? "" : "s"}` : "No reviews yet — neutral 3.0 baseline";
    const load = input.snapRequests.filter(r => r.assignedPartnerCode === partner.code && ["Assigned", "In Progress"].includes(r.status)).length;
    const pGeo = (partner as Partner & { geo?: { lat: number; lng: number } | null }).geo;
    const distanceKm = input.siteGeo && pGeo ? haversineKm(input.siteGeo, pGeo) : null;
    const distanceBonus = distanceKm != null ? Math.max(0, 20 - distanceKm) : 0;
    const areaMatch = areaMatches.get(partner.code) ?? null;
    const budgetWin = closestUnder != null && bestUnder.get(partner.code) === closestUnder;
    const score = Math.round((rating * 10 - load * 8 + distanceBonus + (areaMatch ? AREA_BONUS : 0) + (budgetWin ? BUDGET_BONUS : 0)) * 10) / 10;
    const reasons: string[] = [];
    if (areaMatch) reasons.push(`Covers your area — ${areaMatch}`);
    else if (tokens.length && !anyAreaCovered) reasons.push("No pro lists this area — best available by rating & workload");
    if (budgetWin) reasons.push(`Closest past work under the agreed price — ${formatNGN(closestUnder!)}`);
    reasons.push(ratingLabel, `${load} active Snap & Send job${load === 1 ? "" : "s"}`, distanceKm != null ? `~${distanceKm} km from site` : "Distance unknown");
    return { partner, score, rating, ratingCount: summary.count, ratingLabel, load, distanceKm, areaMatch, reasons };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}
