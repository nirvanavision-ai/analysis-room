// Thin wrapper around the Claude API with structured (Zod) outputs.
import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export const MODEL = process.env.ROAST_MODEL || "claude-opus-5-5";
const EFFORT = (process.env.ROAST_EFFORT || "medium") as "low" | "medium" | "high" | "xhigh" | "max";
export const MOCK = process.env.ROAST_MOCK === "1" || !process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ maxRetries: 3 });
  return client;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function ask<T>(system: string, user: string, schema: z.ZodType<T>): Promise<T> {
  const res = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: EFFORT, format: zodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") throw new Error("The model declined this request.");
  if (!res.parsed_output) throw new Error(`No structured output (stop_reason: ${res.stop_reason})`);
  return res.parsed_output as T;
}

/**
 * Turns an Anthropic API failure into one plain sentence. `fatal` means every
 * other call will fail the same way (no credit, bad key), so the analysis should stop.
 */
export function explainError(e: unknown): { message: string; fatal: boolean } {
  const raw = (e as Error)?.message || "Something went wrong.";
  const status = e instanceof APIError ? e.status : undefined;
  const text = raw.toLowerCase();
  if (text.includes("credit balance is too low"))
    return { fatal: true, message: "Your Anthropic account is out of credit. Add credit at console.anthropic.com (Settings → Billing), then try again." };
  if (status === 401 || text.includes("invalid x-api-key") || text.includes("authentication"))
    return { fatal: true, message: "The Anthropic API key isn't working (wrong or expired). Put a new key in Vercel's ANTHROPIC_API_KEY setting and redeploy." };
  if (status === 403)
    return { fatal: true, message: "This Anthropic API key isn't allowed to do this. Check the key's organization and permissions in console.anthropic.com." };
  if (status === 404 && text.includes("model"))
    return { fatal: true, message: `The AI model "${MODEL}" isn't available to this API key.` };
  if (status === 429)
    return { fatal: false, message: "Anthropic is limiting how fast this account can go. Wait a minute and try again." };
  if (status === 529 || text.includes("overloaded"))
    return { fatal: false, message: "Anthropic is busy right now. Try again in a minute." };
  return { fatal: false, message: raw };
}
