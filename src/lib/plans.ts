// Subscription plans & entitlements (Deliverable F).
// Advanced pro features are paid via plans; the business/admin always has
// full access free. All state is demo-local (localStorage) until the
// production backend + Paystack go live — at that point plan purchases map to
// the payments purpose "pro_plan" (noted in BUILD_NOTES; no payment changes here).
import { getSettings, getBusiness } from "./settings";
import { getCachedUser } from "./auth";

export interface PlanDef {
  id: string; name: string; priceNgn: number; periodDays: number;
  blurb: string; features: string[]; active: boolean;
}
/** Launch defaults — admin-editable in Admin → Plans (stored in settings.plans). */
export const DEFAULT_PLANS: PlanDef[] = [
  {
    id: "free", name: "Free", priceNgn: 0, periodDays: 0, active: true,
    blurb: "Everything a customer needs to buy, book and estimate.",
    features: [
      "Shop & checkout", "Pro Roof Calculator", "Assistant estimates (unverified ranges)",
      "Bookings & order tracking", "Snap-Measure photo mode",
      "Pro Workspace — 1 project", "Pro Documents — Notes + 3 documents total",
    ],
  },
  {
    id: "pro-monthly", name: "Pro Monthly", priceNgn: 5000, periodDays: 30, active: true,
    blurb: "For roofers, engineers and contractors who work with documents daily.",
    features: [
      "Everything in Free",
      "Unlimited Workspace projects",
      "Full Pro Documents — unlimited Notes, Quotation Creator, Contract Writer, Invoicing, Letterhead & Document Vault",
      "Live Video Measure in Snap-Measure",
      "Priority pro-check requests on assistant quotations",
    ],
  },
  {
    id: "pro-yearly", name: "Pro Yearly", priceNgn: 50000, periodDays: 365, active: true,
    blurb: "Same Pro access for a full year — 2 months free versus paying monthly.",
    features: [
      "Everything in Pro Monthly",
      "2 months free versus 12 monthly payments",
    ],
  },
];
export function getPlans(): PlanDef[] {
  const stored = getSettings().plans;
  return stored && stored.length ? stored : DEFAULT_PLANS;
}
export const planById = (id: string): PlanDef | undefined => getPlans().find(p => p.id === id);

// ---------------- Activation state ----------------
export interface PlanState { planId: string; activatedAt: string; expiresAt: string | null; code?: string }
const PLAN_KEY = "oketex-plan";
const CODES_KEY = "oketex-plan-codes";
export function getPlanState(): PlanState | null {
  try { const r = localStorage.getItem(PLAN_KEY); return r ? (JSON.parse(r) as PlanState) : null; } catch { return null; }
}
export function savePlanState(s: PlanState | null) {
  try { if (s) localStorage.setItem(PLAN_KEY, JSON.stringify(s)); else localStorage.removeItem(PLAN_KEY); } catch { /* ignore */ }
  emitPlan();
}
const EVT = "oketex-plan";
export function emitPlan() { try { window.dispatchEvent(new CustomEvent(EVT)); } catch { /* ignore */ } }
export function onPlanChange(cb: () => void): () => void { window.addEventListener(EVT, cb); return () => window.removeEventListener(EVT, cb); }

// ---------------- Entitlements (pure core is exported for testing) ----------------
export interface Entitlements {
  isAdmin: boolean; isPro: boolean; planId: string; planName: string;
  daysLeft: number | null; expired: boolean;
  freeProjects: number; freeDocuments: number;
}
export const FREE_PROJECT_LIMIT = 1;
export const FREE_DOCUMENT_LIMIT = 3;
/** Pure entitlement computation — `nowMs` and `admin` injected so it can be unit-checked. */
export function computeEntitlements(state: PlanState | null, admin: boolean, nowMs: number, plans: PlanDef[] = DEFAULT_PLANS): Entitlements {
  const base: Entitlements = { isAdmin: admin, isPro: admin, planId: "free", planName: "Free", daysLeft: null, expired: false, freeProjects: FREE_PROJECT_LIMIT, freeDocuments: FREE_DOCUMENT_LIMIT };
  if (admin) return { ...base, planId: "admin", planName: "Admin", isPro: true };
  if (!state || state.planId === "free") return base;
  const plan = plans.find(p => p.id === state.planId);
  if (!plan) return base;
  if (state.expiresAt) {
    const exp = new Date(state.expiresAt).getTime();
    if (nowMs > exp) return { ...base, expired: true, planId: state.planId, planName: plan.name };
    return { ...base, isPro: true, planId: plan.id, planName: plan.name, daysLeft: Math.ceil((exp - nowMs) / 86400000) };
  }
  return { ...base, isPro: true, planId: plan.id, planName: plan.name };
}
/** Admin bypass: demo-admin session flag OR a logged-in admin-role user (Phase 5 auth). */
export function isAdminNow(): boolean {
  try { if (sessionStorage.getItem("oketex-admin") === "1") return true; } catch { /* ignore */ }
  const u = getCachedUser();
  return !!u && u.role === "admin";
}
export function getEntitlements(): Entitlements {
  return computeEntitlements(getPlanState(), isAdminNow(), Date.now(), getPlans());
}
import { useEffect, useState } from "react";
export function useEntitlements(): Entitlements {
  const [e, setE] = useState<Entitlements>(() => getEntitlements());
  useEffect(() => {
    const h = () => setE(getEntitlements());
    const off = onPlanChange(h);
    window.addEventListener("oketex-auth", h);
    return () => { off(); window.removeEventListener("oketex-auth", h); };
  }, []);
  return e;
}

// ---------------- Activation codes (admin-issued, single-use) ----------------
export interface PlanCode { code: string; planId: string; usedBy?: string; usedAt?: string; createdAt: string; revoked?: boolean }
export function getPlanCodes(): PlanCode[] {
  try { const r = localStorage.getItem(CODES_KEY); return r ? (JSON.parse(r) as PlanCode[]) : []; } catch { return []; }
}
export function savePlanCodes(list: PlanCode[]) { try { localStorage.setItem(CODES_KEY, JSON.stringify(list)); } catch { /* ignore */ } }
export function issuePlanCode(planId: string): PlanCode {
  const rec: PlanCode = { code: `PLAN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, planId, createdAt: new Date().toISOString() };
  savePlanCodes([rec, ...getPlanCodes()]);
  return rec;
}
export type RedeemResult = { ok: true; state: PlanState; plan: PlanDef } | { ok: false; error: string };
/** Redeem a code: validates existence/single-use/active plan, computes expiry from the plan's period, marks the code used. */
export function redeemPlanCode(raw: string, plans: PlanDef[] = getPlans(), codes: PlanCode[] = getPlanCodes(), nowMs = Date.now()): RedeemResult {
  const code = raw.trim().toUpperCase();
  const rec = codes.find(c => c.code === code);
  if (!rec) return { ok: false, error: "That code was not recognised. Check it and try again." };
  if (rec.revoked) return { ok: false, error: "That code has been revoked by the admin." };
  if (rec.usedAt) return { ok: false, error: "That code has already been used — codes work once only." };
  const plan = plans.find(p => p.id === rec.planId);
  if (!plan || !plan.active || plan.priceNgn <= 0) return { ok: false, error: "That code's plan is not available right now." };
  const activatedAt = new Date(nowMs).toISOString();
  const expiresAt = plan.periodDays > 0 ? new Date(nowMs + plan.periodDays * 86400000).toISOString() : null;
  const state: PlanState = { planId: plan.id, activatedAt, expiresAt, code: rec.code };
  savePlanCodes(codes.map(c => (c.code === rec.code ? { ...c, usedAt: activatedAt, usedBy: "this device" } : c)));
  savePlanState(state);
  return { ok: true, state, plan };
}
export function revokePlanCode(code: string) { savePlanCodes(getPlanCodes().map(c => (c.code === code ? { ...c, revoked: true } : c))); }

/** WhatsApp activation link: message the business number asking to buy a plan (payment settles offline, admin issues a code). */
export function planWhatsAppLink(plan: PlanDef): string {
  const b = getBusiness();
  const text = `Hello ${b.name}, I want to activate the ${plan.name} plan (${plan.priceNgn ? `NGN ${plan.priceNgn.toLocaleString("en-NG")}` : "Free"}) for the Oketex pro tools. Please send me payment details and my activation code.`;
  return `https://wa.me/${b.whatsapp}?text=${encodeURIComponent(text)}`;
}
