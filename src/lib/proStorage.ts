// Phase 2 storage — Pro Workspace projects, customer bookings, Build A–Z journey.
// All state is local to this browser (localStorage), same pattern as lib/storage.ts.
import type { ProfileId, RoofStyle } from "./roofEngine";

// ---------------- Pro Workspace projects ----------------
export type TakeOffStyle = Extract<RoofStyle, "gable" | "hip" | "shed" | "flat">;
export interface TakeOffRow {
  id: string; section: string; length: number; width: number; pitch: number;
  style: TakeOffStyle; profile: ProfileId; overhang: number;
}
export interface MeasureRow {
  id: string; item: string; location: string;
  l: number; w: number; h: number; qty: number; unit: string; note: string;
}
export interface CheckItem { id: string; label: string; done: boolean }
export type ProTrade = "Roofer" | "Carpenter" | "Engineer" | "Builder";
export type ProStatus = "Measuring" | "Quoted" | "In Progress" | "Completed";
export interface ProProject {
  id: string; name: string; client: string; siteAddress: string; date: string;
  trade: ProTrade; status: ProStatus; notes: string; sample?: boolean;
  takeoff: TakeOffRow[]; measures: MeasureRow[]; checklist: CheckItem[];
  createdAt: string;
}
const PRO_KEY = "oketex-pro-projects";
export const uid = () => Math.random().toString(36).slice(2, 10);
export const DEFAULT_CHECKLIST = [
  "8m tape measure", "Laser distance measurer", "30m long tape", "Ladder / scaffold access",
  "Cordless drill & bits", "Roofing sheets (per take-off)", "Ridge caps & flashing",
  "Self-drilling screws (buckets)", "Timber purlins", "Safety harness & gloves",
];
export function defaultChecklist(): CheckItem[] { return DEFAULT_CHECKLIST.map(label => ({ id: uid(), label, done: false })); }
export function emptyTakeOffRow(): TakeOffRow { return { id: uid(), section: "New section", length: 10, width: 8, pitch: 25, style: "gable", profile: "longspan-045", overhang: 0.6 }; }
export function emptyMeasureRow(): MeasureRow { return { id: uid(), item: "", location: "", l: 0, w: 0, h: 0, qty: 1, unit: "m²", note: "" }; }
export function sampleProject(): ProProject {
  return {
    id: uid(), name: "Sample — 4-Bedroom Duplex, Ibafo", client: "Sample Client", siteAddress: "Ibafo, Ogun State",
    date: new Date().toISOString().slice(0, 10), trade: "Roofer", status: "Measuring", sample: true,
    notes: "SAMPLE PROJECT — delete or duplicate it to start your own. Main roof measured from ground + ladder at eaves. Boys' quarters to be re-sheeted, timber sound. Client wants Charcoal longspan.",
    takeoff: [
      { id: uid(), section: "Main Roof", length: 11, width: 9.2, pitch: 28, style: "gable", profile: "longspan-045", overhang: 0.6 },
      { id: uid(), section: "Boys' Quarters", length: 6, width: 5, pitch: 25, style: "gable", profile: "corrugated", overhang: 0.5 },
    ],
    measures: [
      { id: uid(), item: "Living room window", location: "Front elevation", l: 1.2, w: 1.5, h: 0, qty: 2, unit: "pcs", note: "Casement, charcoal" },
      { id: uid(), item: "Main entrance door", location: "Front porch", l: 1.0, w: 2.1, h: 0, qty: 1, unit: "pcs", note: "Confirm swing direction" },
      { id: uid(), item: "Concrete floor slab", location: "Boys' quarters", l: 6, w: 5, h: 0.15, qty: 1, unit: "m³", note: "150mm oversite" },
    ],
    checklist: defaultChecklist().map((c, i) => ({ ...c, done: i < 3 })),
    createdAt: new Date().toISOString(),
  };
}
function readProjects(): ProProject[] { try { const r = localStorage.getItem(PRO_KEY); return r ? (JSON.parse(r) as ProProject[]) : []; } catch { return []; } }
export function getProProjects(): ProProject[] {
  const all = readProjects();
  if (!all.length) { const s = [sampleProject()]; try { localStorage.setItem(PRO_KEY, JSON.stringify(s)); } catch { /* ignore */ } return s; }
  return all;
}
export function saveProProjects(list: ProProject[]) { try { localStorage.setItem(PRO_KEY, JSON.stringify(list)); } catch { /* ignore */ } }

// ---------------- Bookings ----------------
export type BookingStatus = "pending" | "confirmed" | "scheduled" | "completed" | "cancelled";
export const BOOKING_STATUSES: BookingStatus[] = ["pending", "confirmed", "scheduled", "completed", "cancelled"];
export interface LocalBooking {
  code: string; service: string; serviceLabel: string; date: string; slot: string;
  name: string; phone: string; address: string; lgaState: string; buildingType: string;
  stage: string; notes?: string; status: BookingStatus; createdAt: string;
}
const BOOK_KEY = "oketex-bookings";
function readBookings(): LocalBooking[] { try { const r = localStorage.getItem(BOOK_KEY); return r ? (JSON.parse(r) as LocalBooking[]) : []; } catch { return []; } }
export const getBookings = () => readBookings();
export function saveBooking(b: LocalBooking) { const all = readBookings(); all.unshift(b); try { localStorage.setItem(BOOK_KEY, JSON.stringify(all)); } catch { /* ignore */ } }
export function updateBookingStatus(code: string, status: BookingStatus) {
  const all = readBookings().map(b => (b.code === code ? { ...b, status } : b));
  try { localStorage.setItem(BOOK_KEY, JSON.stringify(all)); } catch { /* ignore */ }
}
export function bookingCode() { return `BK-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; }
export function findBooking(q: string) {
  const s = q.trim().toLowerCase(); if (!s) return [];
  return readBookings().filter(b => b.code.toLowerCase() === s || b.phone.replace(/\D/g, "").endsWith(s.replace(/\D/g, "")));
}
export const BOOKING_SERVICES = [
  { id: "measurement", label: "Free Site Measurement" },
  { id: "installation", label: "Roof Installation" },
  { id: "re-roofing", label: "Re-Roofing & Leak Repair" },
  { id: "windows-doors-survey", label: "Windows & Doors Survey" },
  { id: "cladding-survey", label: "Cladding & Facade Survey" },
  { id: "consultation", label: "General Building Consultation" },
  { id: "delivery", label: "Materials Delivery" },
] as const;

// ---------------- Build A–Z journey ----------------
const JOURNEY_KEY = "oketex-journey";
export function getJourney(): Record<number, boolean> { try { const r = localStorage.getItem(JOURNEY_KEY); return r ? (JSON.parse(r) as Record<number, boolean>) : {}; } catch { return {}; } }
export function saveJourney(j: Record<number, boolean>) { try { localStorage.setItem(JOURNEY_KEY, JSON.stringify(j)); } catch { /* ignore */ } }
