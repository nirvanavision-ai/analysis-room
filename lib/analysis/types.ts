// Types for the Analysis Room (forensic interpersonal analysis).

export type AStage = "situation" | "read" | "patterns" | "disagreements" | "crossexam" | "assessment" | "playbook";

export const A_STAGES: { id: AStage; label: string }[] = [
  { id: "situation", label: "Situation" },
  { id: "read", label: "Read" },
  { id: "patterns", label: "Patterns" },
  { id: "disagreements", label: "Disagreements" },
  { id: "crossexam", label: "Cross-exam" },
  { id: "assessment", label: "Assessment" },
  { id: "playbook", label: "Playbook" },
];

export const RELATIONSHIPS = [
  "Partner / spouse",
  "Dating / situationship",
  "Ex",
  "Parent / family",
  "Friend",
  "Boss / manager",
  "Coworker / team",
  "Client / negotiation",
  "Other",
] as const;

export interface Situation {
  title: string; // one line: what's going on
  relationship: string;
  details: string; // the story or pasted conversation
  goal: string; // what the user wants out of it
  seats: string[];
}

// How the dynamic reads to a seat, from best to worst.
export type Temperature = "HEALTHY" | "WORKABLE" | "STRAINED" | "RED FLAG";
export const TEMPERATURES: Temperature[] = ["HEALTHY", "WORKABLE", "STRAINED", "RED FLAG"];

export interface Read {
  temperature: Temperature;
  confidence: number; // 1-10
  headline: string;
  statement: string;
  pattern: string; // the core pattern they see
  redFlag: string; // the single most important warning sign (or "None clear")
  underneath: string; // what each person likely needs / fears underneath
  sayThis: string; // an exact line the user can say
}

export interface PatternItem {
  name: string;
  seenBy: string[]; // seat ids
  evidence: string;
}

export interface Disagreement {
  between: string[]; // seat ids
  issue: string;
}

export interface Patterns {
  summary: string;
  patterns: PatternItem[];
  disagreements: Disagreement[];
  missing: string[]; // what the panel doesn't know / other side of the story
  safetyFlag: boolean;
  challenges: { seat: string; target: string; angle: string }[];
}

export interface CrossExam {
  target: string;
  temperature: Temperature;
  statement: string;
}

export interface Assessment {
  temperature: Temperature;
  confidence: number;
  changedMind: boolean;
  keyInsight: string;
  oneMove: string; // the single best next move
  concedesTo: string | null;
  disagreesMost: string | null;
}

export interface Script {
  moment: string; // when to use it
  line: string; // exact words
}

export interface Playbook {
  temperature: Temperature; // panel consensus
  confidence: number;
  headline: string;
  whatsGoingOn: string;
  theirSide: string; // the most charitable read of the other person
  yourPart: string; // what the user may be contributing
  scripts: Script[];
  boundaries: string[];
  watchFor: string[];
  avoid: string[];
  nextSteps: string[];
  dissent: string;
  safetyNote: string | null;
  tally: { temperature: Temperature; count: number }[];
}

export type AnalysisEvent =
  | { type: "session"; sessionId: string; situation: Situation }
  | { type: "stage"; stage: AStage }
  | { type: "thinking"; seat: string }
  | { type: "read"; seat: string; data: Read }
  | { type: "patterns"; data: Patterns }
  | { type: "crossexam"; seat: string; data: CrossExam }
  | { type: "assessment"; seat: string; data: Assessment }
  | { type: "playbook"; data: Playbook }
  | { type: "seat_error"; seat: string; message: string }
  | { type: "done"; sessionId: string }
  | { type: "error"; message: string };
