// Living knowledge store — the Pro Guide's library grows with the trade.
// Built-in (seed) cards live in code (src/data/roofPatterns.ts +
// tradeGuides.ts) and are NEVER duplicated here: this store holds
// COMMUNITY entries only (partner/staff contributions), merged with the
// seeds at read time. Nothing auto-publishes — a staff member approves
// every community entry before it surfaces, badged "From the field".
// Confirmations ("This worked for me") are one-per-partner; seed-card
// counts in demo mode live in a per-device store, community counts on
// the entry itself. Demo = localStorage; live = /api/knowledge.
import { probeApi, apiFetch } from "./api";
import type { GuideTrade } from "@/data/roofPatterns";
import type { Partner } from "./partnerStorage";

export type KnowledgeKind = "pattern" | "fix" | "tip";
export type KnowledgeStatus = "pending" | "approved" | "rejected";
export interface KnowledgeEntry {
  id: string;
  kind: KnowledgeKind | "seedref";
  trade: GuideTrade;
  title: string;
  body: string;
  tools: string[];
  source: "seed" | "pro" | "staff";
  contributorName: string;
  contributorCode: string;
  status: KnowledgeStatus;
  confirmations: number;
  confirmedBy: string[];
  rejectNote?: string;
  createdAt: string;
  updatedAt: string;
}

const KEY = "oketex-knowledge";
const SEED_CONFIRM_KEY = "oketex-knowledge-seed-confirm";
const PROOF_KEY = "oketex-partner-proof";

export function knowledgeId(): string {
  return `KNW-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

// ---------------- local (demo) store ----------------
export function getLocalEntries(): KnowledgeEntry[] {
  try { const r = localStorage.getItem(KEY); return r ? (JSON.parse(r) as KnowledgeEntry[]) : []; } catch { return []; }
}
function writeAll(list: KnowledgeEntry[]) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } }
export function saveLocalEntry(rec: KnowledgeEntry): KnowledgeEntry {
  const all = getLocalEntries(); const i = all.findIndex(e => e.id === rec.id);
  if (i >= 0) all[i] = rec; else all.unshift(rec);
  writeAll(all); return rec;
}

// ---------------- seed confirmations (demo / per-device) ----------------
export interface SeedConfirm { count: number; by: string[] }
export function getSeedConfirmations(): Record<string, SeedConfirm> {
  try { const r = localStorage.getItem(SEED_CONFIRM_KEY); return r ? (JSON.parse(r) as Record<string, SeedConfirm>) : {}; } catch { return {}; }
}
/** Returns true when this tap actually added a confirmation. */
export function confirmSeedLocally(id: string, partnerCode: string): boolean {
  const all = getSeedConfirmations();
  const cur = all[id] || { count: 0, by: [] };
  if (cur.by.includes(partnerCode)) return false;
  all[id] = { count: cur.count + 1, by: [...cur.by, partnerCode] };
  try { localStorage.setItem(SEED_CONFIRM_KEY, JSON.stringify(all)); } catch { /* ignore */ }
  return true;
}
export function seedConfirmedBy(id: string, partnerCode: string): boolean {
  return (getSeedConfirmations()[id]?.by || []).includes(partnerCode);
}

// ---------------- partner proof (shared with Partner Status) ----------------
export interface PartnerProof { code: string; phone: string; name: string }
export function getPartnerProof(): PartnerProof | null {
  try { const r = localStorage.getItem(PROOF_KEY); return r ? (JSON.parse(r) as PartnerProof) : null; } catch { return null; }
}
export function savePartnerProof(p: PartnerProof) { try { localStorage.setItem(PROOF_KEY, JSON.stringify(p)); } catch { /* ignore */ } }
export function clearPartnerProof() { try { localStorage.removeItem(PROOF_KEY); } catch { /* ignore */ } }

// ---------------- validation (pure) ----------------
export const KNOWLEDGE_TRADES: GuideTrade[] = ["Roofing", "Plumbing", "Tiling", "Carpentry & Woodwork", "Electrical", "Painting & Finishing", "Concrete & Masonry", "Welding & Metalwork", "Interior & Cabinetry"];
export function validateContribution(input: { kind: string; trade: string; title: string; body: string }): string | null {
  if (!KNOWLEDGE_TRADES.includes(input.trade as GuideTrade)) return "Pick the trade this belongs to.";
  if (!["pattern", "fix", "tip"].includes(input.kind)) return "Pick the kind: pattern, fix or tip.";
  if (!input.title || input.title.trim().length < 4) return "Give it a title (at least 4 characters).";
  if (!input.body || input.body.trim().length < 20) return "Write the steps or the fix out in full (at least 20 characters) — the next pro reads only this.";
  return null;
}

// ---------------- the merge (pure) ----------------
export interface LibrarySeed { id: string; kind: string; trade: string; title: string }
export interface MergedEntry {
  id: string; kind: string; trade: string; title: string;
  source: "seed" | "pro" | "staff";
  contributorName?: string;
  confirmations: number;
  /** The community entry behind this row, when it is one (or a seedref pointer). */
  entry?: KnowledgeEntry;
}
/**
 * Merge built-in seed cards with APPROVED community entries into one
 * ranked library. A community row whose id matches a seed id is a
 * 'seedref' confirmation pointer: its count folds into the seed card
 * instead of duplicating it. Sort: confirmations desc, then title.
 */
export function mergeLibrary(
  seeds: LibrarySeed[],
  community: KnowledgeEntry[],
  seedConfirmations: Record<string, SeedConfirm> = {},
): MergedEntry[] {
  const approved = community.filter(e => e.status === "approved");
  const pointers = new Map<string, KnowledgeEntry>();
  const rows: MergedEntry[] = [];
  for (const e of approved) {
    if (e.kind === "seedref") { pointers.set(e.id, e); continue; }
    rows.push({ id: e.id, kind: e.kind, trade: e.trade, title: e.title, source: e.source, contributorName: e.contributorName, confirmations: e.confirmations || 0, entry: e });
  }
  for (const s of seeds) {
    const ptr = pointers.get(s.id);
    const local = seedConfirmations[s.id]?.count || 0;
    rows.push({
      id: s.id, kind: s.kind, trade: s.trade, title: s.title, source: "seed",
      confirmations: (ptr?.confirmations || 0) + local,
      entry: ptr,
    });
  }
  rows.sort((a, b) => b.confirmations - a.confirmations || a.title.localeCompare(b.title));
  return rows;
}

/** Ops Agent briefing slice: pending count + most confirmed fix of the week. */
export function knowledgeBriefing(entries: KnowledgeEntry[], now: Date = new Date()): { pendingReview: number; topFixThisWeek: { title: string; confirmations: number } | null } {
  const pendingReview = entries.filter(e => e.status === "pending").length;
  const weekAgo = now.getTime() - 7 * 24 * 3600_000;
  const fixes = entries
    .filter(e => e.status === "approved" && e.kind === "fix" && (e.confirmations || 0) > 0 && new Date(e.updatedAt || e.createdAt).getTime() >= weekAgo)
    .sort((a, b) => (b.confirmations || 0) - (a.confirmations || 0));
  return { pendingReview, topFixThisWeek: fixes.length ? { title: fixes[0].title, confirmations: fixes[0].confirmations } : null };
}

// ---------------- async (API-first, local fallback) ----------------
export async function listKnowledgeAsync(): Promise<KnowledgeEntry[]> {
  if (await probeApi()) {
    try {
      const { entries } = await apiFetch<{ entries: KnowledgeEntry[] }>("/api/knowledge");
      // Mirror locally so demo surfaces keep working offline of a reload.
      const locals = getLocalEntries().filter(e => e.status === "pending" || e.status === "rejected");
      return [...entries, ...locals.filter(l => !entries.some(s => s.id === l.id))];
    } catch { /* local stands */ }
  }
  return getLocalEntries().filter(e => e.status === "approved");
}
export async function listKnowledgeAllAsync(): Promise<KnowledgeEntry[]> {
  if (await probeApi()) {
    try {
      const { entries } = await apiFetch<{ entries: KnowledgeEntry[] }>("/api/knowledge?all=1");
      entries.forEach(e => { if (e.kind !== "seedref") saveLocalEntry(e); });
      const merged = [...entries];
      for (const l of getLocalEntries()) if (!merged.some(s => s.id === l.id)) merged.push(l);
      return merged.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    } catch { /* staff-only — local stands */ }
  }
  return getLocalEntries();
}
export async function listMyKnowledgeAsync(partner: Partner, phone: string): Promise<KnowledgeEntry[]> {
  if (await probeApi()) {
    try {
      const { entries } = await apiFetch<{ entries: KnowledgeEntry[] }>(`/api/knowledge?mine=${encodeURIComponent(partner.code)}&phone=${encodeURIComponent(phone)}`);
      return entries;
    } catch { /* local stands */ }
  }
  return getLocalEntries().filter(e => e.contributorCode === partner.code);
}

export interface ContributionInput { kind: KnowledgeKind; trade: GuideTrade; title: string; body: string; tools: string[] }
export async function submitKnowledgeAsync(input: ContributionInput, proof: { partner: Partner; phone: string } | { staffName: string }): Promise<{ entry?: KnowledgeEntry; error?: string }> {
  const invalid = validateContribution(input);
  if (invalid) return { error: invalid };
  const now = new Date().toISOString();
  if (await probeApi()) {
    try {
      const body = "partner" in proof
        ? { ...input, partnerCode: proof.partner.code, phone: proof.phone }
        : { ...input };
      const { entry } = await apiFetch<{ entry: KnowledgeEntry }>("/api/knowledge", { method: "POST", body: JSON.stringify(body) });
      return { entry };
    } catch (e: any) { return { error: String(e?.message || e) }; }
  }
  const entry: KnowledgeEntry = {
    id: knowledgeId(), kind: input.kind, trade: input.trade,
    title: input.title.trim(), body: input.body.trim(), tools: input.tools,
    source: "partner" in proof ? "pro" : "staff",
    contributorName: "partner" in proof ? proof.partner.businessName : proof.staffName,
    contributorCode: "partner" in proof ? proof.partner.code : "",
    status: "pending", confirmations: 0, confirmedBy: [], createdAt: now, updatedAt: now,
  };
  return { entry: saveLocalEntry(entry) };
}

export async function moderateKnowledgeAsync(id: string, action: "approve" | "reject", note = ""): Promise<{ entry?: KnowledgeEntry; error?: string }> {
  if (await probeApi()) {
    try {
      const { entry } = await apiFetch<{ entry: KnowledgeEntry }>("/api/knowledge", { method: "PATCH", body: JSON.stringify({ id, action, note }) });
      if (entry.kind !== "seedref") saveLocalEntry({ ...entry, confirmedBy: getLocalEntries().find(e => e.id === id)?.confirmedBy || [] });
      return { entry };
    } catch (e: any) { return { error: String(e?.message || e) }; }
  }
  const rec = getLocalEntries().find(e => e.id === id);
  if (!rec) return { error: "Entry not found" };
  if (rec.kind === "seedref") return { error: "Seed pointers are not moderated" };
  const saved = saveLocalEntry({ ...rec, status: action === "approve" ? "approved" : "rejected", rejectNote: action === "reject" ? note : "", updatedAt: new Date().toISOString() });
  return { entry: saved };
}

/**
 * Confirm "this worked for me". Community entries confirm on their own
 * record; seed cards confirm into the per-device seed store locally, or
 * into a server seedref pointer when live. One tap per partner, ever.
 */
export async function confirmKnowledgeAsync(
  target: { id: string; isSeed: boolean; seedTitle?: string; seedTrade?: string },
  partner: Partner, phone: string,
): Promise<{ confirmations: number; alreadyConfirmed?: boolean; error?: string }> {
  if (!target.isSeed) {
    if (await probeApi()) {
      try {
        const { entry, alreadyConfirmed } = await apiFetch<{ entry: KnowledgeEntry; alreadyConfirmed?: boolean }>("/api/knowledge", { method: "PATCH", body: JSON.stringify({ id: target.id, action: "confirm", partnerCode: partner.code, phone }) });
        const local = getLocalEntries().find(e => e.id === target.id);
        if (local) saveLocalEntry({ ...local, confirmations: entry.confirmations, confirmedBy: [...(local.confirmedBy || []), partner.code] });
        return { confirmations: entry.confirmations, alreadyConfirmed };
      } catch (e: any) { return { confirmations: 0, error: String(e?.message || e) }; }
    }
    const rec = getLocalEntries().find(e => e.id === target.id);
    if (!rec) return { confirmations: 0, error: "Entry not found" };
    if ((rec.confirmedBy || []).includes(partner.code)) return { confirmations: rec.confirmations, alreadyConfirmed: true };
    const saved = saveLocalEntry({ ...rec, confirmations: (rec.confirmations || 0) + 1, confirmedBy: [...(rec.confirmedBy || []), partner.code], updatedAt: new Date().toISOString() });
    return { confirmations: saved.confirmations };
  }
  // Seed card.
  if (await probeApi()) {
    try {
      const { entry, alreadyConfirmed } = await apiFetch<{ entry: KnowledgeEntry; alreadyConfirmed?: boolean }>("/api/knowledge", { method: "PATCH", body: JSON.stringify({ id: target.id, action: "confirm", partnerCode: partner.code, phone, seedTitle: target.seedTitle, seedTrade: target.seedTrade }) });
      return { confirmations: entry.confirmations + (getSeedConfirmations()[target.id]?.count || 0), alreadyConfirmed };
    } catch { /* fall back to the device store */ }
  }
  const added = confirmSeedLocally(target.id, partner.code);
  const ptr = (await listKnowledgeAsync().catch(() => [] as KnowledgeEntry[])).find(e => e.id === target.id);
  return { confirmations: (ptr?.confirmations || 0) + (getSeedConfirmations()[target.id]?.count || 0), alreadyConfirmed: !added };
}
