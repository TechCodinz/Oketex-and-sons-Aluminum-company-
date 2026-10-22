// Phase 4 storage — Partner Network (pros & sellers marketplace).
// All state is local to this browser (localStorage), same pattern as
// lib/storage.ts and lib/proStorage.ts. In production this moves to a real
// backend (Neon) with Paystack settlement — see BUILD_NOTES.md Phase 4.
import type { LeadStatus, LeadType, OfferAudience, PartnerRole, PartnerStatus } from "@/data/partnerTerms";
import { commissionFor } from "@/data/partnerTerms";
import { getPartnerTerms } from "./settings";
import { uid } from "./proStorage";

export interface PartnerProduct { id: string; name: string; priceNgn: number; unit: string }
export interface Partner {
  code: string; role: PartnerRole; businessName: string; contactName: string;
  phone: string; email?: string; location: string; areas: string;
  trades: string[]; categories: string[];
  yearsExperience?: number; cacNumber?: string; bio: string;
  products: PartnerProduct[];
  status: PartnerStatus; verified: boolean; featured: boolean; sample?: boolean;
  createdAt: string;
}
export interface Lead {
  id: string; partnerCode: string; partnerName: string; type: LeadType;
  customerName: string; customerPhone: string; description: string;
  estValueNgn: number; commissionPct: number; commissionNgn: number;
  status: LeadStatus; createdAt: string;
}
export interface Offer {
  id: string; productName: string; priceNgn: number; unit: string; note: string;
  audience: OfferAudience; createdAt: string;
}

const PARTNER_KEY = "oketex-partners";
const LEAD_KEY = "oketex-leads";
const OFFER_KEY = "oketex-offers";

function read<T>(key: string): T[] { try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T[]) : []; } catch { return []; } }
function write(key: string, list: unknown[]) { try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* ignore */ } }

// ---------------- Sample partners (clearly labelled SAMPLE listings) ----------------
function samplePartners(): Partner[] {
  const now = new Date().toISOString();
  return [
    {
      code: "PRT-2026-SAMPLE1", role: "pro", businessName: "Adebayo Roofing Works", contactName: "Adebayo Ogunleye",
      phone: "+234 803 555 0101", location: "Lekki, Lagos", areas: "Lekki, Ajah, Ikeja, Lagos Mainland",
      trades: ["Roofer", "Carpenter"], categories: [], yearsExperience: 11, cacNumber: "",
      bio: "Sample listing — specialist longspan and stone-coated installation crew. Roof structure carpentry, sheet fixing, ridge and gutter work with photo reports on every job.",
      products: [], status: "approved", verified: true, featured: true, sample: true, createdAt: now,
    },
    {
      code: "PRT-2026-SAMPLE2", role: "pro", businessName: "Engr. Musa Structural Services", contactName: "Engr. Musa Abdullahi",
      phone: "+234 803 555 0102", location: "Gwarinpa, Abuja", areas: "Abuja FCT, Nasarawa, Niger",
      trades: ["Engineer", "Builder", "Surveyor"], categories: [], yearsExperience: 14, cacNumber: "",
      bio: "Sample listing — structural design, setting-out and site supervision for residential and commercial builds. COREN-registered practice (verify credentials on engagement).",
      products: [], status: "approved", verified: true, featured: false, sample: true, createdAt: now,
    },
    {
      code: "PRT-2026-SAMPLE3", role: "seller", businessName: "Ibafo Roofing Depot", contactName: "Mrs. F. Okonkwo",
      phone: "+234 803 555 0103", location: "Ibafo, Ogun State", areas: "Ibafo, Mowe, Berger, Lagos delivery daily",
      trades: [], categories: ["Roofing Materials", "General Building Materials"],
      bio: "Sample listing — wholesale and retail roofing sheets, stone-coated tiles and accessories with same-day cutting and delivery along the Lagos–Ibadan expressway.",
      products: [
        { id: uid(), name: "Longspan Aluminium Sheet 0.45mm", priceNgn: 9900, unit: "per metre" },
        { id: uid(), name: "Stone-Coated Classic Bond Tile", priceNgn: 7100, unit: "per tile" },
        { id: uid(), name: "Ridge Caps & Flashing", priceNgn: 4800, unit: "per metre" },
        { id: uid(), name: "Roofing Screws (bucket of 500)", priceNgn: 39500, unit: "per bucket" },
      ],
      status: "approved", verified: true, featured: true, sample: true, createdAt: now,
    },
    {
      code: "PRT-2026-SAMPLE4", role: "seller", businessName: "Lekki Tiles & Finishing Hub", contactName: "Chinedu E.",
      phone: "+234 803 555 0104", location: "Sangotedo, Lagos", areas: "Lekki–Ajah axis, delivery across Lagos",
      trades: [], categories: ["Tiles", "Paint"],
      bio: "Sample listing — floor and wall tiles, sanitary-finish paints and tiling consumables. Showroom samples available; tilers can be recommended on request.",
      products: [
        { id: uid(), name: "600×600 Glazed Floor Tile", priceNgn: 2600, unit: "per tile" },
        { id: uid(), name: "Tile Adhesive 20kg", priceNgn: 6800, unit: "per bag" },
        { id: uid(), name: "Emulsion Paint 20L", priceNgn: 48500, unit: "per drum" },
      ],
      status: "approved", verified: false, featured: false, sample: true, createdAt: now,
    },
    {
      code: "PRT-2026-SAMPLE5", role: "seller", businessName: "Ibadan Timber & Boards Market Ltd", contactName: "Alhaji R. Balogun",
      phone: "+234 803 555 0105", location: "Bodija, Ibadan", areas: "Ibadan, Oyo State, Osun delivery",
      trades: [], categories: ["Timber", "Cement & Blocks"],
      bio: "Sample listing — treated roofing timber, formwork boards, marine ply and sandcrete blocks ex-yard. Bulk rates for estate projects.",
      products: [
        { id: uid(), name: "Treated Timber 2×4 (3.6m)", priceNgn: 3200, unit: "per length" },
        { id: uid(), name: "Marine Plywood 18mm", priceNgn: 28500, unit: "per sheet" },
        { id: uid(), name: "Sandcrete Block 9in", priceNgn: 950, unit: "per block" },
        { id: uid(), name: "Formwork Board 1×12 (3.6m)", priceNgn: 5400, unit: "per length" },
      ],
      status: "approved", verified: false, featured: false, sample: true, createdAt: now,
    },
  ];
}

// ---------------- Partners ----------------
function readPartners(): Partner[] { return read<Partner>(PARTNER_KEY); }
export function getPartners(): Partner[] {
  const all = readPartners();
  if (!all.length) { const s = samplePartners(); write(PARTNER_KEY, s); return s; }
  return all;
}
export function savePartners(list: Partner[]) { write(PARTNER_KEY, list); }
export function addPartner(p: Partner) { const all = getPartners(); all.unshift(p); write(PARTNER_KEY, all); }
export function updatePartner(code: string, patch: Partial<Partner>) {
  write(PARTNER_KEY, getPartners().map(p => (p.code === code ? { ...p, ...patch } : p)));
}
export function findPartner(code: string): Partner | undefined {
  const s = code.trim().toUpperCase();
  return getPartners().find(p => p.code.toUpperCase() === s);
}
export function partnerCode() { return `PRT-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; }

/** WhatsApp-ready digits from a stored partner phone. */
export function waDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("234")) return d;
  if (d.startsWith("0")) return `234${d.slice(1)}`;
  return d;
}

// ---------------- Leads ----------------
export function getLeads(): Lead[] { return read<Lead>(LEAD_KEY); }
export function addLead(input: Omit<Lead, "id" | "commissionPct" | "commissionNgn" | "status" | "createdAt">): Lead {
  // Snapshot the EFFECTIVE commission % (admin Settings may override the
  // launch terms) at creation time — later term edits never rewrite leads.
  const { pct, commissionNgn } = commissionFor(input.estValueNgn, getPartnerTerms().referralCommissionPct);
  const lead: Lead = {
    ...input, id: `LED-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    commissionPct: pct, commissionNgn, status: "new", createdAt: new Date().toISOString(),
  };
  const all = getLeads(); all.unshift(lead); write(LEAD_KEY, all);
  return lead;
}
export function updateLeadStatus(id: string, status: LeadStatus) {
  write(LEAD_KEY, getLeads().map(l => (l.id === id ? { ...l, status } : l)));
}
export function deleteLead(id: string) { write(LEAD_KEY, getLeads().filter(l => l.id !== id)); }
export function leadsForPartner(code: string): Lead[] {
  return getLeads().filter(l => l.partnerCode.toUpperCase() === code.trim().toUpperCase());
}

// ---------------- Offers (supply pushes from Oketex admin) ----------------
export function getOffers(): Offer[] { return read<Offer>(OFFER_KEY); }
export function addOffer(o: Omit<Offer, "id" | "createdAt">) {
  const all = getOffers(); all.unshift({ ...o, id: `OFF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, createdAt: new Date().toISOString() }); write(OFFER_KEY, all);
}
export function deleteOffer(id: string) { write(OFFER_KEY, getOffers().filter(o => o.id !== id)); }
export function offersForRole(role: PartnerRole): Offer[] {
  const want = role === "pro" ? "pros" : "sellers";
  return getOffers().filter(o => o.audience === "all" || o.audience === want);
}
