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

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
