import { sendJson, methodNotAllowed, wrap } from "../../server/http";
import { dbQuery, isDbConfigured } from "../../server/db";
import { paystackEnabled, verifyTransaction, applyPaymentEffect } from "../../server/paystack";
// GET ?reference= → asks Paystack directly (server-to-server); on a
// confirmed success with matching amount, applies the payment effect and
// returns the payment record. Source of truth alongside the webhook.
export default wrap(async (req: any, res: any) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  if (!paystackEnabled()) return sendJson(res, 200, { enabled: false });
  if (!isDbConfigured()) return sendJson(res, 503, { enabled: true, error: "Database not configured" });
  const reference = String(req.query?.reference || "");
  if (!reference) return sendJson(res, 400, { error: "Missing reference" });
  const rows = await dbQuery(`SELECT * FROM payments WHERE reference = $1`, [reference]);
  if (!rows.length) return sendJson(res, 404, { error: "Payment not found" });
  const stored = rows[0];
  if (stored.status === "paid") return sendJson(res, 200, { enabled: true, status: "paid", payment: stored });
  const data = await verifyTransaction(reference);
  if (data.status === "success" && Number(data.amount) === Number(stored.amount_kobo)) {
    const updated = await applyPaymentEffect(reference);
    return sendJson(res, 200, { enabled: true, status: "paid", payment: updated });
  }
  const status = data.status === "success" ? "amount_mismatch" : String(data.status || "pending");
  if (status !== "pending") await dbQuery(`UPDATE payments SET status = $1 WHERE reference = $2 AND status = 'pending'`, [status.slice(0, 30), reference]);
  return sendJson(res, 200, { enabled: true, status, payment: stored });
});
