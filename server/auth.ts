// Session auth: bcryptjs password hashing + jose JWT in an httpOnly cookie.
// Admin bootstrap: when ADMIN_EMAIL + ADMIN_PASSWORD env are set, a login
// with exactly those credentials yields an admin session even if no users
// row exists (the /auth/me endpoint reflects the same bootstrap identity).
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { parseCookies } from "./http";
import { dbQuery } from "./db";

export const SESSION_COOKIE = "oketex_session";
const SESSION_DAYS = 7;

export interface SessionUser {
  id: number | string; name: string; email: string; phone?: string;
  role: "customer" | "partner" | "admin"; partnerCode?: string | null;
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET || "";
  if (s.length < 16) throw new Error("AUTH_SECRET is not set (min 16 chars)");
  return new TextEncoder().encode(s);
}
export function authConfigured(): boolean { return (process.env.AUTH_SECRET || "").length >= 16; }

export async function hashPassword(pw: string): Promise<string> { return bcrypt.hash(pw, 10); }
export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  try { return await bcrypt.compare(pw, hash); } catch { return false; }
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, email: user.email, phone: user.phone || "", role: user.role, partnerCode: user.partnerCode ?? null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: payload.sub as string, name: String(payload.name || ""), email: String(payload.email || ""),
      phone: String(payload.phone || ""), role: (payload.role as SessionUser["role"]) || "customer",
      partnerCode: (payload.partnerCode as string | null) ?? null,
    };
  } catch { return null; }
}
export function sessionCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 3600}${secure}`;
}
export function clearCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function isAdminBootstrap(email?: string, password?: string): boolean {
  const e = process.env.ADMIN_EMAIL || ""; const p = process.env.ADMIN_PASSWORD || "";
  return !!e && !!p && !!email && !!password && email.toLowerCase() === e.toLowerCase() && password === p;
}
export function adminBootstrapUser(): SessionUser {
  return { id: "admin-env", name: "Oketex Admin", email: (process.env.ADMIN_EMAIL || "").toLowerCase(), role: "admin", partnerCode: null };
}

/** Resolve the session user for a request (cookie JWT), or null. */
export async function getSessionUser(req: any): Promise<SessionUser | null> {
  if (!authConfigured()) return null;
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  return verifySessionToken(token);
}
export async function isAdmin(req: any): Promise<boolean> {
  const u = await getSessionUser(req);
  return !!u && u.role === "admin";
}
/** Load a users row by email (null when absent / DB off). */
export async function findUserByEmail(email: string): Promise<any | null> {
  const rows = await dbQuery(`SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1`, [email]);
  return rows[0] || null;
}
export function publicUser(row: any): SessionUser & { createdAt?: string } {
  return {
    id: row.id, name: row.name || "", email: row.email, phone: row.phone || "",
    role: row.role || "customer", partnerCode: row.partner_code ?? null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
  };
}
