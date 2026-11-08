// Demo-mode generators so the Analysis Room works without an API key.
import type { Seat } from "../seats";
import { A_SEAT_BY_ID } from "./seats";
import type { Assessment, CrossExam, Patterns, Read, Situation, Temperature } from "./types";

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

const FLAVOR: Record<string, { pattern: string; line: string; say: string }> = {
  greene: { pattern: "A quiet struggle over who sets the terms.", line: "Look at who benefits when things stay vague. The one who controls the ambiguity controls the relationship.", say: "I'd like us to agree on what we're actually doing here, plainly." },
  voss: { pattern: "Both sides arguing positions, nobody labeling the fear underneath.", line: "Nobody here feels heard, so nobody can move. Start with an accusation audit and let them correct you.", say: "It seems like you feel I don't take your side seriously. Is that fair?" },
  hughes: { pattern: "Approval-seeking on one side, withholding on the other.", line: "The word choices tell me who's chasing and who's steering. Watch the hedges and the timing of replies.", say: "I noticed things changed after Tuesday. What happened on your end?" },
  robbins: { pattern: "Overthinking as a way to avoid a hard conversation.", line: "You already know what you want to say. Let them react however they react. Let me decide what I do next.", say: "I've been avoiding this, and I don't want to anymore. Can we talk tonight?" },
  ramani: { pattern: "Invalidation and moving goalposts.", line: "Watch the pattern, not the apology. If your reality keeps getting rewritten, that's the signal.", say: "I'm not going to debate what I experienced. I'm telling you how it landed." },
  swan: { pattern: "An old abandonment wound being triggered on both sides.", line: "The size of the reaction is a clue. This is touching something much older than this week.", say: "When this happens I feel left behind, and I think it's an old feeling too." },
  perel: { pattern: "The same fight with new content: closeness versus freedom.", line: "Each of you is telling a different story about what this relationship is for. Ask how they'd tell it.", say: "How would you describe what's going on between us, in your own words?" },
  gottman: { pattern: "Criticism met with defensiveness, and missed repair attempts.", line: "I'd look for the bids that were turned away. Repair matters more than avoiding the fight.", say: "I'd like to start over. I feel hurt about what happened, and I need us to slow down." },
  mate: { pattern: "Behavior soothing an older pain.", line: "Don't ask why the behavior. Ask why the pain, theirs and yours.", say: "I want to understand what this is like for you, and I also need you to hear me." },
  brown: { pattern: "Shame showing up as blame and armor.", line: "Clear is kind. Nobody has said the vulnerable sentence yet.", say: "The story I'm making up is that you don't care. Can you help me check that?" },
  navarro: { pattern: "Discomfort cues and avoidance around the key topic.", line: "Notice when the replies slow down or get formal. That's where the discomfort lives.", say: "I notice we keep skipping this topic. I'd like to talk about it directly." },
  cialdini: { pattern: "Reciprocity and guilt used as levers.", line: "Name the lever, then decide on the merits. A favor doesn't create a debt you didn't agree to.", say: "I appreciate what you did, and I still need to decide this on its own." },
  vanedwards: { pattern: "High competence, low warmth signals.", line: "The cues read cold even if the intent isn't. Lead with warmth, then the ask.", say: "I really value us, and I'd love to figure this out together." },
  debecker: { pattern: "Discounting a clear no.", line: "Your intuition flagged this early. Don't explain it away. One clear no, then hold it.", say: "No. I've decided, and I won't be discussing it further." },
};

const TEMPS: Temperature[] = ["WORKABLE", "STRAINED", "WORKABLE", "STRAINED", "HEALTHY", "RED FLAG"];

export function mockRead(seat: Seat, sit: Situation): Read {
  const f = FLAVOR[seat.id] ?? { pattern: "A recurring pattern.", line: "Look at the pattern.", say: "Can we talk about this?" };
  const h = hash(seat.id + sit.title);
  return {
    temperature: TEMPS[h % TEMPS.length],
    confidence: 5 + (h % 4),
    headline: f.pattern,
    statement: `My lens: ${seat.question.toLowerCase()} Reading "${sit.title}": ${f.line} I only have your side, so hold this as a hypothesis. (Demo mode: add an API key for a real ${seat.name}-style analysis.)`,
    pattern: f.pattern,
    redFlag: h % 3 === 0 ? "None clear from what's here." : "The same issue keeps coming back without being named.",
    underneath: "You want to feel respected and safe; they likely want to avoid feeling blamed.",
    sayThis: f.say,
  };
}

export function mockPatterns(sit: Situation, reads: Record<string, Read>): Patterns {
  const ids = Object.keys(reads);
  return {
    summary: "The panel agrees there's a recurring pattern nobody is naming out loud. They split on whether it's mainly a communication problem or a respect problem.",
    patterns: [
      { name: "The unspoken recurring fight", seenBy: ids.slice(0, 3), evidence: "The same topic keeps resurfacing in different forms." },
      { name: "Bids for connection going unanswered", seenBy: ids.slice(2, 5), evidence: "Attempts to talk are met with deflection." },
      { name: "Self-doubt in the retelling", seenBy: ids.slice(4, 7), evidence: "You question your own memory of what happened." },
    ],
    disagreements: [
      { between: ids.slice(0, 2), issue: "Is this a power struggle, or two people afraid of the same thing?" },
      { between: ids.slice(2, 4), issue: "Confront it directly now, or slow down and understand first?" },
    ],
    missing: ["How the other person would tell this story", "How long this has been going on", "Whether this happens in their other relationships too"],
    safetyFlag: false,
    challenges: ids.map((id, i) => ({
      seat: id,
      target: ids[(i + 3) % ids.length] === id ? ids[(i + 1) % ids.length] : ids[(i + 3) % ids.length],
      angle: "Challenge whether their read survives your lens.",
    })),
  };
}

export function mockCrossExam(seat: Seat, sit: Situation, target: string, reads: Record<string, Read>): CrossExam {
  const t = A_SEAT_BY_ID[target];
  const mine = reads[seat.id] ?? mockRead(seat, sit);
  return {
    target,
    temperature: mine.temperature,
    statement: `${t.short}, your read is sharp, but it skips my question: ${seat.question.toLowerCase()} ${FLAVOR[seat.id]?.line ?? ""} Until that's addressed, any script is just a band-aid.`,
  };
}

export function mockAssessment(seat: Seat, sit: Situation, read?: Read): Assessment {
  const r = read ?? mockRead(seat, sit);
  const ids = sit.seats.filter((s) => s !== seat.id);
  const h = hash(seat.id);
  return {
    temperature: r.temperature,
    confidence: Math.min(10, r.confidence + (h % 2)),
    changedMind: h % 4 === 0,
    keyInsight: `${FLAVOR[seat.id]?.line ?? "Name the pattern."}`,
    oneMove: `Say it plainly: "${r.sayThis}"`,
    concedesTo: ids[h % ids.length] ?? null,
    disagreesMost: ids[(h + 2) % ids.length] ?? null,
  };
}

export function mockPlaybookText(sit: Situation, temperature: Temperature, assessments: Record<string, Assessment>, safety: boolean) {
  const names = Object.keys(assessments).map((id) => A_SEAT_BY_ID[id].name);
  return {
    headline: `This reads as ${temperature.toLowerCase()}: a recurring pattern that needs to be named, not managed.`,
    whatsGoingOn: `The panel sees the same fight showing up in different forms. ${names[0] ?? "One panelist"} points to who controls the terms, while ${names[1] ?? "another"} focuses on the fear underneath. Most agree the next step is a direct, calm conversation. This is a demo playbook; add an API key for a real analysis of your situation.`,
    theirSide: "They may feel criticized or cornered, and pulling back is how they protect themselves.",
    yourPart: "You may be waiting for them to bring it up, which keeps the pattern going.",
    scripts: [
      { moment: "Opening the conversation", line: "I'd like to talk about something that's been on my mind. Is now okay?" },
      { moment: "When they get defensive", line: "It sounds like this feels like an attack. That's not what I want." },
      { moment: "Holding your ground", line: "I hear you. And I still need this to change." },
    ],
    boundaries: ["I won't continue a conversation when I'm being yelled at.", "I need a reply within a day on things that matter."],
    watchFor: ["Whether they can repeat back what you said", "Whether the same issue comes back within two weeks"],
    avoid: ["Bringing it up over text in the middle of a fight", "Listing every past grievance at once"],
    nextSteps: ["Pick a calm time this week", "Open with one feeling and one request", "Check in again in two weeks"],
    dissent: `${names[names.length - 1] ?? "One panelist"} thinks the pattern is more serious than the rest of the panel does.`,
    safetyNote: safety ? "If you feel unsafe, contact local emergency services or a domestic violence hotline." : null,
  };
}
