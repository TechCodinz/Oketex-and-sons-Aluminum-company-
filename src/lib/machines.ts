// Machines & maintenance (Factory wing, 2026-10-25) — the maintenance
// technician's register: machines, service dates and a breakdown log.
// Starts EMPTY — the technician enters the real machines. Stored on this
// device (`oketex-machines`) until a sync endpoint exists.
export interface BreakdownEntry { id: string; ts: string; note: string; resolved: boolean }
export type MachineStatus = "Running" | "Down" | "In Service";
export interface Machine {
  id: string; name: string; type: string;
  lastService: string; nextServiceDue: string;
  status: MachineStatus; breakdowns: BreakdownEntry[];
}

const KEY = "oketex-machines";
export function getMachines(): Machine[] {
  try { const r = localStorage.getItem(KEY); return r ? (JSON.parse(r) as Machine[]) : []; } catch { return []; }
}
export function saveMachines(list: Machine[]) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } }
export function addMachine(input: { name: string; type: string; lastService: string; nextServiceDue: string }): Machine {
  const m: Machine = {
    id: `MCH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    name: input.name.trim(), type: input.type.trim(), lastService: input.lastService, nextServiceDue: input.nextServiceDue,
    status: "Running", breakdowns: [],
  };
  saveMachines([...getMachines(), m]);
  return m;
}
export function updateMachine(id: string, patch: Partial<Machine>): Machine[] {
  const list = getMachines().map(m => (m.id === id ? { ...m, ...patch } : m));
  saveMachines(list); return list;
}
export function addBreakdown(id: string, note: string): Machine[] {
  const entry: BreakdownEntry = { id: `BD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, ts: new Date().toISOString(), note: note.trim(), resolved: false };
  return updateMachine(id, { status: "Down", breakdowns: [...(getMachines().find(m => m.id === id)?.breakdowns || []), entry] });
}
export function resolveBreakdown(machineId: string, entryId: string): Machine[] {
  const m = getMachines().find(x => x.id === machineId);
  if (!m) return getMachines();
  const breakdowns = m.breakdowns.map(b => (b.id === entryId ? { ...b, resolved: true } : b));
  const stillDown = breakdowns.some(b => !b.resolved);
  return updateMachine(machineId, { breakdowns, status: stillDown ? "Down" : "Running" });
}
/** Service is overdue when the due date has passed (today compared as an
 *  ISO date string, the same shape the date inputs produce). */
export function serviceOverdue(m: Machine, todayISO: string): boolean {
  return !!m.nextServiceDue && m.nextServiceDue < todayISO;
}
