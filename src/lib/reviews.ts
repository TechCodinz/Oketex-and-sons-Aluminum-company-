// Partner reviews (Phase 6) — tied to real work: every review carries a
// refCode (a lead ID, order code or job code the customer was given).
// Averages/counts are computed ONLY from Published reviews; a partner with
// none shows "No reviews yet" — never a default rating. Local-first with
// the usual API sync when the Phase 5 backend is live.
import { apiFetch, probeApi } from "./api";

export type ReviewStatus = "Published" | "Hidden";
export interface Review {
  id: string; partnerCode: string; customerName: string; rating: number;
  text: string; refCode: string; status: ReviewStatus; createdAt: string;
}
const KEY = "oketex-reviews";
export function getReviews(): Review[] {
  try { const r = localStorage.getItem(KEY); return r ? (JSON.parse(r) as Review[]) : []; } catch { return []; }
}
export function saveReviews(list: Review[]) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } }
export function publishedReviews(): Review[] { return getReviews().filter(r => r.status === "Published"); }
export function reviewsForPartner(partnerCode: string): Review[] {
  return publishedReviews().filter(r => r.partnerCode.toUpperCase() === partnerCode.trim().toUpperCase())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
/** Pure summary: average rounded to ONE decimal (5,4,4 → 4.3). Count 0 → avg 0 (UI shows "No reviews yet"). */
export function summarizeReviews(list: Review[]): { avg: number; count: number } {
  const count = list.length;
  if (!count) return { avg: 0, count: 0 };
  const avg = Math.round((list.reduce((s, r) => s + (Number(r.rating) || 0), 0) / count) * 10) / 10;
  return { avg, count };
}
export function reviewSummaryFor(partnerCode: string): { avg: number; count: number } {
  return summarizeReviews(reviewsForPartner(partnerCode));
}
export function addReview(input: { partnerCode: string; customerName: string; rating: number; text: string; refCode: string }): Review {
  const review: Review = {
    id: `REV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    partnerCode: input.partnerCode.trim().toUpperCase(), customerName: input.customerName.trim(),
    rating: Math.min(5, Math.max(1, Math.round(input.rating || 0))), text: input.text.trim(),
    refCode: input.refCode.trim().toUpperCase(), status: "Published", createdAt: new Date().toISOString(),
  };
  saveReviews([review, ...getReviews()]);
  return review;
}
export function setReviewStatus(id: string, status: ReviewStatus) {
  saveReviews(getReviews().map(r => (r.id === id ? { ...r, status } : r)));
}
export function deleteReview(id: string) { saveReviews(getReviews().filter(r => r.id !== id)); }

// ---------------- API-first wrappers (demo fallback) ----------------
export async function addReviewAsync(input: { partnerCode: string; customerName: string; rating: number; text: string; refCode: string }): Promise<Review> {
  if (await probeApi()) {
    try {
      const { review } = await apiFetch<{ review: Review }>("/api/reviews", { method: "POST", body: JSON.stringify(input) });
      saveReviews([review, ...getReviews().filter(r => r.id !== review.id)]);
      return review;
    } catch { /* fall back to local */ }
  }
  return addReview(input);
}
/** Pull every Published review from the server into the local cache so
 *  directory cards and profiles show network-wide ratings when live. */
export async function syncReviewsAsync(): Promise<void> {
  if (!(await probeApi())) return;
  try {
    const { reviews } = await apiFetch<{ reviews: Review[] }>("/api/reviews?all=published");
    const byId = new Map(getReviews().map(r => [r.id, r]));
    for (const r of reviews) byId.set(r.id, r);
    saveReviews([...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  } catch { /* local stands */ }
}
export async function getReviewsAdminAsync(): Promise<Review[]> {
  if (await probeApi()) {
    try { const { reviews } = await apiFetch<{ reviews: Review[] }>("/api/reviews"); return reviews; }
    catch { /* fall through (needs admin session when live) */ }
  }
  return getReviews();
}
export async function setReviewStatusAsync(id: string, status: ReviewStatus): Promise<void> {
  setReviewStatus(id, status);
  if (await probeApi()) { try { await apiFetch("/api/reviews", { method: "PATCH", body: JSON.stringify({ id, status }) }); } catch { /* local stands */ } }
}
export async function deleteReviewAsync(id: string): Promise<void> {
  deleteReview(id);
  if (await probeApi()) { try { await apiFetch(`/api/reviews?id=${encodeURIComponent(id)}`, { method: "DELETE" }); } catch { /* local stands */ } }
}
/** ★★★★★ renderer helper — filled/empty stars for a rating or average. */
export function starsText(value: number): string {
  const full = Math.round(value);
  return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
}
