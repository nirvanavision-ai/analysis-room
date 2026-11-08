// Thin wrapper around the Claude API with structured (Zod) outputs.
import Anthropic from "@anthropic-ai/sdk";
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
