// Staff System (2026-10-25) — staff accounts, roles and role-scoped admin
// tabs. Staff ACCOUNTS live in the `users` table on the server (role field);
// this module holds the role catalogue, the tab→role map the Admin page
// enforces in the UI (the API enforces the same roles server-side), and a
// local demo store (`oketex-staff`) used while the backend is not live.
// Demo-mode passwords are demo-grade, exactly like the admin123 gate — the
// Staff tab labels itself accordingly whenever the API is not live.
import { apiFetch, probeApi } from "./api";

export const STAFF_ROLES = [
  "admin", "sales", "operations", "store", "accounts", "support", "field",
  "production_manager", "operator", "qc", "warehouse", "dispatch", "maintenance",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type UserRole = "customer" | "partner" | StaffRole;
export function isStaffRole(role?: string | null): role is StaffRole {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role);
}

export const ROLE_INFO: Record<StaffRole, { label: string; duties: string }> = {
  admin: { label: "Owner / Super Admin", duties: "Everything — staff management, settings & rates, plans, payouts approval." },
  sales: { label: "Sales Officer", duties: "Orders, quotes, bookings, customer follow-up, Snap & Send intake queue, partner leads." },
  operations: { label: "Operations / Dispatch Coordinator", duties: "Jobs & bidding, Snap & Send assessment + assignment, partner approvals, delivery dispatch." },
  store: { label: "Store Keeper", duties: "Product catalogue, prices + Price Watch, coupons, coil stock." },
  accounts: { label: "Accountant", duties: "Invoicing, payments, commissions ledger, partner payouts, revenue reports." },
  support: { label: "Customer Support", duties: "Reviews moderation, notifications outbox, track-enquiry help, WhatsApp follow-ups." },
  field: { label: "Field Supervisor / Measurer", duties: "Site measurement bookings, Pro Check verifications, Snap & Send progress oversight." },
  production_manager: { label: "Production Manager", duties: "Production board — queue, scheduling, operator assignment, output." },
  operator: { label: "Machine Operator", duties: "Production Jobs page — run assigned job cards, metres produced, scrap notes." },
  qc: { label: "Quality Control Officer", duties: "QC page — inspect produced batches (gauge, length, colour), pass/fail + notes." },
  warehouse: { label: "Warehouse Keeper", duties: "Stock page — coil inventory (gauge/colour/kg), finished bundles, low-stock flags." },
  dispatch: { label: "Dispatch / Loading Crew", duties: "Dispatch page — ready orders, load checklist, destination + directions, dispatched/delivered." },
  maintenance: { label: "Maintenance Technician", duties: "Maintenance page — machine list, service due dates, breakdown log." },
};

/** Every Admin tab id. The Admin page renders only the tabs the signed-in
 *  role covers; the owner ("admin") sees all of them. */
export type AdminTabId =
  | "quotes" | "orders" | "bookings" | "partners" | "settings" | "catalog"
  | "verify" | "plans" | "jobs" | "reviews" | "notifications" | "snap"
  | "staff" | "activity" | "ops"
  | "production" | "operator" | "qc" | "stock" | "dispatch" | "maintenance"
  | "supply";

export const TAB_ROLES: Record<AdminTabId, StaffRole[]> = {
  quotes: ["admin", "sales"],
  orders: ["admin", "sales", "accounts", "operations"],
  bookings: ["admin", "sales", "operations", "field"],
  verify: ["admin", "field", "operations"],
  jobs: ["admin", "operations"],
  snap: ["admin", "sales", "operations", "field"],
  reviews: ["admin", "support"],
  notifications: ["admin", "support"],
  settings: ["admin", "store"],
  partners: ["admin", "operations", "sales", "accounts"],
  plans: ["admin", "accounts"],
  catalog: ["admin", "store"],
  staff: ["admin"],
  activity: ["admin"],
  ops: ["admin", "operations", "sales", "production_manager"],
  production: ["admin", "production_manager"],
  operator: ["admin", "operator", "production_manager"],
  qc: ["admin", "qc"],
  stock: ["admin", "warehouse", "store", "production_manager"],
  dispatch: ["admin", "dispatch", "operations", "production_manager"],
  maintenance: ["admin", "maintenance", "production_manager"],
  supply: ["admin", "operations", "store", "accounts"],
};
export function roleCanSeeTab(role: string | null | undefined, tab: AdminTabId): boolean {
  if (!role) return false;
  if (role === "admin") return true;
  return (TAB_ROLES[tab] as string[]).includes(role);
}

export interface StaffMember {
  id: number | string; name: string; email: string; phone: string;
  role: StaffRole; active: boolean; createdAt?: string;
  /** Demo mode only: the demo-grade password, kept in this browser so the
   *  Staff tab can run logins without a backend. Never set in live mode. */
  password?: string;
}

const KEY = "oketex-staff";
export function getStaffLocal(): StaffMember[] {
  try { const r = localStorage.getItem(KEY); return r ? (JSON.parse(r) as StaffMember[]) : []; } catch { return []; }
}
export function saveStaffLocal(list: StaffMember[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
}
/** Demo login check — matches email + password against the local staff
 *  store. Returns the member when the credentials fit AND the account is
 *  active; null otherwise. Only used while the API is not live. */
export function findDemoStaff(email: string, password: string): StaffMember | null {
  const e = email.trim().toLowerCase();
  const m = getStaffLocal().find(s => s.email.toLowerCase() === e);
  if (!m || !m.active || !m.password || m.password !== password) return null;
  return m;
}

export async function getStaffAsync(): Promise<StaffMember[]> {
  if (await probeApi()) {
    try {
      const { staff } = await apiFetch<{ staff: StaffMember[] }>("/api/staff");
      return staff;
    } catch { /* fall through to local */ }
  }
  return getStaffLocal().map(({ password: _pw, ...rest }) => rest);
}
export async function createStaffAsync(input: { name: string; email: string; phone: string; role: StaffRole; password: string }): Promise<{ member?: StaffMember; error?: string }> {
  if (await probeApi()) {
    try {
      const { staff } = await apiFetch<{ staff: StaffMember }>("/api/staff", { method: "POST", body: JSON.stringify(input) });
      return { member: staff };
    } catch (e: any) { return { error: String(e?.message || e) }; }
  }
  const email = input.email.trim().toLowerCase();
  if (getStaffLocal().some(s => s.email.toLowerCase() === email)) return { error: "An account with this email already exists" };
  const member: StaffMember = {
    id: `demo-${Math.random().toString(36).slice(2, 9)}`,
    name: input.name.trim(), email, phone: input.phone.trim(),
    role: input.role, active: true, createdAt: new Date().toISOString(), password: input.password,
  };
  saveStaffLocal([...getStaffLocal(), member]);
  const { password: _pw, ...pub } = member;
  return { member: pub };
}
export async function updateStaffAsync(id: number | string, patch: { role?: StaffRole; active?: boolean; password?: string }): Promise<{ member?: StaffMember; error?: string }> {
  if (await probeApi()) {
    try {
      const { staff } = await apiFetch<{ staff: StaffMember }>("/api/staff", { method: "PATCH", body: JSON.stringify({ id, ...patch }) });
      return { member: staff };
    } catch (e: any) { return { error: String(e?.message || e) }; }
  }
  const list = getStaffLocal();
  const i = list.findIndex(s => String(s.id) === String(id));
  if (i < 0) return { error: "Staff member not found" };
  list[i] = { ...list[i], ...patch };
  saveStaffLocal(list);
  const { password: _pw, ...pub } = list[i];
  return { member: pub };
}
