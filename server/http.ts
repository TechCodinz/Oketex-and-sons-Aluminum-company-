// Tiny HTTP helpers for plain Vercel Node functions (req/res style).
// No framework — each /api file is one function.
export function sendJson(res: any, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}
export function methodNotAllowed(res: any, allowed: string[]) {
  res.setHeader("Allow", allowed.join(", "));
  return sendJson(res, 405, { error: "Method not allowed" });
}
/** Read the full raw request body as a Buffer (stream or pre-read shapes). */
export async function readRawBody(req: any): Promise<Buffer> {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body, "utf8");
  if (req.body && typeof req.body === "object") return Buffer.from(JSON.stringify(req.body), "utf8");
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
/** Read a JSON body tolerantly: pre-parsed req.body (object) wins, else stream. */
export async function readJson(req: any): Promise<any> {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  const raw = await readRawBody(req);
  if (!raw.length) return {};
  try { return JSON.parse(raw.toString("utf8")); } catch { return {}; }
}
export function parseCookies(req: any): Record<string, string> {
  const header = req.headers?.cookie || req.headers?.Cookie || "";
  const out: Record<string, string> = {};
  for (const part of String(header).split(";")) {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
/** Run a handler with a uniform 500 catcher. */
export function wrap(fn: (req: any, res: any) => Promise<void>) {
  return async (req: any, res: any) => {
    try { await fn(req, res); }
    catch (err: any) {
      console.error("[api]", req.url, err);
      if (!res.headersSent) sendJson(res, 500, { error: "Internal error", detail: String(err?.message || err) });
    }
  };
}
