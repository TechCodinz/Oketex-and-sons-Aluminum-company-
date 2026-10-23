import { sendJson, methodNotAllowed, readJson, wrap } from "../../server/http";
import { dbQuery, isDbConfigured } from "../../server/db";
import { hashPassword, signSession, sessionCookieHeader, publicUser, findUserByEmail } from "../../server/auth";
export default wrap(async (req: any, res: any) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured" });
  const b = await readJson(req);
  const name = String(b.name || "").trim();
  const email = String(b.email || "").trim().toLowerCase();
  const phone = String(b.phone || "").trim();
  const password = String(b.password || "");
  const partnerCode = b.partnerCode ? String(b.partnerCode).trim().toUpperCase() : null;
  if (name.length < 2) return sendJson(res, 400, { error: "Enter your full name" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: "Enter a valid email" });
  if (password.length < 8) return sendJson(res, 400, { error: "Password must be at least 8 characters" });
  if (await findUserByEmail(email)) return sendJson(res, 409, { error: "An account with this email already exists — sign in instead" });
  const role = partnerCode ? "partner" : "customer";
  const hash = await hashPassword(password);
  const rows = await dbQuery(
    `INSERT INTO users (name, email, phone, password_hash, role, partner_code) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name, email, phone, hash, role, partnerCode],
  );
  const user = publicUser(rows[0]);
  const token = await signSession(user);
  res.setHeader("Set-Cookie", sessionCookieHeader(token));
  return sendJson(res, 201, { user });
});
