import { sendJson, methodNotAllowed, readJson, wrap } from "../../http";
import { dbQuery, isDbConfigured } from "../../db";
import { paystackEnabled, initializeTransaction, genReference } from "../../paystack";
// POST {email, amountNgn, purpose, refId, callbackUrl?}
// Fail-closed: no PAYSTACK_SECRET_KEY → {enabled:false} and nothing stored.
// With a key: creates a pending payment row, initialises with Paystack, and
// returns the hosted checkout URL for redirect.
const PURPOSES = ["partner_verification", "partner_featured", "order", "booking_deposit", "generic"];
export default wrap(async (req: any, res: any) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!paystackEnabled()) return sendJson(res, 200, { enabled: false, reason: "PAYSTACK_SECRET_KEY is not set" });
  if (!isDbConfigured()) return sendJson(res, 503, { enabled: true, error: "Database not configured" });
  const b = await readJson(req);
  const email = String(b.email || "").trim();
  const amountNgn = Number(b.amountNgn) || 0;
  const purpose = PURPOSES.includes(b.purpose) ? b.purpose : "generic";
  const refId = b.refId ? String(b.refId) : null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: "A valid email is required for Paystack receipts" });
  if (amountNgn < 50) return sendJson(res, 400, { error: "Amount must be at least ₦50" });
  const reference = genReference("OKX");
  const amountKobo = Math.round(amountNgn * 100);
  const origin = (req.headers.origin as string) || (req.headers.referer ? new URL(req.headers.referer as string).origin : "");
  const callbackUrl = b.callbackUrl || (origin ? `${origin}/payment/return?reference=${reference}` : undefined);
  await dbQuery(
    `INSERT INTO payments (reference, purpose, ref_id, email, amount_kobo, status) VALUES ($1,$2,$3,$4,$5,'pending')`,
    [reference, purpose, refId, email, amountKobo],
  );
  try {
    const data = await initializeTransaction({ email, amountKobo, reference, callbackUrl, metadata: { purpose, refId } });
    return sendJson(res, 200, { enabled: true, authorizationUrl: data.authorization_url, reference });
  } catch (err: any) {
    await dbQuery(`UPDATE payments SET status = 'failed' WHERE reference = $1`, [reference]);
    return sendJson(res, 502, { enabled: true, error: String(err?.message || err) });
  }
});
