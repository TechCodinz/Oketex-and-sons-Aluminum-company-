// Staff activity log (Staff System, 2026-10-25) — who did what, when.
// Local copy in `oketex-activity`; when the backend is live the entry is
// also POSTed to /api/activity (the server stamps the actor from the
// SESSION, so entries can't be spoofed) and the owner's Activity tab reads
// the merged server + local list. The Ops Agent's own drafts are logged
// with the actor "Ops Agent (draft)".
import { apiFetch, probeApi } from "./api";

export interface ActivityEntry {
  id: string; ts: string; actorName: string; actorRole: string;
  action: string; refCode: string; detail: string;
}

const KEY = "oketex-activity";
export function getActivityLocal(): ActivityEntry[] {
  try { const r = localStorage.getItem(KEY); return r ? (JSON.parse(r) as ActivityEntry[]) : []; } catch { return []; }
}
function saveLocal(list: ActivityEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 500))); } catch { /* ignore */ }
}

/** The signed-in admin identity for this browser session (set by /admin at
 *  login). Falls back to the demo owner when only the demo flag is set. */
export function currentActor(): { name: string; role: string } {
  try {
    const raw = sessionStorage.getItem("oketex-admin-session");
    if (raw) { const s = JSON.parse(raw); if (s?.name) return { name: String(s.name), role: String(s.role || "admin") }; }
  } catch { /* ignore */ }
  return { name: "Owner", role: "admin" };
}

export function logActivity(action: string, refCode = "", detail = "", actor?: { name: string; role: string }): void {
  const a = actor || currentActor();
  const entry: ActivityEntry = {
    id: `ACT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    ts: new Date().toISOString(), actorName: a.name, actorRole: a.role,
    action, refCode, detail,
  };
  saveLocal([entry, ...getActivityLocal()]);
  // An explicit actor override (the Ops Agent's drafts) is a local-only
  // entry: the server stamps entries from the session, so posting it would
  // create a second copy under the staff member's own name.
  if (actor) return;
  void (async () => {
    if (await probeApi()) {
      try { await apiFetch("/api/activity", { method: "POST", body: JSON.stringify({ action, refCode, detail }) }); }
      catch { /* local copy stands */ }
    }
  })();
}

/** Owner view: server entries (live) merged with this device's, newest first. */
export async function getActivityAsync(): Promise<ActivityEntry[]> {
  const local = getActivityLocal();
  if (await probeApi()) {
    try {
      const { entries } = await apiFetch<{ entries: ActivityEntry[] }>("/api/activity");
      const byId = new Map<string, ActivityEntry>();
      for (const e of [...entries, ...local]) if (!byId.has(e.id)) byId.set(e.id, e);
      return [...byId.values()].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 300);
    } catch { /* owner-only endpoint — local stands for everyone else */ }
  }
  return local;
}
