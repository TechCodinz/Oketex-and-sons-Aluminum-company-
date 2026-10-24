import { sendJson, methodNotAllowed, readJson, wrap } from "../../http.js";
import { isDbConfigured } from "../../db.js";
import { isAdmin } from "../../auth.js";
import { loadSnap, saveSnap, pushTimeline, cleanAssessment, snapAssessmentTotal, ngn } from "../../snapStore.js";
// POST /api/snap-requests/assess (admin) — price a Snap & Send request:
// items + workmanship + transport + dispatch → total computed SERVER-side
// (mirrors assessmentTotal in src/lib/snapRequests.ts), status → Priced.
export default wrap(async (req: any, res: any) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (!(await isAdmin(req))) return sendJson(res, 401, { error: "Admin session required" });
  const b = await readJson(req);
  const code = String(b.code || "").trim().toUpperCase();
  if (!code) return sendJson(res, 400, { error: "Missing request code" });
  let rec = await loadSnap(code);
  if (!rec) return sendJson(res, 404, { error: "Request not found" });
  if (["Declined", "Completed"].includes(rec.status)) return sendJson(res, 400, { error: `A ${rec.status.toLowerCase()} request cannot be priced` });
  const assessment = cleanAssessment(b.assessment);
  const total = snapAssessmentTotal(assessment);
  rec = pushTimeline({ ...rec, assessment, totalNgn: total, status: "Priced" }, "admin", `Oketex priced this job — total ${ngn(total)}. Approve to proceed.`);
  return sendJson(res, 200, { request: await saveSnap(rec) });
});
