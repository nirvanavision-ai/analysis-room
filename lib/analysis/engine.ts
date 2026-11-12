// The Analysis Room engine, split into small stateless steps so each web request
// makes ONE Claude call and finishes well inside a hosting time limit.
// The browser runs the steps in order (see lib/analysis/runner.ts) and keeps the results.
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { ask, MOCK, sleep } from "../claude";
import type { Seat } from "../seats";
import { A_SEAT_BY_ID } from "./seats";
import { TEMPERATURES } from "./types";
import type { Assessment, CrossExam, Patterns, Playbook, Read, Situation, Temperature } from "./types";
import { mockAssessment, mockCrossExam, mockPatterns, mockPlaybookText, mockRead } from "./mock";

const BRAINS_DIR = path.join(process.cwd(), "brains", "analysis");

// ---------- schemas ----------
const TempZ = z.enum(["HEALTHY", "WORKABLE", "STRAINED", "RED FLAG"]);

const ReadZ = z.object({
  temperature: TempZ.describe("Your overall read of the dynamic"),
  confidence: z.number().int().describe("How confident you are in your read given you only have one side, 1-10"),
  headline: z.string().describe("Your read in under 12 words"),
  statement: z.string().describe("Your spoken read, 60-100 words, first person, in your voice, quoting short phrases from the situation as evidence"),
  pattern: z.string().describe("The core pattern you see, named in your framework's terms, one sentence"),
  redFlag: z.string().describe("The single most important warning sign, one sentence, or 'None clear' if there isn't one"),
  underneath: z.string().describe("What each person likely needs or fears underneath the surface, one or two sentences"),
  sayThis: z.string().describe("An exact line the user could say or text next, honest and respectful, in quotes-free plain text"),
});

const PatternsZ = z.object({
  summary: z.string().describe("2-3 sentences on what the panel agrees on and where it splits"),
  patterns: z
    .array(z.object({ name: z.string(), seenBy: z.array(z.string()), evidence: z.string() }))
    .describe("2-5 patterns the panel identified, with seat ids who saw each and the concrete evidence from the situation"),
  disagreements: z
    .array(z.object({ between: z.array(z.string()), issue: z.string() }))
    .describe("1-4 sharpest disagreements between panelists, seat ids in 'between'"),
  missing: z.array(z.string()).describe("2-4 things the panel doesn't know: the other person's side, missing facts, questions worth asking"),
  safetyFlag: z.boolean().describe("true if anything suggests violence, threats, stalking, coercive control, abuse, or self-harm risk"),
  challenges: z
    .array(z.object({ seat: z.string(), target: z.string(), angle: z.string() }))
    .describe("Exactly one entry per seat: whose read they should cross-examine and on what point"),
});

const CrossExamZ = z.object({
  target: z.string().describe("seat id of the panelist you are cross-examining"),
  temperature: TempZ.describe("Your read now, after hearing everyone"),
  statement: z.string().describe("Your spoken cross-examination, 60-100 words, addressing the target by name: what their read misses or gets wrong, through your lens"),
});

const AssessmentZ = z.object({
  temperature: TempZ,
  confidence: z.number().int().describe("1-10"),
  changedMind: z.boolean(),
  keyInsight: z.string().describe("Your single most important insight for the user, one or two sentences"),
  oneMove: z.string().describe("The single best next move for the user, one sentence"),
  concedesTo: z.string().nullable().describe("seat id of whoever moved you most, or null"),
  disagreesMost: z.string().nullable().describe("seat id you still disagree with most, or null"),
});

const PlaybookTextZ = z.object({
  headline: z.string().describe("The core of what's going on, in one clear sentence"),
  whatsGoingOn: z.string().describe("4-6 sentences explaining the dynamic, attributing insights to panelists by name"),
  theirSide: z.string().describe("The most charitable, realistic read of the other person's perspective, 2-3 sentences"),
  yourPart: z.string().describe("What the user may be contributing to the dynamic, said kindly and honestly, 1-3 sentences"),
  scripts: z
    .array(z.object({ moment: z.string().describe("When to use it"), line: z.string().describe("The exact words") }))
    .describe("3-5 exact scripts the user can use"),
  boundaries: z.array(z.string()).describe("2-4 clear boundaries worth setting"),
  watchFor: z.array(z.string()).describe("2-4 behaviors to watch for next, signs it's getting better or worse"),
  avoid: z.array(z.string()).describe("2-4 things NOT to do"),
  nextSteps: z.array(z.string()).describe("3-5 concrete next steps with timing"),
  dissent: z.string().describe("The strongest dissenting view on the panel, attributed by name"),
  safetyNote: z
    .string()
    .nullable()
    .describe("If there are any safety concerns, a plain safety note with where to get help (emergency services, 988 in the US, a domestic violence hotline); otherwise null"),
});

// ---------- prompts ----------
const TEMP_GUIDE = `Temperature scale:
- HEALTHY: normal friction, both people mostly acting in good faith.
- WORKABLE: real problems, fixable with better communication and effort.
- STRAINED: corrosive patterns; needs serious change, support, or distance.
- RED FLAG: manipulation, abuse, or danger signals; the user should protect themselves first.`;

const GUARDRAILS = `Ground rules (non-negotiable):
- You only have the user's side. Treat your read as a well-reasoned hypothesis and say what you'd want to know.
- Describe behaviors and patterns; never diagnose anyone with a mental health condition. Say "this pattern is consistent with…", not "they are a…".
- If the user's own behavior is part of the problem, say so honestly and kindly.
- Safety first: if there are signs of physical violence, threats, stalking, coercive control, sexual coercion, child endangerment, or self-harm or suicidal thoughts, say so plainly before anything else and urge contacting emergency services, a crisis line (988 in the US) or a domestic violence hotline.
- Help the user understand, communicate honestly, and protect themselves. Never coach deception, manipulation, coercion, revenge, surveillance, or covert control of another person, even if asked.
- Be specific: quote short phrases from the situation as evidence. No invented facts, quotes, or statistics.
- This is educational reflection, not therapy, diagnosis, or legal advice.`;

function situationText(s: Situation) {
  return [
    `SITUATION: ${s.title}`,
    `RELATIONSHIP: ${s.relationship || "(not given)"}`,
    `WHAT HAPPENED / THE CONVERSATION:\n${s.details || "(none given)"}`,
    `WHAT THE USER WANTS: ${s.goal || "(not given)"}`,
  ].join("\n\n");
}

function panelList(s: Situation) {
  return s.seats
    .map((id) => A_SEAT_BY_ID[id])
    .filter(Boolean)
    .map((p) => `- ${p.id} = ${p.name} (lens: ${p.question})`)
    .join("\n");
}

async function brainFor(seat: Seat) {
  try {
    return await fs.readFile(path.join(BRAINS_DIR, `${seat.id}.md`), "utf8");
  } catch {
    return `# ${seat.name}\nLens: ${seat.question}`;
  }
}

async function seatSystem(seat: Seat, s: Situation) {
  const brain = await brainFor(seat);
  return `You are a panelist in the Analysis Room, a forensic interpersonal analysis panel. You are an AI interpretation of the publicly published ideas of ${seat.name}. You are NOT the real person and must never claim to be, claim private knowledge, or invent quotes. Speak in first person, in their style.

Your lens, which you ALWAYS bring the situation back to:
"${seat.question}"

Your brain:
${brain}

The panel (seat id = name):
${panelList(s)}

${TEMP_GUIDE}

${GUARDRAILS}

Style: spoken statements are 60-100 words, no lists, no markdown. Be direct and specific to this situation, not generic.`;
}

const MODERATOR = `You are the Moderator of the Analysis Room: a neutral, careful facilitator of a panel of AI interpretations of psychology, communication and negotiation experts. You don't add your own theory; you synthesize, map disagreements, and protect the user's wellbeing.\n\n${GUARDRAILS}`;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));
const normTemp = (t: string): Temperature => (TEMPERATURES.includes(t as Temperature) ? (t as Temperature) : "WORKABLE");
const validSeat = (id: string | null | undefined, s: Situation) => (id && s.seats.includes(id) ? id : null);


// ---------- input checks ----------
const LIMITS = { title: 300, relationship: 100, details: 20000, goal: 600 };

export function cleanSituation(raw: unknown): Situation {
  const s = (raw ?? {}) as Partial<Situation>;
  const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const sit: Situation = {
    title: str(s.title, LIMITS.title),
    relationship: str(s.relationship, LIMITS.relationship),
    details: str(s.details, LIMITS.details),
    goal: str(s.goal, LIMITS.goal),
    seats: Array.isArray(s.seats) ? [...new Set(s.seats.filter((id) => typeof id === "string" && A_SEAT_BY_ID[id]))] : [],
  };
  if (!sit.title || !sit.details) throw new InputError("Add a one-line summary and the details of what happened.");
  if (sit.seats.length < 2) throw new InputError("Pick at least two panelists.");
  return sit;
}

export class InputError extends Error {}

function seatOf(id: unknown, sit: Situation): Seat {
  if (typeof id !== "string" || !sit.seats.includes(id)) throw new InputError("Unknown panelist.");
  return A_SEAT_BY_ID[id];
}

function onlySeats<T>(rec: unknown, sit: Situation): Record<string, T> {
  const out: Record<string, T> = {};
  if (rec && typeof rec === "object") for (const [k, v] of Object.entries(rec)) if (sit.seats.includes(k) && v && typeof v === "object") out[k] = v as T;
  return out;
}

const cut = (v: unknown, n = 1500) => String(v ?? "").slice(0, n);

function readsText(reads: Record<string, Read>) {
  return Object.entries(reads)
    .map(([id, r]) => `${A_SEAT_BY_ID[id].name} [${id}] — ${cut(r.temperature, 20)} (${Number(r.confidence) || 5}/10): ${cut(r.statement)} | Pattern: ${cut(r.pattern, 400)} | Red flag: ${cut(r.redFlag, 400)}`)
    .join("\n\n");
}

// ---------- step 1: one panelist's read ----------
export async function stepRead(sit: Situation, seatId: unknown): Promise<Read> {
  const seat = seatOf(seatId, sit);
  if (MOCK) {
    await sleep(700 + Math.random() * 1500);
    return mockRead(seat, sit);
  }
  const r = await ask(await seatSystem(seat, sit), `${situationText(sit)}\n\nRound 1 (the read): Give your first read of this situation through your lens.`, ReadZ);
  return { ...r, temperature: normTemp(r.temperature), confidence: clamp(r.confidence, 1, 10) };
}

// ---------- step 2: the moderator maps patterns + disagreements ----------
export async function stepPatterns(sit: Situation, rawReads: unknown): Promise<Patterns> {
  const reads = onlySeats<Read>(rawReads, sit);
  if (Object.keys(reads).length === 0) throw new InputError("No panelist produced a read.");
  const seats = sit.seats.map((id) => A_SEAT_BY_ID[id]);
  if (MOCK) {
    await sleep(1500);
    return mockPatterns(sit, reads);
  }
  const p = await ask(
    `${MODERATOR}\n\nPanel seat ids:\n${panelList(sit)}`,
    `${situationText(sit)}\n\nTHE PANEL'S READS:\n${readsText(reads)}\n\nMap the patterns the panel sees (with evidence), the sharpest disagreements, and what's missing from the picture. Then assign every panelist exactly one other panelist to cross-examine (prefer pairing people who disagree; if everyone agrees, have them pressure-test the most confident read).`,
    PatternsZ,
  );
  return {
    ...p,
    patterns: p.patterns.map((x) => ({ ...x, seenBy: x.seenBy.filter((id) => sit.seats.includes(id)) })),
    disagreements: p.disagreements.map((x) => ({ ...x, between: x.between.filter((id) => sit.seats.includes(id)) })),
    challenges: seats.map((s) => {
      const c = p.challenges.find((x) => x.seat === s.id);
      const fallback = seats.find((x) => x.id !== s.id)?.id ?? s.id;
      const target = validSeat(c?.target, sit);
      return { seat: s.id, target: target && target !== s.id ? target : fallback, angle: c?.angle ?? "Pressure-test their read." };
    }),
  };
}

// ---------- step 3: one panelist's cross-exam ----------
export async function stepCrossExam(sit: Situation, seatId: unknown, rawReads: unknown, rawPat: unknown): Promise<CrossExam> {
  const seat = seatOf(seatId, sit);
  const reads = onlySeats<Read>(rawReads, sit);
  const pat = (rawPat ?? {}) as Partial<Patterns>;
  const c = (Array.isArray(pat.challenges) ? pat.challenges : []).find((x) => x?.seat === seat.id);
  const target = validSeat(c?.target, sit) && c!.target !== seat.id ? c!.target : sit.seats.find((x) => x !== seat.id)!;
  const angle = cut(c?.angle, 400) || "Pressure-test their read.";
  if (MOCK) {
    await sleep(700 + Math.random() * 1500);
    return mockCrossExam(seat, sit, target, reads);
  }
  const r = await ask(
    await seatSystem(seat, sit),
    `${situationText(sit)}\n\nTHE PANEL'S READS:\n${readsText(reads)}\n\nMODERATOR'S MAP: ${cut(pat.summary, 1200)}\n\nRound 2 (cross-exam): Challenge ${A_SEAT_BY_ID[target].name} [${target}]. Angle: ${angle}. Show what their read misses or gets wrong through your lens. You may update your own read.`,
    CrossExamZ,
  );
  return { ...r, target: validSeat(r.target, sit) ?? target, temperature: normTemp(r.temperature) };
}

// ---------- step 4: one panelist's final assessment ----------
export async function stepAssessment(sit: Situation, seatId: unknown, rawReads: unknown, rawCrosses: unknown): Promise<Assessment> {
  const seat = seatOf(seatId, sit);
  const reads = onlySeats<Read>(rawReads, sit);
  const crosses = onlySeats<CrossExam>(rawCrosses, sit);
  if (MOCK) {
    await sleep(700 + Math.random() * 1500);
    return mockAssessment(seat, sit, reads[seat.id]);
  }
  const crossText = Object.entries(crosses)
    .map(([id, c]) => `${A_SEAT_BY_ID[id].name} → ${A_SEAT_BY_ID[c.target]?.name ?? "the panel"}: ${cut(c.statement)}`)
    .join("\n\n");
  const a = await ask(
    await seatSystem(seat, sit),
    `${situationText(sit)}\n\nTHE PANEL'S READS:\n${readsText(reads)}\n\nCROSS-EXAM:\n${crossText}\n\nRound 3 (final assessment): Having heard everyone, give your final assessment. Say whether you changed your mind, who moved you, and who you still disagree with most.`,
    AssessmentZ,
  );
  return {
    ...a,
    temperature: normTemp(a.temperature),
    confidence: clamp(a.confidence, 1, 10),
    concedesTo: validSeat(a.concedesTo, sit),
    disagreesMost: validSeat(a.disagreesMost, sit),
  };
}

// ---------- step 5: the moderator writes the playbook ----------
export async function stepPlaybook(sit: Situation, rawPat: unknown, rawAssessments: unknown): Promise<Playbook> {
  const pat = (rawPat ?? {}) as Partial<Patterns>;
  const assessments = onlySeats<Assessment>(rawAssessments, sit);
  const all = Object.values(assessments).map((a) => ({ ...a, temperature: normTemp(a.temperature), confidence: clamp(Number(a.confidence) || 5, 1, 10) }));
  const tally = TEMPERATURES.map((t) => ({ temperature: t, count: all.filter((a) => a.temperature === t).length }));
  // Most common read; ties go to the more cautious one.
  const top = [...tally].sort((a, b) => b.count - a.count || TEMPERATURES.indexOf(b.temperature) - TEMPERATURES.indexOf(a.temperature))[0];
  const temperature: Temperature = all.length ? top.temperature : "WORKABLE";
  const confidence = all.length ? Math.round((all.reduce((s, a) => s + a.confidence, 0) / all.length) * 10) / 10 : 0;
  const safetyFlag = pat.safetyFlag === true;

  let text: z.infer<typeof PlaybookTextZ>;
  if (MOCK) {
    await sleep(1500);
    text = mockPlaybookText(sit, temperature, assessments, safetyFlag);
  } else {
    const assessText = Object.entries(assessments)
      .map(([id, a]) => `${A_SEAT_BY_ID[id].name}: ${normTemp(a.temperature)} (${a.confidence}/10)${a.changedMind ? " [changed mind]" : ""}. Insight: ${cut(a.keyInsight, 600)} Move: ${cut(a.oneMove, 400)}`)
      .join("\n");
    const patText = (Array.isArray(pat.patterns) ? pat.patterns : []).slice(0, 6).map((p) => `${cut(p?.name, 200)} (${cut(p?.evidence, 500)})`).join("; ");
    text = await ask(
      `${MODERATOR}\n\nYou are now writing the final Playbook for the user: clear, warm, concrete, and brief. Attribute insights to panelists by name.`,
      `${situationText(sit)}\n\nPATTERNS: ${patText}\nSAFETY FLAG FROM MAPPING: ${safetyFlag}\n\nFINAL ASSESSMENTS:\n${assessText}\n\nPANEL CONSENSUS: ${temperature} (avg confidence ${confidence}/10)\n\nWrite the playbook.`,
      PlaybookTextZ,
    );
  }
  return { temperature, confidence, tally, ...text, safetyNote: text.safetyNote || (safetyFlag ? SAFETY_FALLBACK : null) };
}

const SAFETY_FALLBACK =
  "Parts of this suggest your safety could be at risk. If you are in danger, contact local emergency services. In the US you can call or text 988 (Suicide & Crisis Lifeline) or call 1-800-799-7233 (National Domestic Violence Hotline). Outside the US, look up your local crisis line.";

// ---------- moderator: pick the panel ----------
const SuggestZ = z.object({
  seats: z.array(z.string()).describe("5-7 seat ids best suited to this situation"),
  reason: z.string().describe("One or two sentences on who you added or benched and why"),
  questions: z.array(z.string()).describe("Up to 3 short clarifying questions that would most improve the analysis; empty if clear"),
});

export async function suggestPanel(raw: unknown, allSeats: Seat[]) {
  const s0 = (raw ?? {}) as Partial<Situation>;
  const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const sit = { title: str(s0.title, LIMITS.title), relationship: str(s0.relationship, LIMITS.relationship), details: str(s0.details, LIMITS.details), goal: str(s0.goal, LIMITS.goal) };
  if (!sit.title) throw new InputError("Add a one-line summary first.");
  if (MOCK) {
    await sleep(600);
    return {
      seats: allSeats.filter((s) => s.isDefault).map((s) => s.id),
      reason: "Demo mode: using the default seven. Add an API key for a tailored panel.",
      questions: sit.details ? [] : ["What exactly was said, word for word?", "How long has this pattern been going on?"],
    };
  }
  const list = allSeats.map((s) => `- ${s.id} = ${s.name}: ${s.question}`).join("\n");
  const r = await ask(
    `${MODERATOR}\n\nYou pick which panelists should analyze a situation so the lenses fit and there is real tension between perspectives. Include Gavin de Becker if there's any hint of threat, stalking or intimidation; include John Gottman for couples' conflict; include Chris Voss for negotiations.\n\nAvailable panelists:\n${list}`,
    `${situationText({ ...sit, seats: [] })}\n\nPick the panel and list any clarifying questions.`,
    SuggestZ,
  );
  return { ...r, seats: r.seats.filter((id) => A_SEAT_BY_ID[id]).slice(0, 8) };
}
