// Feature verification for Deliverables A–F (run: node scripts/verify-features.mjs)
// Bundles the REAL lib helpers with esbuild and asserts the spec fixtures.
import { build } from "esbuild";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const entry = `
export { quotationTotals, invoiceTotals, invoiceBalance, invoiceDisplayStatus, milestoneTotalPct } from "@/lib/docStorage";
export { eavesCalc, pitchFromRiseRun } from "@/data/roofingGuide";
export { computeEntitlements, redeemPlanCode, DEFAULT_PLANS } from "@/lib/plans";
export { computeAssistantRange, parseDims, parseArea, parsePitch, isQuoteIntent } from "@/lib/assistantBrain";
export { calculateRoof } from "@/lib/roofEngine";
export { couponDiscountNgn, validateCoupon, orderGrandTotal, dispatchFor } from "@/lib/settings";
export { summarizeReviews } from "@/lib/reviews";
export { assessmentTotal, snapCommission } from "@/lib/snapRequests";
export { renderTemplate } from "@/lib/notify";
export { translate, DICT, LANGS } from "@/lib/i18n";
export { toPublicPartner, partnerKindTags } from "@/lib/partnerStorage";
export { needsAttention } from "@/lib/needsAttention";
export { buildBriefing, draftAssessment, recommendPartners, haversineKm } from "@/lib/opsAgent";
export { cuttingListTotal, canTransition } from "@/lib/production";
export { lowStockFlags } from "@/lib/stock";
export { supplyQuoteTotal, capabilityMatch, supplyCandidates } from "@/lib/supply";
export { ROOF_STYLES } from "@/data/roofingGuide";
export { ROOF_PATTERNS, ROOF_DETAILS, identifyGuide, gutterFall, slopeDims, overlapSummary, VALLEY_TRAY_WIDTH_MM } from "@/data/roofPatterns";
export { TRADE_CARDS, cabinetUnits } from "@/data/tradeGuides";
export { STANDARD_TOOLS } from "@/lib/snapRequests";
export { mergeLibrary, validateContribution, knowledgeBriefing } from "@/lib/knowledge";
export { DEFAULT_RATES, getRates } from "@/lib/settings";
export { products, productPrice } from "@/data/catalog";
export { estimateProject, defaultEstimatorInput } from "@/lib/projectEstimator";
`;
writeFileSync("/tmp/verify-entry.ts", entry);
await build({ entryPoints: ["/tmp/verify-entry.ts"], bundle: true, platform: "node", format: "esm", outfile: "/tmp/verify-bundle.mjs", alias: { "@": process.cwd() + "/src" }, logLevel: "silent" });
const M = await import(pathToFileURL("/tmp/verify-bundle.mjs").href);

let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = Math.abs(Number(got) - Number(want)) < 0.01 || got === want; if (ok) { pass++; console.log(`  ok ${name} = ${got}`); } else { fail++; console.log(`  FAIL ${name}: got ${got}, want ${want}`); } };
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ok ${name}`); } else { fail++; console.log(`  FAIL ${name}`); } };

console.log("— Quotation fixture (Deliverable A) —");
const items = [ { id: "1", description: "a", qty: 2, unit: "pcs", unitPrice: 50000 }, { id: "2", description: "b", qty: 3, unit: "pcs", unitPrice: 10000 } ];
const qt = M.quotationTotals({ items, discountType: "pct", discountValue: 10, vatPct: 7.5 });
eq("subtotal", qt.subtotal, 130000); eq("discount 10%", qt.discountAmount, 13000);
eq("afterDiscount", qt.afterDiscount, 117000); eq("VAT 7.5%", qt.vatAmount, 8775); eq("grandTotal", qt.grandTotal, 125775);
eq("milestones 60+30+10", M.milestoneTotalPct([{ id: "1", label: "a", pct: 60 }, { id: "2", label: "b", pct: 30 }, { id: "3", label: "c", pct: 10 }]), 100);

console.log("— Invoice fixture (Deliverable C) —");
const inv = { items, discountType: "pct", discountValue: 10, vatPct: 7.5, amountPaid: 25775, status: "Sent", dueDate: "2999-01-01", issueDate: "2026-01-01" };
eq("invoice grandTotal (same formula)", M.invoiceTotals(inv).grandTotal, 125775);
eq("balance after 25,775 paid", M.invoiceBalance(inv), 100000);
eq("status after part payment", M.invoiceDisplayStatus(inv), "Part Paid");
eq("status overdue (past due, balance > 0)", M.invoiceDisplayStatus({ ...inv, dueDate: "2020-01-01" }), "Overdue");
eq("status paid in full", M.invoiceDisplayStatus({ ...inv, amountPaid: 125775 }), "Paid");
eq("status draft untouched", M.invoiceDisplayStatus({ ...inv, amountPaid: 0, dueDate: "2999-01-01" }), "Sent");

console.log("— Eaves fixture (Deliverable B) —");
const ev = M.eavesCalc(30, 0.75);
eq("projection 0.75*cos30", Number(ev.projectionM.toFixed(4)), 0.6495);
eq("drop 0.75*sin30", Number(ev.dropM.toFixed(4)), 0.375);
eq("plumb cut = pitch", ev.plumbCutDeg, 30);
eq("fascia exposure 150/cos30 mm", Number((ev.fasciaExposureM * 1000).toFixed(1)), 173.2);
eq("soffit width (projection-25mm)", Number(ev.soffitWidthM.toFixed(4)), 0.6245);
eq("pitchFromRiseRun 1.73/3 ~ 30deg", Number(M.pitchFromRiseRun(1.73, 3).toFixed(1)), 30.0);

console.log("— Plans logic (Deliverable F) —");
const now = Date.now();
const expiredState = { planId: "pro-monthly", activatedAt: new Date(now - 31 * 86400000).toISOString(), expiresAt: new Date(now - 1 * 86400000).toISOString() };
const e1 = M.computeEntitlements(expiredState, false, now, M.DEFAULT_PLANS);
ok("30-day plan activated 31 days ago -> isPro false", e1.isPro === false && e1.expired === true);
const e2 = M.computeEntitlements(expiredState, true, now, M.DEFAULT_PLANS);
ok("admin flag -> isPro true regardless of expiry", e2.isPro === true && e2.isAdmin === true);
const e3 = M.computeEntitlements({ planId: "pro-yearly", activatedAt: new Date(now).toISOString(), expiresAt: new Date(now + 365 * 86400000).toISOString() }, false, now, M.DEFAULT_PLANS);
ok("fresh yearly -> isPro true, 365 days left", e3.isPro === true && e3.daysLeft === 365);
const codes = [{ code: "PLAN-TEST01", planId: "pro-monthly", createdAt: new Date(now).toISOString() }];
const r1 = M.redeemPlanCode("plan-test01", M.DEFAULT_PLANS, codes, now);
ok("redeem valid code -> ok", r1.ok === true);
if (r1.ok) { eq("expiry = now + 30d (days)", Math.round((new Date(r1.state.expiresAt).getTime() - now) / 86400000), 30); }
const usedCodes = [{ code: "PLAN-TEST01", planId: "pro-monthly", createdAt: new Date(now).toISOString(), usedAt: new Date(now).toISOString() }];
ok("redeem used code -> rejected", M.redeemPlanCode("PLAN-TEST01", M.DEFAULT_PLANS, usedCodes, now).ok === false);
ok("redeem unknown code -> rejected", M.redeemPlanCode("PLAN-NOPE99", M.DEFAULT_PLANS, codes, now).ok === false);

console.log("— Assistant brain (Deliverable D) —");
const eng = M.calculateRoof({ length: 10, width: 8, overhang: 0.6, style: "gable", pitchDeg: 25, profile: "longspan-045", colour: "Charcoal", wastePct: null, extras: { gutters: false, insulation: false, installation: true, timber: false }, deliveryZone: "pickup" });
const std = M.computeAssistantRange({ trade: "roofing", tier: "standard", length: 10, width: 8, pitch: 25 });
eq("roofing standard anchor == engine grandTotal", std.anchor, Math.round(eng.grandTotal));
eq("range low = anchor x 0.95", std.low, Math.round(std.anchor * 0.95));
eq("range high = anchor x 1.10", std.high, Math.round(std.anchor * 1.1));
const bas = M.computeAssistantRange({ trade: "roofing", tier: "basic", length: 10, width: 8, pitch: 25 });
eq("basic anchor = engine x 0.85", bas.anchor, Math.round(eng.grandTotal * 0.85));
const gut = M.computeAssistantRange({ trade: "gutters", tier: "standard", gutterMetres: 36 });
eq("gutters anchor = 36m x ₦6,500 catalog", gut.anchor, 234000);
ok("other trade -> null (no invented price)", M.computeAssistantRange({ trade: "other", tier: "standard" }) === null);
const pd = M.parseDims("12 by 8"); ok("parseDims '12 by 8'", pd && pd.l === 12 && pd.w === 8);
const pd2 = M.parseDims("12x8.5"); ok("parseDims '12x8.5'", pd2 && pd2.l === 12 && pd2.w === 8.5);
eq("parseArea '45 m2'", M.parseArea("45 m2"), 45);
eq("parsePitch '30 degrees'", M.parsePitch("30 degrees"), 30);
ok("isQuoteIntent 'write me a quote'", M.isQuoteIntent("please write me a quote for my roof") === true);
ok("isQuoteIntent 'estimate my tiling'", M.isQuoteIntent("estimate my tiling") === true);

console.log("— Coupons (Phase 6) —");
// Spec fixture: 10% coupon on a ₦125,775 subtotal → discount ₦12,578
// (percent discounts round HALF UP to the nearest naira) → total ₦113,197.
const c10 = { code: "SAVE10", kind: "percent", value: 10, minSpend: 0, active: true };
eq("10% of 125,775 rounds half up", M.couponDiscountNgn(c10, 125775), 12578);
const vOk = M.validateCoupon("save10", 125775, [c10], Date.now());
ok("validate SAVE10 (case-insensitive) -> ok", vOk.ok === true);
if (vOk.ok) { eq("validated discount", vOk.discountNgn, 12578); eq("total after discount", 125775 - vOk.discountNgn, 113197); }
ok("unknown code -> rejected", M.validateCoupon("NOPE", 125775, [c10], Date.now()).ok === false);
ok("inactive coupon -> rejected", M.validateCoupon("SAVE10", 125775, [{ ...c10, active: false }], Date.now()).ok === false);
ok("expired coupon -> rejected", M.validateCoupon("SAVE10", 125775, [{ ...c10, expiresAt: "2020-01-01" }], Date.now()).ok === false);
ok("below min spend -> rejected", M.validateCoupon("SAVE10", 5000, [{ ...c10, minSpend: 10000 }], Date.now()).ok === false);
const fixed = { code: "FLAT5K", kind: "fixed", value: 5000, minSpend: 0, active: true };
eq("fixed 5,000 on 125,775", M.couponDiscountNgn(fixed, 125775), 5000);
eq("fixed discount capped at subtotal (never below 0)", M.couponDiscountNgn(fixed, 4000), 4000);

console.log("— Review averages (Phase 6) —");
const sum = M.summarizeReviews([{ rating: 5 }, { rating: 4 }, { rating: 4 }]);
eq("average of 5,4,4 -> 4.3", sum.avg, 4.3);
eq("count of 5,4,4 -> 3", sum.count, 3);
const sum0 = M.summarizeReviews([]);
eq("no reviews -> avg 0", sum0.avg, 0);
eq("no reviews -> count 0", sum0.count, 0);

console.log("— Notification templates (Phase 6) —");
// renderTemplate is pure substitution — notify() injects {business} from
// getBusiness() at send time, so the fixture passes it the same way.
const msg = M.renderTemplate("order_placed", { business: "Oketex & Sons Aluminum Co.", code: "OKX-2026-0001", name: "Adaeze", phone: "0803 000 0000", amount: "₦113,197" });
ok("template renders business name", msg.includes("Oketex"));
ok("template renders code + amount", msg.includes("OKX-2026-0001") && msg.includes("₦113,197"));
ok("template leaves no placeholders", !msg.includes("{") && !msg.includes("}"));

console.log("— i18n dictionary (Phase 7) —");
ok("pcm nav.track differs from EN", M.translate("pcm", "nav.track") !== M.translate("en", "nav.track"));
eq("pcm nav.track is Pidgin", M.translate("pcm", "nav.track"), "Track Am");
ok("yo hero title part 2 present", M.translate("yo", "hero.title2").length > 0);
ok("ha nav.jobs present", M.translate("ha", "nav.jobs").length > 0);
eq("unknown key falls back to the key", M.translate("pcm", "no.such.key"), "no.such.key");
// Igbo (2026-10-26): SAME key coverage as every other language — scripted
// completeness: for every DICT key, every non-EN language must carry an
// entry, and each language must cover exactly the same number of keys.
const dictKeys = Object.keys(M.DICT);
const nonEnLangs = M.LANGS.map(l => l.id).filter(id => id !== "en");
ok("Igbo is in the switcher list", M.LANGS.some(l => l.id === "ig" && l.label === "Igbo"));
for (const lang of nonEnLangs) {
  const covered = dictKeys.filter(k => typeof M.DICT[k][lang] === "string" && M.DICT[k][lang].length > 0).length;
  eq(`i18n completeness: ${lang} covers all ${dictKeys.length} keys`, covered, dictKeys.length);
}
eq("ig nav.shop = Ụlọ ahịa", M.translate("ig", "nav.shop"), "Ụlọ ahịa");
eq("ig nav.quote = Nweta ọnụ ahịa", M.translate("ig", "nav.quote"), "Nweta ọnụ ahịa");
eq("ig nav.track = Sochie", M.translate("ig", "nav.track"), "Sochie");
eq("ig nav.snapSend = Were foto ziga", M.translate("ig", "nav.snapSend"), "Were foto ziga");
eq("ig nav.partners = Ndị mmekọ", M.translate("ig", "nav.partners"), "Ndị mmekọ");
eq("ig nav.jobs = Ọrụ", M.translate("ig", "nav.jobs"), "Ọrụ");
eq("ig nav.book = Debe ọrụ", M.translate("ig", "nav.book"), "Debe ọrụ");
ok("ig hero sub present", M.translate("ig", "hero.sub").length > 40);
ok("ig hero keeps brand numbers untranslated", M.translate("ig", "hero.kicker").includes("2009"));

console.log("— Snap & Send assessment + commission (Snap & Send Jobs) —");
// Spec fixture: items 2 × ₦6,500 = 13,000 + workmanship 25,000 + transport
// 8,000 + dispatch 2,500 → total ₦48,500.
const snapA = { items: [{ name: "Longspan sheet 0.45mm", qty: 2, unitPrice: 6500 }], workmanshipNgn: 25000, transportNgn: 8000, dispatchNgn: 2500, notes: "" };
eq("assessment total = 48,500", M.assessmentTotal(snapA), 48500);
eq("empty assessment totals 0", M.assessmentTotal(null), 0);
// Commission snapshot uses the AGREED price: 5% of 48,500 = 2,425; after
// negotiation to 45,000 → 5% = 2,250 (never the list total).
eq("commission 5% of agreed 48,500 = 2,425", M.snapCommission(48500, 5), 2425);
eq("commission 5% of negotiated 45,000 = 2,250", M.snapCommission(45000, 5), 2250);

console.log("— Shop dispatch & handling fee (Snap & Send Jobs) —");
// Spec fixture: dispatchFeeNgn 3,000 + zone delivery 45,000 (ogun-lagos) on
// a ₦100,000 cart → grand total ₦148,000; pickup → no dispatch line.
eq("dispatch applies on a paid zone", M.dispatchFor(3000, "ogun-lagos"), 3000);
eq("dispatch never applies on pickup", M.dispatchFor(3000, "pickup"), 0);
eq("dispatch off when fee is 0", M.dispatchFor(0, "ogun-lagos"), 0);
eq("grand total 100,000 + 45,000 + 3,000 = 148,000", M.orderGrandTotal(100000, 45000, 3000, "ogun-lagos"), 148000);
eq("pickup grand total stays 100,000", M.orderGrandTotal(100000, 0, 3000, "pickup"), 100000);

console.log("— Admin-Routing: public partner mapping + needs-attention queue —");
// (a) The public partner shape strips phone + email but keeps everything
// a customer legitimately sees (name, trades, ratings inputs, products).
const fullPartner = { code: "PRT-2026-TEST", role: "seller", businessName: "Test Depot", contactName: "T. Est", phone: "+234 803 555 0999", email: "test@depot.ng", location: "Ibafo", areas: "Lagos", trades: [], categories: ["Roofing Materials"], kindTags: ["Materials Seller", "Wholesaler"], bio: "x", products: [{ id: "1", name: "Sheet", priceNgn: 100, unit: "per m" }], status: "approved", verified: true, featured: false, createdAt: new Date().toISOString() };
const pub = M.toPublicPartner(fullPartner);
ok("public mapping strips phone", pub.phone === "");
ok("public mapping strips email", pub.email === undefined);
ok("public mapping keeps business name + products", pub.businessName === "Test Depot" && pub.products.length === 1);
ok("public mapping keeps kindTags (public-safe directory tags)", JSON.stringify(pub.kindTags) === JSON.stringify(["Materials Seller", "Wholesaler"]));
ok("public mapping does not mutate the source record", fullPartner.phone === "+234 803 555 0999");
// Kind tags (2026-10-26): explicit tags win; untagged partners fall back
// to the role mapping the directory filters rely on.
eq("kindTags: explicit tags pass through", M.partnerKindTags(fullPartner).join("|"), "Materials Seller|Wholesaler");
eq("kindTags fallback: pro → Trades Pro / Engineer", M.partnerKindTags({ role: "pro" }).join("|"), "Trades Pro / Engineer");
eq("kindTags fallback: seller → Materials Seller", M.partnerKindTags({ role: "seller" }).join("|"), "Materials Seller");
eq("kindTags fallback: both → pro + seller", M.partnerKindTags({ role: "both" }).join("|"), "Trades Pro / Engineer|Materials Seller");
// (b) Needs-attention aggregator over a seeded pending set.
const queue = M.needsAttention({
  orders: [{ status: "pending" }, { status: "delivered" }, { status: "pending" }],
  quotes: [{ status: "new" }, { status: "contacted" }],
  bookings: [{ status: "pending" }, { status: "confirmed" }],
  verifyRequests: [{ status: "Requested" }, { status: "Done" }, { status: "Requested" }],
  partners: [{ status: "pending" }, { status: "approved" }],
  jobs: [{ status: "Open", bids: [{ id: 1 }] }, { status: "Open", bids: [] }, { status: "Awarded", bids: [{ id: 2 }] }],
  snapRequests: [{ status: "Received" }, { status: "Priced" }, { status: "Completed" }, { status: "Under Review" }],
  leads: [{ status: "new" }, { status: "won" }, { status: "new" }],
});
const countOf = k => queue.find(r => r.key === k)?.count ?? 0;
eq("queue: pending orders", countOf("orders"), 2);
eq("queue: new quotes", countOf("quotes"), 1);
eq("queue: pending bookings", countOf("bookings"), 1);
eq("queue: verification requests", countOf("verify"), 2);
eq("queue: partner applications", countOf("partners"), 1);
eq("queue: open jobs WITH bids only", countOf("jobs"), 1);
eq("queue: snap Received/Under Review/Priced", countOf("snap"), 3);
eq("queue: new leads", countOf("leads"), 2);
eq("queue: every category present", queue.length, 8);
eq("queue: empty input -> all clear (0 rows)", M.needsAttention({}).length, 0);
ok("queue rows carry target tabs", queue.every(r => typeof r.tab === "string" && r.tab.length > 0));


console.log("— Staff System: Ops Agent + Factory + Supply fixtures —");
// Production math + state machine
eq("cutting list total 24 × 5.08m", M.cuttingListTotal([{ lengthM: 5.08, qty: 24 }]), 121.92);
ok("state machine: Produced → bundle REJECTED (QC cannot be skipped)", M.canTransition("Produced", "bundle") === false);
ok("state machine: Produced → qcPass allowed", M.canTransition("Produced", "qcPass") === true);
ok("state machine: QC Passed → bundle allowed", M.canTransition("QC Passed", "bundle") === true);
// Low-stock flags against the editable threshold
const lowFlags = M.lowStockFlags({ items: [{ gauge: "0.45mm", colour: "Forest Green", kg: 300 }, { gauge: "0.55mm", colour: "Brick Red", kg: 800 }], thresholdKg: 500 });
eq("low stock: only the 300kg coil flags (threshold 500)", lowFlags.length, 1);
eq("low stock: flagged coil is the 0.45mm", lowFlags[0]?.gauge, "0.45mm");
// Supply math + capability matching
eq("supply quote total 40 × ₦12,500", M.supplyQuoteTotal(40, 12500), 500000);
ok("capability match: 'aluminium gutter' hits 'Rain gutters & downpipes'", M.capabilityMatch(["Aluminium coils 0.45mm", "Rain gutters & downpipes"], "Aluminium rain gutter & downpipe") === true);
ok("capability match: unrelated capability does not match", M.capabilityMatch(["Generator hire (20kVA)"], "Aluminium rain gutter") === false);
// Ops Agent drafter: catalogue prices only
const catalogue = [{ name: "Aluminium Rain Gutter & Downpipe", priceNgn: 6500 }, { name: "0.45mm Longspan Roofing Sheet", priceNgn: 4800 }];
const draft = M.draftAssessment({ description: "leaking gutter joint at the corner of the house", intent: "repair", address: "Magboro, Ogun State" }, catalogue, { deliveryZones: { pickup: 0, "ogun-lagos": 45000 } });
const gutterLine = draft.items.find(i => i.name === "Aluminium Rain Gutter & Downpipe");
ok("drafter maps 'leaking gutter joint' → the catalogue gutter item", !!gutterLine && gutterLine.matched === true);
eq("drafter uses the CATALOGUE price ₦6,500 (never invented)", gutterLine?.unitPrice, 6500);
eq("drafter transport = ogun-lagos zone fee from the address", draft.transportNgn, 45000);
ok("drafter flags workmanship for a human", draft.flags.some(f => /workmanship/i.test(f)));
// Drafter tool suggestions (2026-10-26): small keyword rule table — a leak
// suggests the sealant gun, roofing work the ladder/drill, plumbing a pipe
// wrench; no rule matched → no tools invented.
ok("drafter tools: leaking gutter → Sealant gun suggested", draft.tools.includes("Sealant gun"));
ok("drafter tools: gutter/roof work → Ladder + Drill machine suggested", draft.tools.includes("Ladder") && draft.tools.includes("Drill machine"));
const plumbingDraft = M.draftAssessment({ description: "burst pipe under the kitchen sink, water everywhere", intent: "repair", address: "Ikeja, Lagos" }, catalogue, { deliveryZones: { pickup: 0, "ogun-lagos": 45000 } });
ok("drafter tools: burst pipe → Pipe wrench + Water pump pliers", plumbingDraft.tools.includes("Pipe wrench") && plumbingDraft.tools.includes("Water pump pliers"));
const quietDraft = M.draftAssessment({ description: "please come and look at the building", intent: "other", address: "Enugu" }, catalogue, { deliveryZones: { pickup: 0 } });
eq("drafter tools: no keyword rule → no tools suggested", quietDraft.tools.length, 0);
// Ops Agent recommender: trade hard filter + rating/load ordering
const recPartners = [
  { code: "PRT-A", businessName: "Alpha Roofing", status: "approved", role: "pro", trades: ["Roofing"], categories: [], products: [] },
  { code: "PRT-B", businessName: "Beta Roofing", status: "approved", role: "pro", trades: ["Roofing"], categories: [], products: [] },
  { code: "PRT-C", businessName: "Gamma Plumbing", status: "approved", role: "pro", trades: ["Plumbing"], categories: [], products: [] },
];
const recReviews = [
  { id: "r1", partnerCode: "PRT-A", rating: 5, status: "Published" }, { id: "r2", partnerCode: "PRT-A", rating: 5, status: "Published" },
  { id: "r3", partnerCode: "PRT-B", rating: 4, status: "Published" },
];
const recSnaps = [
  { code: "SR-1", assignedPartnerCode: "PRT-B", status: "Assigned" }, { code: "SR-2", assignedPartnerCode: "PRT-B", status: "In Progress" },
];
const recs = M.recommendPartners({ trade: "Roofing", partners: recPartners, reviews: recReviews, snapRequests: recSnaps, siteGeo: null });
eq("recommender: trade-mismatched partner excluded", recs.length, 2);
eq("recommender: higher rating + lower load wins (#1 = Alpha)", recs[0]?.partner.code, "PRT-A");
ok("recommender: reasons carry the rating", /★/.test(recs[0]?.reasons.join(" ") || ""));
eq("haversine (6.68,3.45)→(6.45,3.40) ≈ 26.2 km", Math.round(M.haversineKm({ lat: 6.68, lng: 3.45 }, { lat: 6.45, lng: 3.4 }) * 10) / 10, 26.2);
// Recommender REGION-FIRST fixture (2026-10-26, spec): two roofers —
// A: 5.0★ covering "Lekki, Ajah"; B: 4.0★ covering "Ibafo, Magboro".
// An Ibafo request must put B first WITH the area reason (region beats
// rating); an address nobody covers (Surulere) falls back to rating +
// workload with the fallback reason on the top pick.
const regionPartners = [
  { code: "PRT-RA", businessName: "Apex Roofing (Lekki)", status: "approved", role: "pro", trades: ["Roofer"], categories: [], products: [], location: "Lekki, Lagos", areas: "Lekki, Ajah" },
  { code: "PRT-RB", businessName: "Beta Roofing (Ibafo)", status: "approved", role: "pro", trades: ["Roofer"], categories: [], products: [], location: "Ibafo, Ogun", areas: "Ibafo, Magboro" },
];
const regionReviews = [
  { id: "rr1", partnerCode: "PRT-RA", rating: 5, status: "Published" }, { id: "rr2", partnerCode: "PRT-RA", rating: 5, status: "Published" },
  { id: "rr3", partnerCode: "PRT-RB", rating: 4, status: "Published" },
];
const ibafoRecs = M.recommendPartners({ trade: "Roofer", partners: regionPartners, reviews: regionReviews, snapRequests: [], siteGeo: null, address: "14 Unity Road, Ibafo, Ogun State" });
eq("region: Ibafo request → the Ibafo pro outranks the 5.0★ Lekki pro", ibafoRecs[0]?.partner.code, "PRT-RB");
ok("region: winner carries the area reason", (ibafoRecs[0]?.reasons || []).some(r => r === "Covers your area — Ibafo"));
eq("region: winner's areaMatch is the partner's own label", ibafoRecs[0]?.areaMatch, "Ibafo");
const surulereRecs = M.recommendPartners({ trade: "Roofer", partners: regionPartners, reviews: regionReviews, snapRequests: [], siteGeo: null, address: "23 Allen Avenue, Surulere, Lagos" });
eq("region: uncovered area → best by rating first (5.0★ pro)", surulereRecs[0]?.partner.code, "PRT-RA");
ok("region: uncovered area → fallback reason on the top pick", (surulereRecs[0]?.reasons || []).some(r => r === "No pro lists this area — best available by rating & workload"));
eq("region: uncovered area → no areaMatch claimed", surulereRecs[0]?.areaMatch, null);
// Ops Agent briefing: stuck detection at > 24h
const fixedNow = new Date("2026-10-25T12:00:00.000Z");
const old25h = new Date(fixedNow.getTime() - 25 * 3600_000).toISOString();
const briefing = M.buildBriefing({
  orders: [], quotes: [], bookings: [], leads: [], jobs: [], verifyRequests: [], partners: [], reviews: [], invoices: [], productionJobs: [],
  stock: { items: [], thresholdKg: 500 },
  snapRequests: [{ code: "SR-OLD", status: "Received", customerName: "Stuck Customer", createdAt: old25h, updatedAt: old25h }],
}, fixedNow);
ok("briefing flags the 25h-old snap request as stuck", briefing.stuck.some(x => x.code === "SR-OLD" && x.ageHours >= 25));

console.log("— Pro Guide pattern library (2026-10-26) —");
ok(`library has at least guide styles (${M.ROOF_STYLES.length}) + 8 patterns`, M.ROOF_PATTERNS.length >= M.ROOF_STYLES.length + 8);
const FAMILIES = ["Aluminium profile", "Stone-coated", "Shingle", "Standing seam", "Concrete/flat", "Traditional"];
const TOOLSET = new Set(M.STANDARD_TOOLS);
let complete = true;
for (const p of M.ROOF_PATTERNS) {
  if (!p.name || !FAMILIES.includes(p.family)) complete = false;
  if (!Array.isArray(p.pitchRangeDeg) || p.pitchRangeDeg[0] > p.pitchRangeDeg[1]) complete = false;
  if (!p.gaugeOptions || !p.fastenerPattern || !p.bestFor || !p.avoidWhen) complete = false;
  if (!p.overlapMm || (!p.overlapMm.sideMm && !p.overlapMm.endMm && !p.overlapMm.note)) complete = false;
  if (!Array.isArray(p.installSteps) || p.installSteps.length < 5 || p.installSteps.length > 8) complete = false;
  if (!Array.isArray(p.commonFixes) || !p.commonFixes.length || p.commonFixes.some(f => !f.problem || !f.fix)) complete = false;
  if (!Array.isArray(p.tools) || !p.tools.length || p.tools.some(t => !TOOLSET.has(t))) complete = false;
  if (!Array.isArray(p.materials) || !p.materials.length) complete = false;
  if (Object.keys(p).some(k => /price/i.test(k))) complete = false;
}
ok("every pattern has complete fields, tools from the STANDARD_TOOLS vocabulary, and NO price fields", complete);
ok("all 10 guide styles are mapped into the library", M.ROOF_PATTERNS.filter(p => p.guideKind).length === M.ROOF_STYLES.length);
ok("at least 6 detail cards (valley/ridge/flashing/gutter/fascia/leak-hunt)", M.ROOF_DETAILS.length >= 6 && M.ROOF_DETAILS.every(d => d.steps.length >= 4 && d.keySpecs.length >= 4));
eq("valley tray width constant", M.VALLEY_TRAY_WIDTH_MM, 450);

console.log("— Sketch maths —");
eq("gutter fall: 8m run at 1:200 -> 40mm drop", M.gutterFall(8, 200).dropMm, 40);
eq("gutter fall: 10m run at 1:350 -> 28.6mm drop", M.gutterFall(10, 350).dropMm, 28.6);
const sd = M.slopeDims(5.08, 25);
eq("slope dims: 5.08m at 25° horizontal", sd.horizontalM, 4.60);
eq("slope dims: 5.08m at 25° vertical", sd.verticalM, 2.15);
const ls = M.ROOF_PATTERNS.find(p => p.id === "longspan");
ok("overlap label equals pattern data (longspan end lap 200mm)", M.overlapSummary(ls).includes(`${ls.overlapMm.endMm}mm`));

console.log("— Guided identification —");
const idValley = M.identifyGuide({ area: "valley", material: "aluminium", problem: "leak" });
ok("valley + leak -> valley detail card", idValley.kind === "detail" && idValley.id === "valley");
const idStone = M.identifyGuide({ area: "roof-surface", material: "stone-coated", problem: "forgot-pattern" });
ok("roof surface + stone-coated -> stone-classic pattern", idStone.kind === "pattern" && idStone.id === "stone-classic");
const idLeak = M.identifyGuide({ area: "leak-hunt", material: "not-sure", problem: "leak" });
ok("leak hunt -> leak-hunt detail", idLeak.kind === "detail" && idLeak.id === "leak-hunt");

console.log("— Living knowledge: merge + validation —");
const seeds = [
  { id: "longspan", kind: "pattern", trade: "Roofing", title: "Aluminium Longspan" },
  { id: "valley", kind: "detail", trade: "Roofing", title: "Valley detail" },
];
const community = [
  { id: "KNW-1", kind: "fix", trade: "Roofing", title: "Community fix A", body: "x".repeat(30), tools: [], source: "pro", contributorName: "Pro A", contributorCode: "PRT-A", status: "approved", confirmations: 3, confirmedBy: [], createdAt: "2026-10-26T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z" },
  { id: "KNW-2", kind: "tip", trade: "Roofing", title: "Pending tip", body: "x".repeat(30), tools: [], source: "pro", contributorName: "Pro B", contributorCode: "PRT-B", status: "pending", confirmations: 99, confirmedBy: [], createdAt: "2026-10-26T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z" },
  { id: "longspan", kind: "seedref", trade: "Roofing", title: "Aluminium Longspan", body: "", tools: [], source: "seed", contributorName: "", contributorCode: "", status: "approved", confirmations: 5, confirmedBy: [], createdAt: "2026-10-26T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z" },
];
const mergedLib = M.mergeLibrary(seeds, community, {});
eq("merge folds the seedref pointer into the seed (3 rows, not 4)", mergedLib.length, 3);
eq("merge: seed confirmations = pointer count", mergedLib.find(r => r.id === "longspan")?.confirmations, 5);
ok("merge: pending community entry is NOT surfaced", !mergedLib.some(r => r.id === "KNW-2"));
eq("merge sorts by confirmations desc (seed 5 > community 3 > detail 0)", mergedLib.map(r => r.id).join(","), "longspan,KNW-1,valley");
const mergedLocal = M.mergeLibrary(seeds, [], { longspan: { count: 2, by: ["PRT-X"] } });
eq("merge: device seed confirmations add in", mergedLocal.find(r => r.id === "longspan")?.confirmations, 2);
ok("validation: empty title rejected", M.validateContribution({ kind: "fix", trade: "Roofing", title: "", body: "x".repeat(30) }) !== null);
ok("validation: short body rejected", M.validateContribution({ kind: "fix", trade: "Roofing", title: "Good title", body: "too short" }) !== null);
ok("validation: unknown trade rejected", M.validateContribution({ kind: "fix", trade: "Astrology", title: "Good title", body: "x".repeat(30) }) !== null);
ok("validation: complete contribution accepted", M.validateContribution({ kind: "fix", trade: "Roofing", title: "Good title", body: "x".repeat(30) }) === null);
const kb = M.knowledgeBriefing([
  { id: "K1", kind: "fix", trade: "Roofing", title: "Top fix", body: "", tools: [], source: "pro", contributorName: "A", contributorCode: "P1", status: "approved", confirmations: 4, confirmedBy: [], createdAt: "2026-10-24T00:00:00Z", updatedAt: "2026-10-25T00:00:00Z" },
  { id: "K2", kind: "tip", trade: "Roofing", title: "Waiting tip", body: "", tools: [], source: "pro", contributorName: "B", contributorCode: "P2", status: "pending", confirmations: 0, confirmedBy: [], createdAt: "2026-10-25T00:00:00Z", updatedAt: "2026-10-25T00:00:00Z" },
], new Date("2026-10-26T12:00:00Z"));
eq("knowledge briefing: pending review count", kb.pendingReview, 1);
eq("knowledge briefing: most confirmed fix this week", kb.topFixThisWeek?.title, "Top fix");
const briefing2 = M.buildBriefing({ orders: [], quotes: [], bookings: [], leads: [], jobs: [], verifyRequests: [], partners: [], reviews: [], invoices: [], productionJobs: [], stock: { items: [], thresholdKg: 500 }, snapRequests: [], knowledgeEntries: [{ id: "K9", kind: "fix", trade: "Tiling", title: "T", body: "", tools: [], source: "pro", contributorName: "A", contributorCode: "P", status: "pending", confirmations: 0, confirmedBy: [], createdAt: "2026-10-26T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z" }] }, fixedNow);
eq("ops briefing carries the knowledge pending count", briefing2.knowledge.pendingReview, 1);

console.log("— All-trades guide cards —");
const TRADE_NAMES = ["Plumbing", "Tiling", "Carpentry & Woodwork", "Electrical", "Painting & Finishing", "Concrete & Masonry", "Welding & Metalwork", "Interior & Cabinetry"];
ok("every non-roofing trade has 3-5 cards", TRADE_NAMES.every(t => { const n = M.TRADE_CARDS.filter(c => c.trade === t).length; return n >= 3 && n <= 5; }));
ok("every trade card is complete (specs/steps/fixes/tools/materials)", M.TRADE_CARDS.every(c => c.keySpecs.length >= 3 && c.steps.length >= 4 && c.commonFixes.length >= 2 && c.tools.length >= 3 && c.materials.length >= 3 && !!c.whereUsed));

console.log("— Interior, Cabinetry & Boards (Part 3) —");
const R = M.DEFAULT_RATES;
ok("board + cabinet rates present in defaults", ["marinePlywoodSheet", "mdfSheet", "hdfSheet", "particleBoardSheet", "blockboardSheet", "plywood12Sheet", "plywood6Sheet", "cabinetLabourPerM"].every(k => typeof R[k] === "number" && R[k] > 0));
const boardsCat = M.products.filter(p => p.categorySlug === "boards-panels");
eq("boards & panels line has 7 products", boardsCat.length, 7);
ok("every board product's catalog price equals its Settings rate default (single source)", boardsCat.every(p => p.rateKey && p.priceNgn === R[p.rateKey]));
ok("productPrice() resolves the live rate for boards", boardsCat.every(p => M.productPrice(p) === R[p.rateKey]));
ok("productPrice() leaves non-board products at catalog price", M.products.filter(p => !p.rateKey).every(p => M.productPrice(p) === p.priceNgn));
const cu = M.cabinetUnits(3.0, 600);
eq("cabinet sketch maths: 3.0m run of 600mm units -> 5 units", cu.units, 5);
eq("cabinet sketch maths: last unit is a full 600mm", cu.lastUnitMm, 600);
eq("cabinet sketch maths: 3.2m run -> 5 units, last 800mm", (() => { const c = M.cabinetUnits(3.2, 600); return `${c.units}/${c.lastUnitMm}`; })(), "5/800");
const kitchenInput = { ...M.defaultEstimatorInput("interior-cabinetry", "cab-kitchen"), width: 3, height: 2.4, unitCount: 0 };
const kitchen = M.estimateProject(kitchenInput);
const boardLine = kitchen.groups.flatMap(g => g.lines).find(l => l.name.includes("HDF boards"));
eq("estimator kitchen fixture: 3m run x 2.4m -> 5 HDF sheets", boardLine?.qty, 5);
eq("estimator kitchen fixture: board unit price = live HDF rate", boardLine?.unitPrice, R.hdfSheet);
const marineLine = kitchen.groups.flatMap(g => g.lines).find(l => l.name.includes("Marine plywood"));
eq("estimator kitchen fixture: 1 marine sheet for the sink unit", marineLine?.qty, 1);
const hingeLine = kitchen.groups.flatMap(g => g.lines).find(l => l.name.startsWith("Hinges"));
eq("estimator kitchen fixture: 5 doors -> 10 hinges", hingeLine?.qty, 10);
const labourLine = kitchen.groups.flatMap(g => g.lines).find(l => l.name === "Cabinet labour");
eq("estimator kitchen fixture: labour = 3m at the Settings cabinet rate", labourLine?.total, 3 * R.cabinetLabourPerM);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
