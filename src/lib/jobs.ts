// Jobs board + bidding (Phase 6) — customers post jobs, approved partners
// bid, the customer accepts a bid and the win becomes a tracked network
// LEAD (commission snapshotted from the effective partner terms at award
// time — the exact rule leads have always used). Local-first like every
// other store: localStorage is the demo source of truth; when the Phase 5
// backend is live the same actions sync through /api/jobs, /api/jobs/bid
// and /api/jobs/award (the server performs the award + lead creation).
import { apiFetch, probeApi } from "./api";
import { addLeadAsync, findPartner, type Lead } from "./partnerStorage";
import { getPartnerTerms } from "./settings";
import { commissionFor } from "@/data/partnerTerms";
import { notify } from "./notify";
import { formatNGN } from "./money";

export type JobStatus = "Open" | "Awarded" | "In Progress" | "Completed" | "Closed";
export const JOB_STATUSES: JobStatus[] = ["Open", "Awarded", "In Progress", "Completed", "Closed"];
export type BidStatus = "Pending" | "Accepted" | "Rejected";
export interface Job {
  code: string; title: string; trade: string; description: string; location: string;
  budgetLow: number; budgetHigh: number;
  customerName: string; customerPhone: string; sourceQuoteCode?: string;
  status: JobStatus; createdAt: string;
}
export interface Bid {
  id: string; jobCode: string; partnerCode: string; partnerName: string;
  amount: number; days: number; note: string; status: BidStatus; createdAt: string;
}

const JOBS_KEY = "oketex-jobs";
const BIDS_KEY = "oketex-bids";
function read<T>(key: string): T[] { try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T[]) : []; } catch { return []; } }
function write(key: string, list: unknown[]) { try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* ignore */ } }

export function jobCode() { return `JB-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; }
export function getJobs(): Job[] { return read<Job>(JOBS_KEY); }
export function saveJobs(list: Job[]) { write(JOBS_KEY, list); }
export function getBids(): Bid[] { return read<Bid>(BIDS_KEY); }
export function saveBids(list: Bid[]) { write(BIDS_KEY, list); }
export function bidsForJob(jobCode: string): Bid[] {
  return getBids().filter(b => b.jobCode.toUpperCase() === jobCode.trim().toUpperCase());
}
export function bidsForPartner(partnerCode: string): Bid[] {
  return getBids().filter(b => b.partnerCode.toUpperCase() === partnerCode.trim().toUpperCase());
}
export function findJobs(q: string): Job[] {
  const s = q.trim().toLowerCase(); if (!s) return [];
  const digits = s.replace(/\D/g, "");
  return getJobs().filter(j => j.code.toLowerCase() === s || (digits.length >= 7 && j.customerPhone.replace(/\D/g, "").endsWith(digits.slice(-10))));
}
export function addJob(input: Omit<Job, "code" | "status" | "createdAt"> & { code?: string }): Job {
  const job: Job = { ...input, code: input.code || jobCode(), status: "Open", createdAt: new Date().toISOString() };
  saveJobs([job, ...getJobs()]);
  return job;
}
export function updateJobStatus(code: string, status: JobStatus) {
  saveJobs(getJobs().map(j => (j.code === code ? { ...j, status } : j)));
}
export function deleteJob(code: string) {
  saveJobs(getJobs().filter(j => j.code !== code));
  saveBids(getBids().filter(b => b.jobCode !== code));
}
/** Place a bid. One live bid per partner per job: re-bidding updates the
 *  partner's Pending bid in place (amount/days/note), it never duplicates. */
export function placeBid(input: { jobCode: string; partnerCode: string; partnerName: string; amount: number; days: number; note: string }): Bid {
  const job = getJobs().find(j => j.code.toUpperCase() === input.jobCode.trim().toUpperCase());
  if (!job) throw new Error("Job not found");
  if (job.status !== "Open") throw new Error("This job is not open for bids");
  const existing = getBids().find(b => b.jobCode === job.code && b.partnerCode.toUpperCase() === input.partnerCode.trim().toUpperCase() && b.status === "Pending");
  if (existing) {
    const updated = { ...existing, amount: input.amount, days: input.days, note: input.note };
    saveBids(getBids().map(b => (b.id === existing.id ? updated : b)));
    return updated;
  }
  const bid: Bid = {
    id: `BID-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    jobCode: job.code, partnerCode: input.partnerCode.trim().toUpperCase(), partnerName: input.partnerName,
    amount: Math.max(0, Math.round(input.amount || 0)), days: Math.max(0, Math.round(input.days || 0)),
    note: input.note || "", status: "Pending", createdAt: new Date().toISOString(),
  };
  saveBids([bid, ...getBids()]);
  return bid;
}
/** The commission a lead for this award would snapshot TODAY (display only —
 *  the lead itself freezes the value at creation). */
export function awardCommissionPreview(amountNgn: number): { pct: number; commissionNgn: number } {
  return commissionFor(amountNgn, getPartnerTerms().referralCommissionPct);
}
/** Award locally: winner Accepted, rivals Rejected, job Awarded, and a lead
 *  created through the standard lead path (commission snapshot included). */
export async function awardBidLocal(jobCodeIn: string, bidId: string): Promise<{ job: Job; bid: Bid; lead: Lead } | null> {
  const code = jobCodeIn.trim().toUpperCase();
  const job = getJobs().find(j => j.code === code);
  const bid = getBids().find(b => b.id === bidId && b.jobCode === code);
  if (!job || !bid || job.status !== "Open" || bid.status !== "Pending") return null;
  saveBids(getBids().map(b => (b.jobCode === code ? { ...b, status: b.id === bidId ? "Accepted" : b.status === "Pending" ? "Rejected" : b.status } : b)));
  updateJobStatus(code, "Awarded");
  const lead = await addLeadAsync({
    partnerCode: bid.partnerCode, partnerName: bid.partnerName, type: "job",
    customerName: job.customerName, customerPhone: job.customerPhone,
    description: `Won bid on job ${code} — ${job.title}`, estValueNgn: bid.amount,
  });
  const partner = findPartner(bid.partnerCode);
  notify({ templateKey: "bid_accepted", audience: "partner", refCode: code, phone: partner?.phone, vars: { partner: bid.partnerName, name: job.customerName, phone: job.customerPhone } });
  return { job: { ...job, status: "Awarded" }, bid: { ...bid, status: "Accepted" }, lead };
}

// ---------------- API-first wrappers (demo fallback) ----------------
function dedupeBy<T>(list: T[], keyOf: (x: T) => string): T[] {
  const seen = new Set<string>(); const out: T[] = [];
  for (const item of list) { const k = keyOf(item); if (!seen.has(k)) { seen.add(k); out.push(item); } }
  return out;
}
export async function getJobsAsync(): Promise<Job[]> {
  if (await probeApi()) {
    try {
      const { jobs } = await apiFetch<{ jobs: Job[] }>("/api/jobs");
      // Server board jobs are phone-stripped; local copies keep full data.
      const local = getJobs();
      const byCode = new Map(local.map(j => [j.code.toUpperCase(), j]));
      for (const j of jobs) if (!byCode.has(j.code.toUpperCase())) byCode.set(j.code.toUpperCase(), j);
      return [...byCode.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch { /* fall through */ }
  }
  return getJobs();
}
export async function getJobsAdminAsync(): Promise<Job[]> {
  if (await probeApi()) {
    try { const { jobs } = await apiFetch<{ jobs: Job[] }>("/api/jobs?all=1"); return dedupeBy([...jobs, ...getJobs()], j => j.code.toUpperCase()); }
    catch { /* fall through */ }
  }
  return getJobs();
}
export async function findJobsAsync(q: string): Promise<Job[]> {
  const local = findJobs(q);
  if (await probeApi()) {
    try {
      const isCode = /^JB-/i.test(q.trim());
      const path = isCode ? `/api/jobs?code=${encodeURIComponent(q.trim())}` : `/api/jobs?phone=${encodeURIComponent(q.trim())}`;
      const data = await apiFetch<{ job?: Job; jobs?: Job[] }>(path);
      const server = data.job ? [data.job] : (data.jobs || []);
      return dedupeBy([...server, ...local], j => j.code.toUpperCase());
    } catch { /* local only */ }
  }
  return local;
}
export async function getJobBidsAsync(jobCodeIn: string): Promise<Bid[]> {
  if (await probeApi()) {
    try { const { bids } = await apiFetch<{ bids: Bid[] }>(`/api/jobs/bid?jobCode=${encodeURIComponent(jobCodeIn.trim().toUpperCase())}`); return dedupeBy([...bids, ...bidsForJob(jobCodeIn)], b => b.id); }
    catch { /* fall through */ }
  }
  return bidsForJob(jobCodeIn);
}
export async function getPartnerBidsAsync(partnerCode: string): Promise<Bid[]> {
  if (await probeApi()) {
    try { const { bids } = await apiFetch<{ bids: Bid[] }>(`/api/jobs/bid?partnerCode=${encodeURIComponent(partnerCode.trim().toUpperCase())}`); return dedupeBy([...bids, ...bidsForPartner(partnerCode)], b => b.id); }
    catch { /* fall through */ }
  }
  return bidsForPartner(partnerCode);
}
export async function postJobAsync(input: Omit<Job, "code" | "status" | "createdAt">): Promise<Job> {
  const job = addJob(input);
  notify({ templateKey: "job_posted", audience: "admin", refCode: job.code, vars: { title: job.title, name: job.customerName, phone: job.customerPhone } });
  if (await probeApi()) { try { await apiFetch("/api/jobs", { method: "POST", body: JSON.stringify(job) }); } catch { /* local copy stands */ } }
  return job;
}
export async function placeBidAsync(input: { jobCode: string; partnerCode: string; partnerName: string; amount: number; days: number; note: string }): Promise<Bid> {
  if (await probeApi()) {
    try {
      const { bid } = await apiFetch<{ bid: Bid }>("/api/jobs/bid", { method: "POST", body: JSON.stringify(input) });
      // Mirror the server bid locally so every surface agrees offline too.
      const rest = getBids().filter(b => b.id !== bid.id);
      saveBids([bid, ...rest]);
      return bid;
    } catch { /* fall back to local */ }
  }
  return placeBid(input);
}
export async function awardBidAsync(jobCodeIn: string, bidId: string): Promise<{ job: Job; bid: Bid; lead: Lead } | null> {
  if (await probeApi()) {
    try {
      const r = await apiFetch<{ job: Job; bids: Bid[]; bid: Bid; lead: Lead }>("/api/jobs/award", { method: "POST", body: JSON.stringify({ jobCode: jobCodeIn, bidId }) });
      // Mirror server state locally (job status + all bid statuses).
      saveJobs(getJobs().map(j => (j.code === r.job.code ? { ...j, ...r.job } : j)));
      const others = getBids().filter(b => b.jobCode !== r.job.code);
      saveBids([...r.bids, ...others]);
      const partner = findPartner(r.bid.partnerCode);
      notify({ templateKey: "bid_accepted", audience: "partner", refCode: r.job.code, phone: partner?.phone, vars: { partner: r.bid.partnerName, name: r.job.customerName, phone: r.job.customerPhone } });
      return r;
    } catch { /* fall back to local award */ }
  }
  return awardBidLocal(jobCodeIn, bidId);
}
export async function updateJobStatusAsync(code: string, status: JobStatus): Promise<void> {
  updateJobStatus(code, status);
  if (await probeApi()) { try { await apiFetch("/api/jobs", { method: "PATCH", body: JSON.stringify({ code, status }) }); } catch { /* local stands (PATCH is admin-gated live) */ } }
}
export function budgetLabel(job: Job): string {
  if (job.budgetLow > 0 && job.budgetHigh > 0) return `${formatNGN(job.budgetLow)} – ${formatNGN(job.budgetHigh)}`;
  if (job.budgetHigh > 0) return `Up to ${formatNGN(job.budgetHigh)}`;
  if (job.budgetLow > 0) return `From ${formatNGN(job.budgetLow)}`;
  return "Budget open — bid your price";
}
