import { sendJson, wrap } from "../http";
import { isDbConfigured, dbPing } from "../db";
import { paystackEnabled } from "../paystack";
import { authConfigured } from "../auth";
// Liveness probe the frontend uses to choose LIVE vs DEMO mode.
// ok:true always (the function running IS the health signal); db is true
// only when DATABASE_URL is set AND the database answers a SELECT 1.
export default wrap(async (_req: any, res: any) => {
  const db = isDbConfigured() ? await dbPing() : false;
  return sendJson(res, 200, { ok: true, db, auth: authConfigured(), payments: paystackEnabled(), ts: new Date().toISOString() });
});
