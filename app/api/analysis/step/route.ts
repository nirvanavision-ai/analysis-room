// One step of an analysis = one Claude call. The browser calls this repeatedly
// (see lib/analysis/runner.ts), so no single request runs long enough to time out.
import { cleanSituation, InputError, stepAssessment, stepCrossExam, stepPatterns, stepPlaybook, stepRead } from "@/lib/analysis/engine";
import { requireAccess } from "@/lib/auth";
import { explainError } from "@/lib/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // the most Vercel's free (Hobby) plan allows

const MAX_BODY = 400_000; // characters

export async function POST(req: Request) {
  const denied = requireAccess(req);
  if (denied) return denied;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) throw new InputError("That's too much text. Shorten the details and try again.");
    const body = JSON.parse(raw);
    const sit = cleanSituation(body.situation);
    switch (body.step) {
      case "read":
        return Response.json(await stepRead(sit, body.seat));
      case "patterns":
        return Response.json(await stepPatterns(sit, body.reads));
      case "crossexam":
        return Response.json(await stepCrossExam(sit, body.seat, body.reads, body.patterns));
      case "assessment":
        return Response.json(await stepAssessment(sit, body.seat, body.reads, body.crosses));
      case "playbook":
        return Response.json(await stepPlaybook(sit, body.patterns, body.assessments));
      default:
        throw new InputError("Unknown step.");
    }
  } catch (e) {
    const bad = e instanceof InputError || e instanceof SyntaxError;
    if (bad) return Response.json({ error: (e as Error).message || "Something went wrong." }, { status: 400 });
    console.error("analysis step failed:", e);
    const { message, fatal } = explainError(e);
    return Response.json({ error: message, fatal }, { status: 502 });
  }
}
