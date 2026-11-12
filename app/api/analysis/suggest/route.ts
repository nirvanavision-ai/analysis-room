import { InputError, suggestPanel } from "@/lib/analysis/engine";
import { A_SEATS } from "@/lib/analysis/seats";
import { requireAccess } from "@/lib/auth";
import { explainError } from "@/lib/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const denied = requireAccess(req);
  if (denied) return denied;
  try {
    return Response.json(await suggestPanel(await req.json(), A_SEATS));
  } catch (e) {
    if (e instanceof InputError) return Response.json({ error: e.message }, { status: 400 });
    return Response.json({ error: explainError(e).message }, { status: 502 });
  }
}
