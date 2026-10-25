// Production pipeline (Factory wing, 2026-10-25) — a confirmed order becomes
// a production job card carrying its cutting list; the card walks the floor:
//   Queued → In Production → Produced → QC Passed → Bundled → Dispatched → Delivered
// with a QC failure sending it back to In Production. The state machine is
// pure and shared: the server enforces the same transitions (handlers/
// production.ts), the client checks are a courtesy. Local copy lives in
// `oketex-production`; API-first wrappers mirror the other stores.
import { apiFetch, probeApi } from "./api";
import type { LocalOrder } from "./storage";

export type ProductionStatus =
  | "Queued" | "In Production" | "Produced" | "QC Passed" | "QC Failed"
  | "Bundled" | "Dispatched" | "Delivered";
export interface CutLine { lengthM: number; qty: number }
export interface QcEntry { by: string; at: string; result: "pass" | "fail"; notes: string }
export interface ProductionJob {
  code: string; orderCode: string; customerName: string; customerPhone: string;
  address: string;
  product: { name: string; gauge: string; colour: string };
  cuttingList: CutLine[]; totalMetres: number;
  status: ProductionStatus; operatorName: string;
  metresProduced: number; scrapNote: string; scheduleNote: string;
  checklist: string[];
  qc: QcEntry | null; qcHistory: QcEntry[];
  createdAt: string; updatedAt: string;
}

export function cuttingListTotal(lines: CutLine[]): number {
  return Math.round((lines || []).reduce((s, l) => s + (Number(l.lengthM) || 0) * (Number(l.qty) || 0), 0) * 100) / 100;
}

export type ProductionAction = "start" | "finish" | "qcPass" | "qcFail" | "bundle" | "dispatch" | "deliver";
const FLOW: Record<ProductionAction, { from: ProductionStatus[]; to: ProductionStatus }> = {
  start: { from: ["Queued"], to: "In Production" },
  finish: { from: ["In Production"], to: "Produced" },
  qcPass: { from: ["Produced"], to: "QC Passed" },
  qcFail: { from: ["Produced"], to: "In Production" },
  bundle: { from: ["QC Passed"], to: "Bundled" },
  dispatch: { from: ["Bundled"], to: "Dispatched" },
  deliver: { from: ["Dispatched"], to: "Delivered" },
};
/** The pipeline never skips a stage — a Produced job cannot be bundled
 *  before QC passes it, a Queued job cannot be dispatched, and so on. */
export function canTransition(status: ProductionStatus, action: ProductionAction): boolean {
  return FLOW[action].from.includes(status);
}
export function applyTransition(job: ProductionJob, action: ProductionAction, patch: Partial<ProductionJob> = {}): ProductionJob | null {
  if (!canTransition(job.status, action)) return null;
  return { ...job, ...patch, status: FLOW[action].to, updatedAt: new Date().toISOString() };
}

/** Cutting list from an order — lengths are EXTRACTED, never invented:
 *  an item contributes a line when its name carries a length ("… 5.08m")
 *  and it is a sheet/per-metre line; the order note is also scanned for
 *  "24 × 5.08m"-style lines. Nothing found → empty list, and the operator
 *  fills it from the order paperwork. */
export function extractCuttingList(order: LocalOrder): CutLine[] {
  const lines: CutLine[] = [];
  for (const item of order.items || []) {
    const m = String(item.name || "").match(/(\d+(?:\.\d+)?)\s*m\b/);
    if (m && (/metre/i.test(item.unit || "") || /sheet/i.test(item.name))) {
      lines.push({ lengthM: parseFloat(m[1]), qty: Math.max(1, Math.round(Number(item.quantity) || 1)) });
    }
  }
  if (!lines.length && order.note) {
    const re = /(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*m\b/gi;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(order.note))) lines.push({ qty: parseInt(mm[1], 10), lengthM: parseFloat(mm[2]) });
  }
  return lines;
}
const KNOWN_COLOURS = ["Charcoal", "Brick Red", "Forest Green", "Ocean Blue", "Terracotta", "Ivory", "Chocolate"];
export function jobFromOrder(order: LocalOrder): ProductionJob {
  const first = (order.items || [])[0];
  const name = first?.name || "Roofing sheets (see order)";
  const gauge = (name.match(/(\d\.\d+\s*mm)/i) || [])[1] || "";
  const colour = KNOWN_COLOURS.find(c => name.toLowerCase().includes(c.toLowerCase())) || "";
  const cuttingList = extractCuttingList(order);
  const now = new Date().toISOString();
  return {
    code: productionJobCode(), orderCode: order.code, customerName: order.name,
    customerPhone: order.phone || "", address: order.address || "",
    product: { name, gauge, colour }, cuttingList, totalMetres: cuttingListTotal(cuttingList),
    status: "Queued", operatorName: "", metresProduced: 0, scrapNote: "", scheduleNote: "",
    checklist: [], qc: null, qcHistory: [], createdAt: now, updatedAt: now,
  };
}
export function productionJobCode(): string {
  return `PRD-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

const KEY = "oketex-production";
export function getProductionJobs(): ProductionJob[] {
  try { const r = localStorage.getItem(KEY); return r ? (JSON.parse(r) as ProductionJob[]) : []; } catch { return []; }
}
function writeJobs(list: ProductionJob[]) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } }
export function saveProductionJob(job: ProductionJob): ProductionJob {
  const all = getProductionJobs(); const i = all.findIndex(j => j.code === job.code);
  if (i >= 0) all[i] = job; else all.unshift(job);
  writeJobs(all); return job;
}
function dedupeByCode(...lists: ProductionJob[][]): ProductionJob[] {
  const seen = new Set<string>(); const out: ProductionJob[] = [];
  for (const list of lists) for (const j of list) { const k = j.code.toUpperCase(); if (!seen.has(k)) { seen.add(k); out.push(j); } }
  return out;
}

export async function getProductionJobsAsync(): Promise<ProductionJob[]> {
  if (await probeApi()) {
    try {
      const { jobs } = await apiFetch<{ jobs: ProductionJob[] }>("/api/production");
      jobs.forEach(j => saveProductionJob(j));
      return dedupeByCode(jobs, getProductionJobs());
    } catch { /* staff-only endpoint — local stands */ }
  }
  return getProductionJobs();
}
export async function createProductionJobAsync(job: ProductionJob): Promise<ProductionJob> {
  if (await probeApi()) {
    try {
      const { job: saved } = await apiFetch<{ job: ProductionJob }>("/api/production", { method: "POST", body: JSON.stringify(job) });
      return saveProductionJob(saved);
    } catch { /* local stands */ }
  }
  return saveProductionJob(job);
}
/** Auto-create from a confirmed order — idempotent: an open job for the
 *  order is returned instead of duplicated. */
export async function ensureProductionJobForOrderAsync(order: LocalOrder): Promise<ProductionJob> {
  const existing = getProductionJobs().find(j => j.orderCode === order.code && j.status !== "Delivered");
  if (existing) return existing;
  return createProductionJobAsync(jobFromOrder(order));
}

type ServerAction = "assign" | "schedule" | "checklist" | "start" | "finish" | "qc" | "bundle" | "dispatch" | "deliver";
export async function productionActionAsync(code: string, action: ServerAction, patch: Record<string, unknown> = {}): Promise<ProductionJob | undefined> {
  // Local first (same state machine), then the server when live.
  const local = getProductionJobs().find(j => j.code === code);
  if (local) {
    let next: ProductionJob | null = null;
    if (action === "assign") next = { ...local, operatorName: String(patch.operatorName || ""), updatedAt: new Date().toISOString() };
    else if (action === "schedule") next = { ...local, scheduleNote: String(patch.scheduleNote || ""), updatedAt: new Date().toISOString() };
    else if (action === "checklist") next = { ...local, checklist: (patch.checklist as string[]) || [], updatedAt: new Date().toISOString() };
    else if (action === "qc") {
      const entry: QcEntry = { by: String(patch.by || "QC"), at: new Date().toISOString(), result: patch.result === "pass" ? "pass" : "fail", notes: String(patch.notes || "") };
      next = applyTransition(local, patch.result === "pass" ? "qcPass" : "qcFail", { qc: entry, qcHistory: [...(local.qcHistory || []), entry] });
    } else if (action === "finish") next = applyTransition(local, "finish", { metresProduced: Number(patch.metresProduced) || 0, scrapNote: String(patch.scrapNote || "") });
    else next = applyTransition(local, action as ProductionAction);
    if (next) saveProductionJob(next);
  }
  if (await probeApi()) {
    try {
      const { job } = await apiFetch<{ job: ProductionJob }>("/api/production", { method: "PATCH", body: JSON.stringify({ code, action, ...patch }) });
      return saveProductionJob(job);
    } catch { /* local stands */ }
  }
  return getProductionJobs().find(j => j.code === code);
}
