import { codeMatches } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({ code: "" }));
  // Small delay makes guessing slow.
  await new Promise((r) => setTimeout(r, 400));
  return codeMatches(code) ? Response.json({ ok: true }) : Response.json({ ok: false, error: "That code didn't work." }, { status: 401 });
}
