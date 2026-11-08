import { MOCK, MODEL } from "@/lib/claude";
import { ACCESS_CODE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ demo: MOCK, model: MODEL, locked: Boolean(ACCESS_CODE) });
}
