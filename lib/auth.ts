// Optional password gate. Set ACCESS_CODE on the host to stop strangers from
// spending your Anthropic credit. Leave it empty to make the site open.
import { timingSafeEqual } from "node:crypto";

export const ACCESS_CODE = (process.env.ACCESS_CODE || "").trim();

export function codeMatches(given: string | null | undefined) {
  if (!ACCESS_CODE) return true;
  const a = Buffer.from(String(given ?? "").trim());
  const b = Buffer.from(ACCESS_CODE);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Returns a 401 response if the request lacks the right access code, else null. */
export function requireAccess(req: Request): Response | null {
  if (codeMatches(req.headers.get("x-access-code"))) return null;
  return Response.json({ error: "Wrong or missing access code.", locked: true }, { status: 401 });
}
