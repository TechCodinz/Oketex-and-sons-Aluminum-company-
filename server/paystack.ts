// Paystack server integration — FAIL-CLOSED: without PAYSTACK_SECRET_KEY
// every entry point reports {enabled:false} and nothing is charged or
// marked paid. Money effects are applied ONLY from the verify endpoint
// (server-to-server check) or the webhook after its HMAC signature check.
import crypto from "node:crypto";
import { dbQuery } from "./db";

export function paystackEnabled(): boolean { return !!(process.env.PAYSTACK_SECRET_KEY || ""); }
function secretKey(): string { return process.env.PAYSTACK_SECRET_KEY || ""; }
const API = "https://api.paystack.co";

export function genReference(prefix = "OKX"): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Pure + unit-testable: x-paystack-signature must equal the hex HMAC-SHA512
 *  of the RAW request body keyed with the Paystack secret. */
export function verifyPaystackSignature(rawBody: Buffer | string, signature: string | undefined, secret?: string): boolean {
  const key = secret ?? secretKey();
  if (!key || !signature) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), "utf8");
  const expected = crypto.createHmac("sha512", key).update(body).digest("hex");
  const a = Buffer.from(expected, "utf8"); const b = Buffer.from(String(signature), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function initializeTransaction(input: { email: string; amountKobo: number; reference: string; callbackUrl?: string; metadata?: Record<string, unknown> }): Promise<any> {
  const res = await fetch(`${API}/transaction/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email, amount: Math.round(input.amountKobo), reference: input.reference,
      currency: "NGN", callback_url: input.callbackUrl,
      metadata: input.metadata || {},
    }),
  });
  const data: any = await res.json().catch(() => null);
  if (!res.ok || !data?.status) throw new Error(data?.message || `Paystack initialize failed (${res.status})`);
  return data.data; // { authorization_url, access_code, reference }
}

export async function verifyTransaction(reference: string): Promise<any> {
  const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  });
  const data: any = await res.json().catch(() => null);
  if (!res.ok || !data?.status) throw new Error(data?.message || `Paystack verify failed (${res.status})`);
  return data.data; // { status: 'success'|..., amount, paid_at, ... }
}

/** Apply the business effect of a CONFIRMED payment. Idempotent: a payment
 *  row already marked paid is left untouched. Returns the payment row. */
export async function applyPaymentEffect(reference: string): Promise<any | null> {
  const rows = await dbQuery(`SELECT * FROM payments WHERE reference = $1`, [reference]);
  const pay = rows[0];
  if (!pay) return null;
  if (pay.status === "paid") return pay;
  await dbQuery(`UPDATE payments SET status = 'paid', paid_at = now() WHERE reference = $1`, [reference]);
  const refId = pay.ref_id as string | null;
  if (refId) {
    if (pay.purpose === "partner_verification") {
      await dbQuery(`UPDATE partners SET verified = true WHERE code = $1`, [refId]);
    } else if (pay.purpose === "partner_featured") {
      await dbQuery(`UPDATE partners SET featured = true, featured_until = now() + interval '30 days' WHERE code = $1`, [refId]);
    } else if (pay.purpose === "order") {
      await dbQuery(`UPDATE orders SET paid = true WHERE code = $1`, [refId]);
    } else if (pay.purpose === "booking_deposit") {
      await dbQuery(`UPDATE bookings SET deposit_paid = true WHERE code = $1`, [refId]);
    }
  }
  return { ...pay, status: "paid" };
}
