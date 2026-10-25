// Server-side activity log writer (Staff System, 2026-10-25). Handlers call
// this for the actions they perform so the owner's Activity tab shows who
// did what even when the client forgets to log. Best-effort: a logging
// failure must never fail the action itself.
import { dbQuery } from "./db.js";

export async function logActivityServer(
  actor: { name?: string; role?: string } | null,
  action: string, refCode: string, detail: string,
): Promise<void> {
  try {
    const id = `ACT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    await dbQuery(
      `INSERT INTO activity_log (id, actor_name, actor_role, action, ref_code, detail) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, actor?.name || "", actor?.role || "", action, refCode || "", detail || ""],
    );
  } catch { /* the log is an audit aid, never a blocker */ }
}
