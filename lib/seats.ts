// The council. Each seat has ONE question it always asks (its "lens").
// Brains (how they think, frameworks, voice) live in /brains/<id>.md.

export type HairStyle =
  | "bald"
  | "short"
  | "swept"
  | "long"
  | "cap"
  | "white"
  | "spiky"
  | "bob"
  | "longF"
  | "curly"
  | "fringe"
  | "wavy"
  | "curlyShort"
  | "bangs";

export interface AvatarLook {
  skin: string;
  hair: HairStyle;
  hairColor: string;
  beard?: "none" | "full" | "stubble" | "goatee" | "mustache";
  beardColor?: string; // defaults to hairColor
  lipstick?: string;
  earrings?: string;
  kippah?: string;
  necklace?: string;
  glasses?: boolean;
  shirt: string;
  tie?: string;
  hoodie?: boolean;
  capText?: string;
  eyesClosed?: boolean;
}

export interface Seat {
  id: string;
  name: string;
  short: string;
  question: string;
  isDefault: boolean;
  accent: string;
  look: AvatarLook;
}

export const SEATS: Seat[] = [
  {
    id: "bezos",
    name: "Jeff Bezos",
    short: "Bezos",
    question:
      "What does the customer actually get, and is this a one-way or a two-way door?",
    isDefault: true,
    accent: "#f5a623",
    look: { skin: "#f2c4a0", hair: "bald", hairColor: "#c99a77", shirt: "#3b5b8c", tie: undefined },
  },
  {
    id: "graham",
    name: "Paul Graham",
    short: "Graham",
    question:
      "What is the smallest version a few people will love, and are you doing things that don't scale?",
    isDefault: true,
    accent: "#7ed6a5",
    look: { skin: "#f3c9a8", hair: "short", hairColor: "#9a9a9a", shirt: "#4a6fa5" },
  },
  {
    id: "hormozi",
    name: "Alex Hormozi",
    short: "Hormozi",
    question: "Will people pay? How much? And how do we close?",
    isDefault: true,
    accent: "#ff6b6b",
    look: {
      skin: "#e0b18c",
      hair: "cap",
      hairColor: "#2b1d16",
      beard: "full",
      shirt: "#1f1f24",
      capText: "OFFER",
    },
  },
  {
    id: "garyvee",
    name: "Gary V",
    short: "Gary V",
    question: "Where is the attention right now, and are you playing the long game?",
    isDefault: true,
    accent: "#ffd166",
    look: { skin: "#e8b896", hair: "fringe", hairColor: "#2a201b", beard: "stubble", shirt: "#18181d", hoodie: true },
  },
  {
    id: "martell",
    name: "Dan Martell",
    short: "Martell",
    question: "Does this buy back the founder's time, or quietly eat it?",
    isDefault: true,
    accent: "#4cc9f0",
    look: { skin: "#f0c2a0", hair: "spiky", hairColor: "#7a5233", beard: "stubble", shirt: "#2d3e50" },
  },
  {
    id: "wickman",
    name: "Gino Wickman",
    short: "Wickman",
    question: "Can the business run this without the founder holding it all together?",
    isDefault: true,
    accent: "#b39ddb",
    look: { skin: "#eebf9c", hair: "bald", hairColor: "#bdbdbd", beard: "goatee", shirt: "#5a5f66", eyesClosed: true },
  },
  {
    id: "buffett",
    name: "Warren Buffett",
    short: "Buffett",
    question: "What does it do to cash, risk, and long-term value?",
    isDefault: true,
    accent: "#e9c46a",
    look: { skin: "#f1c6a8", hair: "white", hairColor: "#eeeeee", glasses: true, shirt: "#c9c3b5", tie: "#b3202a" },
  },
  {
    id: "naval",
    name: "Naval",
    short: "Naval",
    question: "Does this build leverage and equity you own, or does it just rent out your time?",
    isDefault: false,
    accent: "#90e0ef",
    look: { skin: "#c99a73", hair: "bald", hairColor: "#3a2a20", beard: "stubble", shirt: "#26323f" },
  },
  {
    id: "sanchez",
    name: "Codie Sanchez",
    short: "Sanchez",
    question: "Is there a boring, cash-flowing way to win this, and could you buy it instead of build it?",
    isDefault: false,
    accent: "#f4a261",
    look: { skin: "#e6b58f", hair: "longF", hairColor: "#3b2618", shirt: "#7b2d26" },
  },
  {
    id: "blakely",
    name: "Sara Blakely",
    short: "Blakely",
    question: "What is the scrappy first test, and does the founder truly believe in it?",
    isDefault: false,
    accent: "#ff8fab",
    look: { skin: "#f6d0b1", hair: "longF", hairColor: "#e3c07a", shirt: "#c2185b" },
  },
  {
    id: "leila",
    name: "Leila Hormozi",
    short: "L. Hormozi",
    question: "Can your team and leadership carry this, and who has to change?",
    isDefault: false,
    accent: "#cdb4db",
    look: { skin: "#e3b48f", hair: "bob", hairColor: "#2a1c15", shirt: "#2f2f38" },
  },
];

export const SEAT_BY_ID: Record<string, Seat> = Object.fromEntries(SEATS.map((s) => [s.id, s]));
export const DEFAULT_SEATS = SEATS.filter((s) => s.isDefault).map((s) => s.id);
