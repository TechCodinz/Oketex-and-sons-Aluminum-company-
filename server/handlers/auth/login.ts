import { sendJson, methodNotAllowed, readJson, wrap } from "../../http.js";
import { isDbConfigured } from "../../db.js";
import { verifyPassword, signSession, sessionCookieHeader, publicUser, findUserByEmail, isAdminBootstrap, adminBootstrapUser } from "../../auth.js";
export default wrap(async (req: any, res: any) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const b = await readJson(req);
  const email = String(b.email || "").trim().toLowerCase();
  const password = String(b.password || "");
  // Admin bootstrap via env credentials — works even before any users exist.
  if (isAdminBootstrap(email, password)) {
    const user = adminBootstrapUser();
    const token = await signSession(user);
    res.setHeader("Set-Cookie", sessionCookieHeader(token));
    return sendJson(res, 200, { user });
  }
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured" });
  const row = await findUserByEmail(email);
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return sendJson(res, 401, { error: "Email or password is incorrect" });
  }
  // Staff System: a deactivated account loses access immediately — the
  // password may be right, but the login is refused until the owner
  // reactivates the account.
  if (row.active === false) {
    return sendJson(res, 403, { error: "This account has been deactivated — please contact the owner." });
  }
  const user = publicUser(row);
  const token = await signSession(user);
  res.setHeader("Set-Cookie", sessionCookieHeader(token));
  return sendJson(res, 200, { user });
});
