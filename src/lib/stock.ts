// Coil stock (Factory wing, 2026-10-25) — the warehouse keeper's inventory:
// gauge + colour + kilograms on hand, with an editable low-stock threshold.
// Starts EMPTY — the warehouse enters real coils; nothing is invented.
// Stored on this device (`oketex-stock`) until a stock sync endpoint exists.
export interface CoilStock { id: string; gauge: string; colour: string; kg: number }
export interface StockDoc { items: CoilStock[]; thresholdKg: number }

const KEY = "oketex-stock";
const DEFAULT_DOC: StockDoc = { items: [], thresholdKg: 500 };
export function getStockDoc(): StockDoc {
  try {
    const r = localStorage.getItem(KEY);
    if (!r) return { ...DEFAULT_DOC };
    const d = JSON.parse(r) as StockDoc;
    return { items: Array.isArray(d.items) ? d.items : [], thresholdKg: Number(d.thresholdKg) || DEFAULT_DOC.thresholdKg };
  } catch { return { ...DEFAULT_DOC }; }
}
export function saveStockDoc(doc: StockDoc) { try { localStorage.setItem(KEY, JSON.stringify(doc)); } catch { /* ignore */ } }
export function addCoil(input: { gauge: string; colour: string; kg: number }): StockDoc {
  const doc = getStockDoc();
  doc.items = [...doc.items, { id: `COIL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, gauge: input.gauge.trim(), colour: input.colour.trim(), kg: Math.max(0, Math.round(input.kg)) }];
  saveStockDoc(doc); return doc;
}
export function updateCoilKg(id: string, kg: number): StockDoc {
  const doc = getStockDoc();
  doc.items = doc.items.map(c => (c.id === id ? { ...c, kg: Math.max(0, Math.round(kg)) } : c));
  saveStockDoc(doc); return doc;
}
export function removeCoil(id: string): StockDoc {
  const doc = getStockDoc();
  doc.items = doc.items.filter(c => c.id !== id);
  saveStockDoc(doc); return doc;
}
export function setStockThreshold(kg: number): StockDoc {
  const doc = getStockDoc();
  doc.thresholdKg = Math.max(0, Math.round(kg));
  saveStockDoc(doc); return doc;
}
/** A coil is low when its kilograms on hand fall below the threshold —
 *  the simple, honest flag the briefing and Stock page both use. */
export function lowStockFlags(doc: StockDoc): CoilStock[] {
  return (doc.items || []).filter(c => c.kg < doc.thresholdKg);
}
export function totalKgFor(doc: StockDoc, gauge: string, colour: string): number {
  return (doc.items || [])
    .filter(c => c.gauge.trim().toLowerCase() === gauge.trim().toLowerCase() && c.colour.trim().toLowerCase() === colour.trim().toLowerCase())
    .reduce((s, c) => s + c.kg, 0);
}
