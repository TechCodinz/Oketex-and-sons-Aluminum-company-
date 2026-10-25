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
export { translate } from "@/lib/i18n";
export { toPublicPartner } from "@/lib/partnerStorage";
export { needsAttention } from "@/lib/needsAttention";
export { buildBriefing, draftAssessment, recommendPartners, haversineKm } from "@/lib/opsAgent";
export { cuttingListTotal, canTransition } from "@/lib/production";
export { lowStockFlags } from "@/lib/stock";
export { supplyQuoteTotal, capabilityMatch, supplyCandidates } from "@/lib/supply";
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
const fullPartner = { code: "PRT-2026-TEST", role: "seller", businessName: "Test Depot", contactName: "T. Est", phone: "+234 803 555 0999", email: "test@depot.ng", location: "Ibafo", areas: "Lagos", trades: [], categories: ["Roofing Materials"], bio: "x", products: [{ id: "1", name: "Sheet", priceNgn: 100, unit: "per m" }], status: "approved", verified: true, featured: false, createdAt: new Date().toISOString() };
const pub = M.toPublicPartner(fullPartner);
ok("public mapping strips phone", pub.phone === "");
ok("public mapping strips email", pub.email === undefined);
ok("public mapping keeps business name + products", pub.businessName === "Test Depot" && pub.products.length === 1);
ok("public mapping does not mutate the source record", fullPartner.phone === "+234 803 555 0999");
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
// Ops Agent briefing: stuck detection at > 24h
const fixedNow = new Date("2026-10-25T12:00:00.000Z");
const old25h = new Date(fixedNow.getTime() - 25 * 3600_000).toISOString();
const briefing = M.buildBriefing({
  orders: [], quotes: [], bookings: [], leads: [], jobs: [], verifyRequests: [], partners: [], reviews: [], invoices: [], productionJobs: [],
  stock: { items: [], thresholdKg: 500 },
  snapRequests: [{ code: "SR-OLD", status: "Received", customerName: "Stuck Customer", createdAt: old25h, updatedAt: old25h }],
}, fixedNow);
ok("briefing flags the 25h-old snap request as stuck", briefing.stuck.some(x => x.code === "SR-OLD" && x.ageHours >= 25));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
