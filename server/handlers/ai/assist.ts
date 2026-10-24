import { sendJson, methodNotAllowed, readJson, wrap } from "../../http.js";
// AI Measurement Assist slot (Phase 6/7) — ENV-GATED and honest.
// Until BOTH AI_VISION_URL and AI_VISION_KEY are configured this returns
// {enabled:false} and the frontend panel says exactly that — no fake
// outputs, no dead buttons. When configured, the customer's photo
// (data URL) is forwarded to the configured vision service with the key
// as a Bearer token and the service's JSON is passed back untouched.
export function aiConfigured(): boolean {
  return !!(process.env.AI_VISION_URL || "").trim() && !!(process.env.AI_VISION_KEY || "").trim();
}
export default wrap(async (req: any, res: any) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!aiConfigured()) return sendJson(res, 200, { enabled: false });
  const b = await readJson(req);
  const image = String(b.imageDataUrl || b.image || "");
  if (!image) return sendJson(res, 400, { enabled: true, error: "Missing imageDataUrl" });
  try {
    const r = await fetch(String(process.env.AI_VISION_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_VISION_KEY}` },
      body: JSON.stringify({
        image,
        context: b.context || "building measurement",
        prompt: b.prompt || "Identify measurable building elements in this photo and estimate their dimensions in metres. Return JSON.",
      }),
    });
    const text = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { /* service returned non-JSON */ }
    if (!r.ok) return sendJson(res, 502, { enabled: true, error: `AI service responded ${r.status}`, raw: text.slice(0, 500) });
    return sendJson(res, 200, { enabled: true, result: parsed ?? text });
  } catch (e: any) {
    return sendJson(res, 502, { enabled: true, error: `AI service request failed: ${String(e?.message || e).slice(0, 200)}` });
  }
});
