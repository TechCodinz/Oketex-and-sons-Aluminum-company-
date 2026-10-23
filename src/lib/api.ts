// Phase 5 API client — LIVE vs DEMO mode gate.
// The app probes GET /api/health once; the backend counts as LIVE only when
// the database answers (health.db === true). Every store wrapper tries the
// API first when live and falls back to the exact localStorage behaviour on
// ANY failure, so the site can never break because the backend is absent.
export interface Health { ok: boolean; db: boolean; auth?: boolean; payments?: boolean; ts?: string }

let liveCache: boolean | null = null;
let healthCache: Health | null = null;
let probing: Promise<boolean> | null = null;
const FLAG = "oketex-api-live";

export function apiLiveSync(): boolean {
  if (liveCache !== null) return liveCache;
  try { return localStorage.getItem(FLAG) === "1"; } catch { return false; }
}
export function healthSync(): Health | null { return healthCache; }

export function probeApi(force = false): Promise<boolean> {
  if (!force && liveCache !== null) return Promise.resolve(liveCache);
  if (probing && !force) return probing;
  probing = (async () => {
    try {
      const res = await fetch("/api/health", { credentials: "include", headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as Health;
      healthCache = j;
      liveCache = !!j.db;
    } catch {
      liveCache = false;
      healthCache = null;
    }
    try { localStorage.setItem(FLAG, liveCache ? "1" : "0"); } catch { /* ignore */ }
    try { window.dispatchEvent(new CustomEvent("oketex-api", { detail: { live: liveCache } })); } catch { /* ignore */ }
    probing = null;
    return liveCache;
  })();
  return probing;
}

/** React hook: current live flag (false until the probe resolves). */
import { useEffect, useState } from "react";
export function useApiLive(): boolean {
  const [live, setLive] = useState<boolean>(() => apiLiveSync());
  useEffect(() => {
    let on = true;
    probeApi().then(v => { if (on) setLive(v); });
    const h = () => setLive(apiLiveSync());
    window.addEventListener("oketex-api", h);
    return () => { on = false; window.removeEventListener("oketex-api", h); };
  }, []);
  return live;
}

/** JSON fetch against /api with cookies; throws Error(server message) on !ok. */
export async function apiFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `Request failed (${res.status})`);
  return data as T;
}

// ---------------- Payments (Paystack via our API) ----------------
export interface PayInitResult { enabled: boolean; authorizationUrl?: string; reference?: string; reason?: string; error?: string }
export const paymentsApi = {
  async initialize(input: { email: string; amountNgn: number; purpose: string; refId?: string; callbackUrl?: string }): Promise<PayInitResult> {
    try {
      return await apiFetch<PayInitResult>("/api/payments/initialize", { method: "POST", body: JSON.stringify(input) });
    } catch (e: any) {
      return { enabled: true, error: String(e?.message || e) };
    }
  },
  async verify(reference: string): Promise<{ enabled: boolean; status?: string; payment?: any }> {
    return apiFetch(`/api/payments/verify?reference=${encodeURIComponent(reference)}`);
  },
};
