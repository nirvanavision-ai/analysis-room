// Runs an analysis from the browser: it calls /api/analysis/step once per panelist
// per round (in parallel), then the moderator steps, and reports progress as events.
// Each request is a single Claude call, so it stays inside hosting time limits.
"use client";
import { A_SEAT_BY_ID } from "./seats";
import type { AnalysisEvent, Assessment, CrossExam, Patterns, Playbook, Read, Situation } from "./types";

export class LockedError extends Error {}

export function getAccessCode() {
  try {
    return localStorage.getItem("analysis-room-code") || "";
  } catch {
    return "";
  }
}
export function setAccessCode(code: string) {
  try {
    if (code) localStorage.setItem("analysis-room-code", code);
    else localStorage.removeItem("analysis-room-code");
  } catch {}
}

export async function api<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let lastErr: Error = new Error("Request failed");
  for (let attempt = 0; attempt < 2; attempt++) {
    if (signal?.aborted) throw new Error("Stopped.");
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-access-code": getAccessCode() },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      lastErr = new Error(signal?.aborted ? "Stopped." : "Network problem. Check your connection.");
      continue;
    }
    const j = await res.json().catch(() => ({}));
    if (res.status === 401) throw new LockedError(j.error || "Access code needed.");
    if (res.ok) return j as T;
    lastErr = new Error(j.error || (res.status === 504 ? "The server took too long." : `Request failed (${res.status})`));
    if (res.status === 400) break; // our input was bad; retrying won't help
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw lastErr;
}

export function newSessionId(title: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-|-$/g, "");
  return `${stamp}_${slug || "analysis"}`;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runAnalysis(sit: Situation, emit: (ev: AnalysisEvent) => void, signal?: AbortSignal) {
  const sessionId = newSessionId(sit.title);
  const step = <T,>(body: Record<string, unknown>) => api<T>("/api/analysis/step", { situation: sit, ...body }, signal);

  async function perSeat<T>(label: string, fn: (seat: string) => Promise<T>, onDone: (seat: string, data: T) => void) {
    const results: Record<string, T> = {};
    await Promise.all(
      sit.seats.map(async (seat) => {
        emit({ type: "thinking", seat });
        try {
          const data = await fn(seat);
          results[seat] = data;
          onDone(seat, data);
        } catch (e) {
          if (e instanceof LockedError) throw e;
          emit({ type: "seat_error", seat, message: `${label}: ${(e as Error).message}` });
        }
      }),
    );
    return results;
  }

  emit({ type: "session", sessionId, situation: sit });

  // ROUND 1 — Read
  emit({ type: "stage", stage: "read" });
  const reads = await perSeat<Read>("read", (seat) => step({ step: "read", seat }), (seat, data) => emit({ type: "read", seat, data }));
  if (Object.keys(reads).length === 0) throw new Error("No panelist produced a read. Check the API key and try again.");

  // Patterns + disagreements
  emit({ type: "stage", stage: "patterns" });
  const patterns = await step<Patterns>({ step: "patterns", reads });
  emit({ type: "patterns", data: patterns });
  await pause(500);
  emit({ type: "stage", stage: "disagreements" });
  await pause(800);

  // ROUND 2 — Cross-exam (only panelists who gave a read)
  emit({ type: "stage", stage: "crossexam" });
  const crosses = await perSeat<CrossExam>(
    "cross-exam",
    (seat) => (reads[seat] ? step({ step: "crossexam", seat, reads, patterns }) : Promise.reject(new Error("skipped (no read)"))),
    (seat, data) => emit({ type: "crossexam", seat, data }),
  );

  // ROUND 3 — Assessment
  emit({ type: "stage", stage: "assessment" });
  const assessments = await perSeat<Assessment>(
    "assessment",
    (seat) => (reads[seat] ? step({ step: "assessment", seat, reads, crosses }) : Promise.reject(new Error("skipped (no read)"))),
    (seat, data) => emit({ type: "assessment", seat, data }),
  );

  // Playbook
  emit({ type: "stage", stage: "playbook" });
  const playbook = await step<Playbook>({ step: "playbook", patterns, assessments });
  emit({ type: "playbook", data: playbook });
  emit({ type: "done", sessionId });
  return sessionId;
}

// ---------- past analyses, kept only in this browser ----------
const HISTORY_KEY = "analysis-room-history";
const MAX_SAVED = 25;

export interface SavedAnalysis {
  id: string;
  title: string;
  temperature: string | null;
  events: AnalysisEvent[];
}

export function loadHistory(): SavedAnalysis[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as SavedAnalysis[]) : [];
  } catch {
    return [];
  }
}

export function saveToHistory(entry: SavedAnalysis) {
  let list = [entry, ...loadHistory().filter((x) => x.id !== entry.id)].slice(0, MAX_SAVED);
  // If the browser runs out of room, drop the oldest until it fits.
  while (list.length) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
      return;
    } catch {
      list = list.slice(0, -1);
    }
  }
}

export function deleteFromHistory(id: string) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(loadHistory().filter((x) => x.id !== id)));
  } catch {}
}

export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {}
}

export const seatName = (id: string) => A_SEAT_BY_ID[id]?.name ?? id;
