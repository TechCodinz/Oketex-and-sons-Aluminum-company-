// TEMPORARY DIAGNOSTIC (revert after reading the error): dynamic-imports the
// real router inside a try/catch and returns any load/call error as JSON,
// because this project has no build/runtime log access from the sandbox.
export default async function handler(req: any, res: any) {
  try {
    const m = await import("../server/router");
    return await m.default(req, res);
  } catch (e: any) {
    res.status(200).json({ diagnostic: String((e && (e.stack || e.message)) || e).slice(0, 1800) });
  }
}
