import { sendJson, methodNotAllowed, readRawBody, wrap } from "../../http.js";
import { dbQuery, isDbConfigured } from "../../db.js";
import { paystackEnabled, verifyPaystackSignature, applyPaymentEffect } from "../../paystack.js";
// Paystack webhook. The signature header is verified against the RAW body
// (HMAC-SHA512 with the secret key) — nothing is applied without it.
// Register this URL in the Paystack dashboard:
//   https://oketex-and-sons-aluminum-company.vercel.app/api/payments/webhook
export const config = { api: { bodyParser: false } };
export default wrap(async (req: any, res: any) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!paystackEnabled() || !isDbConfigured()) return sendJson(res, 200, { received: true, ignored: "payments not configured" });
  const raw = await readRawBody(req);
  const signature = req.headers["x-paystack-signature"] as string | undefined;
  if (!verifyPaystackSignature(raw, signature)) return sendJson(res, 401, { error: "Invalid signature" });
  let event: any = {};
  try { event = JSON.parse(raw.toString("utf8")); } catch { return sendJson(res, 400, { error: "Bad JSON" }); }
  if (event.event === "charge.success") {
    const ref = event.data?.reference;
    if (ref) {
      const rows = await dbQuery(`SELECT amount_kobo, status FROM payments WHERE reference = $1`, [ref]);
      // Only apply when the charged amount matches what we initialised.
      if (rows.length && Number(event.data.amount) === Number(rows[0].amount_kobo)) {
        await applyPaymentEffect(ref);
      }
    }
  }
  return sendJson(res, 200, { received: true });
});
