// Admin "Needs attention" aggregator (Admin-Routing pass) — a PURE function
// over the same lists the Admin tabs already load. One queue on the Admin
// overview: every piece of business waiting on admin, with the tab each row
// jumps to. Zero-count rows are dropped; an empty result means "all clear".
export interface AttentionRow { key: string; label: string; count: number; tab: string }
export interface AttentionInput {
  orders?: { status: string }[];
  quotes?: { status: string }[];
  bookings?: { status: string }[];
  verifyRequests?: { status: string }[];
  partners?: { status: string }[];
  jobs?: { status: string; bids?: unknown[] }[];
  snapRequests?: { status: string }[];
  leads?: { status: string }[];
}
const n = (list: { status: string }[] | undefined, ...statuses: string[]) =>
  (list || []).filter(x => statuses.includes(x.status)).length;

export function needsAttention(input: AttentionInput): AttentionRow[] {
  const rows: AttentionRow[] = [
    { key: "orders", label: "Orders awaiting action", count: n(input.orders, "pending"), tab: "orders" },
    { key: "quotes", label: "New quotes", count: n(input.quotes, "new"), tab: "quotes" },
    { key: "bookings", label: "Bookings to confirm", count: n(input.bookings, "pending"), tab: "bookings" },
    { key: "verify", label: "Verification requests", count: n(input.verifyRequests, "Requested"), tab: "verify" },
    { key: "partners", label: "Partner applications", count: n(input.partners, "pending"), tab: "partners" },
    { key: "jobs", label: "Jobs with bids awaiting award", count: (input.jobs || []).filter(j => j.status === "Open" && (j.bids?.length ?? 0) > 0).length, tab: "jobs" },
    { key: "snap", label: "Snap & Send requests", count: n(input.snapRequests, "Received", "Under Review", "Priced"), tab: "snap" },
    { key: "leads", label: "New partner leads", count: n(input.leads, "new"), tab: "partners" },
  ];
  return rows.filter(r => r.count > 0);
}
