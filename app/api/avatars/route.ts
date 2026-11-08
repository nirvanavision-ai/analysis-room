import fs from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const map: Record<string, string> = {};
  try {
    for (const f of await fs.readdir(path.join(process.cwd(), "public", "avatars"))) {
      const m = f.match(/^([\w-]+)\.(png|jpe?g|webp|svg)$/i);
      if (m) map[m[1]] = `/avatars/${f}`;
    }
  } catch {}
  return Response.json(map);
}
