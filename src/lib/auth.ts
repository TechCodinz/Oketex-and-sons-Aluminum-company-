// Phase 5 frontend auth — talks to /api/auth/* (JWT httpOnly cookie set by
// the server; this module never sees the token). In demo mode (no live API)
// every call resolves to null/false and the UI keeps its local behaviour.
import { apiFetch, probeApi } from "./api";

export interface AuthUser {
  id: number | string; name: string; email: string; phone?: string;
  /** "customer" | "partner" | a staff role (see lib/staff.ts STAFF_ROLES —
   *  "admin" is the owner). Typed as string: the role catalogue lives in
   *  staff.ts and the session endpoints validate it server-side. */
  role: string; partnerCode?: string | null; active?: boolean;
}

let cached: AuthUser | null | undefined = undefined;
const EVT = "oketex-auth";
function emit() { try { window.dispatchEvent(new CustomEvent(EVT)); } catch { /* ignore */ } }
export function getCachedUser(): AuthUser | null | undefined { return cached; }
export function onAuthChange(cb: () => void): () => void {
  window.addEventListener(EVT, cb);
  return () => window.removeEventListener(EVT, cb);
}

export async function fetchMe(force = false): Promise<AuthUser | null> {
  if (!force && cached !== undefined) return cached;
  if (!(await probeApi())) { cached = null; return null; }
  try {
    const { user } = await apiFetch<{ user: AuthUser }>("/api/auth/me");
    cached = user;
  } catch { cached = null; }
  emit();
  return cached;
}
export async function login(email: string, password: string): Promise<AuthUser> {
  const { user } = await apiFetch<{ user: AuthUser }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  cached = user; emit();
  return user;
}
export async function register(input: { name: string; email: string; phone?: string; password: string; partnerCode?: string }): Promise<AuthUser> {
  const { user } = await apiFetch<{ user: AuthUser }>("/api/auth/register", { method: "POST", body: JSON.stringify(input) });
  cached = user; emit();
  return user;
}
export async function logout(): Promise<void> {
  try { await apiFetch("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
  cached = null; emit();
}

import { useEffect, useState } from "react";
export function useAuthUser(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(() => (cached === undefined ? null : cached));
  useEffect(() => {
    let on = true;
    fetchMe().then(u => { if (on) setUser(u); });
    const h = () => setUser(cached ?? null);
    window.addEventListener(EVT, h);
    return () => { on = false; window.removeEventListener(EVT, h); };
  }, []);
  return user;
}
