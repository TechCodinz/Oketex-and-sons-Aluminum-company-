import { sendJson, methodNotAllowed, readJson, wrap } from "../http.js";
import { dbQuery, isDbConfigured } from "../db.js";
import { productionFromRow } from "../records.js";
import { requireRole, roleErrorBody, getSessionUser, isStaffRole, type StaffRole } from "../auth.js";
import { logActivityServer } from "../activityLog.js";
// Production pipeline (Factory wing, 2026-10-25) — mirrors src/lib/production.ts.
// The full job card lives in `data` jsonb; the state machine is enforced
// HERE (the client checks are a courtesy):
//   Queued → In Production → Produced → QC Passed → Bundled → Dispatched → Delivered
//   Produced --QC fail--> In Production (the QC note rides along)
// Skipping a stage (e.g. Produced → Bundled) is rejected with 400.
// GET → any staff session (each role's page filters its own queue).
// POST → create (owner / production_manager / operations / sales — sales
//   confirms orders at the desk; auto-create from a confirmed order is
//   idempotent on orderCode while a job for it is still open).
// PATCH {code, action} → assign | schedule | start | finish | qc | bundle |
//   dispatch | deliver, each gated to its floor roles; operators act only
//   on jobs assigned to them (matched by staff name).
export const PRODUCTION_STATUSES = ["Queued", "In Production", "Produced", "QC Passed", "QC Failed", "Bundled", "Dispatched", "Delivered"];

function cleanCuttingList(v: any): { lengthM: number; qty: number }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((l: any) => ({ lengthM: Math.max(0, Number(l?.lengthM) || 0), qty: Math.max(0, Math.round(Number(l?.qty) || 0)) }))
    .filter((l: { lengthM: number; qty: number }) => l.lengthM > 0 && l.qty > 0);
}
export function cuttingTotal(lines: { lengthM: number; qty: number }[]): number {
  return Math.round(lines.reduce((s, l) => s + l.lengthM * l.qty, 0) * 100) / 100;
}
async function loadJob(code: string): Promise<any | null> {
  const rows = await dbQuery(`SELECT * FROM production_jobs WHERE code = $1`, [code]);
  return rows.length ? productionFromRow(rows[0]) : null;
}
async function saveJob(rec: any): Promise<any> {
  const now = new Date().toISOString();
  const next = { ...rec, updatedAt: now };
  const rows = await dbQuery(
    `UPDATE production_jobs SET status = $1, operator_name = $2, customer_name = $3, order_code = $4, data = $5::jsonb, updated_at = now() WHERE code = $6 RETURNING *`,
    [next.status, next.operatorName || "", next.customerName || "", next.orderCode || "", JSON.stringify(next), next.code],
  );
  return productionFromRow(rows[0]);
}

export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });

  if (req.method === "GET") {
    const user = await getSessionUser(req);
    if (!user || !isStaffRole(user.role)) return sendJson(res, 401, { error: "Staff session required" });
    const rows = await dbQuery(`SELECT * FROM production_jobs ORDER BY created_at DESC LIMIT 500`);
    return sendJson(res, 200, { jobs: rows.map(productionFromRow) });
  }

  if (req.method === "POST") {
    const gate = await requireRole(req, ["admin", "production_manager", "operations", "sales"]);
    if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));
    const b = await readJson(req);
    const orderCode = String(b.orderCode || "").trim().toUpperCase();
    // Idempotent auto-create: one OPEN job per order.
    if (orderCode) {
      const open = await dbQuery(`SELECT * FROM production_jobs WHERE order_code = $1 AND status <> 'Delivered' ORDER BY created_at ASC LIMIT 1`, [orderCode]);
      if (open.length) return sendJson(res, 200, { job: productionFromRow(open[0]), existing: true });
    }
    const now = new Date().toISOString();
    const cuttingList = cleanCuttingList(b.cuttingList);
    const code = String(b.code || "").trim().toUpperCase() || `PRD-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const rec: any = {
      code, orderCode, customerName: String(b.customerName || ""), customerPhone: String(b.customerPhone || ""),
      address: String(b.address || ""),
      product: {
        name: String(b.product?.name || ""), gauge: String(b.product?.gauge || ""), colour: String(b.product?.colour || ""),
      },
      cuttingList, totalMetres: cuttingTotal(cuttingList),
      status: "Queued", operatorName: String(b.operatorName || ""),
      metresProduced: 0, scrapNote: "", scheduleNote: String(b.scheduleNote || ""),
      checklist: Array.isArray(b.checklist) ? b.checklist.map((x: any) => String(x)) : [],
      qc: null, qcHistory: [], createdAt: now, updatedAt: now,
    };
    const rows = await dbQuery(
      `INSERT INTO production_jobs (code, order_code, status, operator_name, customer_name, data) VALUES ($1,$2,'Queued',$3,$4,$5::jsonb) RETURNING *`,
      [rec.code, rec.orderCode, rec.operatorName, rec.customerName, JSON.stringify(rec)],
    );
    await logActivityServer(gate.user, "production_created", rec.code, `Production job for order ${rec.orderCode || "—"} (${rec.totalMetres}m)`);
    return sendJson(res, 201, { job: productionFromRow(rows[0]) });
  }

  if (req.method === "PATCH") {
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    const action = String(b.action || "");
    if (!code || !action) return sendJson(res, 400, { error: "Missing job code or action" });
    let rec = await loadJob(code);
    if (!rec) return sendJson(res, 404, { error: "Production job not found" });

    // Per-action role gates. `own` marks actions an operator may only run
    // on a job assigned to them (matched by staff display name).
    const gates: Record<string, { roles: StaffRole[]; own?: boolean }> = {
      assign: { roles: ["admin", "production_manager", "operations"] },
      schedule: { roles: ["admin", "production_manager"] },
      start: { roles: ["admin", "production_manager", "operator"], own: true },
      finish: { roles: ["admin", "production_manager", "operator"], own: true },
      qc: { roles: ["admin", "qc"] },
      bundle: { roles: ["admin", "warehouse", "store"] },
      dispatch: { roles: ["admin", "dispatch", "operations"] },
      deliver: { roles: ["admin", "dispatch", "operations"] },
      checklist: { roles: ["admin", "dispatch", "warehouse"] },
    };
    const gate = gates[action];
    if (!gate) return sendJson(res, 400, { error: "Unknown action" });
    const auth = await requireRole(req, gate.roles);
    if ("error" in auth) return sendJson(res, auth.error, roleErrorBody(auth.error));
    const user = auth.user;
    if (gate.own && user.role === "operator" && (rec.operatorName || "").trim().toLowerCase() !== (user.name || "").trim().toLowerCase()) {
      return sendJson(res, 403, { error: "This job is assigned to another operator" });
    }
    const bad = (msg: string) => sendJson(res, 400, { error: msg });

    if (action === "assign") {
      rec = { ...rec, operatorName: String(b.operatorName || "").trim() };
    } else if (action === "schedule") {
      rec = { ...rec, scheduleNote: String(b.scheduleNote || "") };
    } else if (action === "checklist") {
      rec = { ...rec, checklist: Array.isArray(b.checklist) ? b.checklist.map((x: any) => String(x)) : rec.checklist };
    } else if (action === "start") {
      if (rec.status !== "Queued") return bad(`Only a Queued job can be started (this one is ${rec.status})`);
      rec = { ...rec, status: "In Production" };
    } else if (action === "finish") {
      if (rec.status !== "In Production") return bad(`Only an In Production job can be finished (this one is ${rec.status})`);
      rec = { ...rec, status: "Produced", metresProduced: Math.max(0, Number(b.metresProduced) || 0), scrapNote: String(b.scrapNote || "") };
    } else if (action === "qc") {
      if (rec.status !== "Produced") return bad(`Only a Produced job can be inspected (this one is ${rec.status}) — QC cannot be skipped or repeated out of turn`);
      const passIt = b.result === "pass";
      const entry = { by: user.name || user.email, at: new Date().toISOString(), result: passIt ? "pass" : "fail", notes: String(b.notes || "") };
      rec = {
        ...rec, qc: entry, qcHistory: [...(rec.qcHistory || []), entry],
        status: passIt ? "QC Passed" : "In Production",
      };
      await logActivityServer(user, passIt ? "production_qc_pass" : "production_qc_fail", rec.code, entry.notes || (passIt ? "QC passed" : "QC failed — returned to production"));
    } else if (action === "bundle") {
      if (rec.status !== "QC Passed") return bad(`Only a QC Passed job can be bundled (this one is ${rec.status})`);
      rec = { ...rec, status: "Bundled" };
    } else if (action === "dispatch") {
      if (rec.status !== "Bundled") return bad(`Only a Bundled job can be dispatched (this one is ${rec.status})`);
      rec = { ...rec, status: "Dispatched" };
      await logActivityServer(user, "production_dispatched", rec.code, `Dispatched to ${rec.address || "customer address on order"}`);
    } else if (action === "deliver") {
      if (rec.status !== "Dispatched") return bad(`Only a Dispatched job can be marked delivered (this one is ${rec.status})`);
      rec = { ...rec, status: "Delivered" };
    }
    return sendJson(res, 200, { job: await saveJob(rec) });
  }
  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
});
