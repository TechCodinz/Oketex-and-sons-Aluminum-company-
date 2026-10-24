import { sendJson, wrap } from "../http.js";
import { isDbConfigured, dbPing } from "../db.js";
import { paystackEnabled } from "../paystack.js";
import { authConfigured } from "../auth.js";
import { aiConfigured } from "./ai/assist.js";
// Liveness probe the frontend uses to choose LIVE vs DEMO mode.
// ok:true always (the function running IS the health signal); db is true
// only when DATABASE_URL is set AND the database answers a SELECT 1.
// ai:true only when BOTH AI_VISION_URL and AI_VISION_KEY are configured.
export default wrap(async (_req: any, res: any) => {
  const db = isDbConfigured() ? await dbPing() : false;
  return sendJson(res, 200, { ok: true, db, auth: authConfigured(), payments: paystackEnabled(), ai: aiConfigured(), ts: new Date().toISOString() });
});
