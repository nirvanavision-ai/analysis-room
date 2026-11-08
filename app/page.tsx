"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import { A_DEFAULT_SEATS, A_SEATS, A_SEAT_BY_ID } from "@/lib/analysis/seats";
import { A_STAGES, RELATIONSHIPS, TEMPERATURES } from "@/lib/analysis/types";
import type { AnalysisEvent, AStage, Assessment, CrossExam, Patterns, Playbook, Read, Situation, Temperature } from "@/lib/analysis/types";
import { downloadPlaybookPDF } from "@/lib/analysis/pdf";
import { api, clearHistory, deleteFromHistory, getAccessCode, loadHistory, LockedError, runAnalysis, saveToHistory, setAccessCode } from "@/lib/analysis/runner";

interface Utterance {
  seat: string;
  text: string;
  badge: string;
  target?: string;
}

const DISCLAIMER =
  "Panelists are AI interpretations of public figures' published ideas. They are not the real people and are not affiliated with or endorsed by them. This is educational reflection based on one side of the story, not therapy, diagnosis, or legal advice.";

function Temp({ t }: { t: Temperature }) {
  return <span className={`temp temp-${t.replace(" ", "-")}`}>{t}</span>;
}

export default function AnalysisPage() {
  // ---------- situation ----------
  const [title, setTitle] = useState("");
  const [relationship, setRelationship] = useState<string>("");
  const [details, setDetails] = useState("");
  const [goal, setGoal] = useState("");
  const [seats, setSeats] = useState<string[]>(A_DEFAULT_SEATS);
  const [modNote, setModNote] = useState<{ reason: string; questions: string[] } | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [config, setConfig] = useState<{ demo: boolean; model: string; locked: boolean } | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [past, setPast] = useState<{ id: string; title: string; temperature: Temperature | null }[]>([]);

  // ---------- room ----------
  const [view, setView] = useState<"situation" | "room">("situation");
  const [situation, setSituation] = useState<Situation | null>(null);
  const [stage, setStage] = useState<AStage>("situation");
  const [thinking, setThinking] = useState<Set<string>>(new Set());
  const [reads, setReads] = useState<Record<string, Read>>({});
  const [patterns, setPatterns] = useState<Patterns | null>(null);
  const [crosses, setCrosses] = useState<Record<string, CrossExam>>({});
  const [assessments, setAssessments] = useState<Record<string, Assessment>>({});
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [spot, setSpot] = useState(0);
  const [follow, setFollow] = useState(true);
  const [detail, setDetail] = useState<string | null>(null);

  const loadPast = () => setPast(loadHistory().map(({ id, title, temperature }) => ({ id, title, temperature: temperature as Temperature | null })));
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => {
        setConfig(c);
        if (!c.locked) return setUnlocked(true);
        // Re-check a remembered code quietly.
        const saved = getAccessCode();
        if (saved)
          fetch("/api/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: saved }) })
            .then((r) => setUnlocked(r.ok))
            .catch(() => {});
      })
      .catch(() => setConfig({ demo: false, model: "", locked: false }));
    loadPast();
  }, []);

  const relock = () => {
    setAccessCode("");
    setUnlocked(false);
  };

  const resetRoom = () => {
    setStage("situation");
    setThinking(new Set());
    setReads({});
    setPatterns(null);
    setCrosses({});
    setAssessments({});
    setPlaybook(null);
    setErrors([]);
    setUtterances([]);
    setSpot(0);
    setFollow(true);
    setDetail(null);
  };

  const done = (seat: string) =>
    setThinking((t) => {
      const n = new Set(t);
      n.delete(seat);
      return n;
    });

  const handle = useCallback((ev: AnalysisEvent) => {
    switch (ev.type) {
      case "session":
        setSituation(ev.situation);
        break;
      case "stage":
        setStage(ev.stage);
        setThinking(new Set());
        break;
      case "thinking":
        setThinking((t) => new Set(t).add(ev.seat));
        break;
      case "read":
        done(ev.seat);
        setReads((o) => ({ ...o, [ev.seat]: ev.data }));
        setUtterances((u) => [...u, { seat: ev.seat, text: ev.data.statement, badge: `READ · ${ev.data.temperature} (${ev.data.confidence}/10)` }]);
        break;
      case "patterns":
        setPatterns(ev.data);
        break;
      case "crossexam":
        done(ev.seat);
        setCrosses((r) => ({ ...r, [ev.seat]: ev.data }));
        setUtterances((u) => [
          ...u,
          { seat: ev.seat, text: ev.data.statement, badge: `→ ${A_SEAT_BY_ID[ev.data.target]?.short ?? ev.data.target} · ${ev.data.temperature}`, target: ev.data.target },
        ]);
        break;
      case "assessment":
        done(ev.seat);
        setAssessments((v) => ({ ...v, [ev.seat]: ev.data }));
        setUtterances((u) => [
          ...u,
          { seat: ev.seat, text: ev.data.keyInsight, badge: `FINAL · ${ev.data.temperature} (${ev.data.confidence}/10)${ev.data.changedMind ? " · CHANGED MIND" : ""}` },
        ]);
        break;
      case "playbook":
        setPlaybook(ev.data);
        break;
      case "seat_error":
        done(ev.seat);
        setErrors((e) => [...e, `${A_SEAT_BY_ID[ev.seat]?.name}: ${ev.message}`]);
        break;
      case "error":
        setErrors((e) => [...e, ev.message]);
        break;
      case "done":
        break;
    }
  }, []);

  const start = async () => {
    const s: Situation = { title: title.trim(), relationship, details: details.trim(), goal: goal.trim(), seats };
    if (!s.title || !s.details) return alert("Add a one-line summary and the details of what happened.");
    if (s.seats.length < 2) return alert("Pick at least two panelists.");
    resetRoom();
    setSituation(s);
    setView("room");
    setRunning(true);
    window.scrollTo({ top: 0 });
    const events: AnalysisEvent[] = [];
    let playbookTemp: string | null = null;
    const record = (ev: AnalysisEvent) => {
      if (ev.type !== "thinking") events.push(ev);
      if (ev.type === "playbook") playbookTemp = ev.data.temperature;
      handle(ev);
    };
    let id: string | null = null;
    try {
      id = await runAnalysis(s, record);
    } catch (e) {
      if (e instanceof LockedError) relock();
      setErrors((x) => [...x, (e as Error).message]);
    } finally {
      setRunning(false);
      setThinking(new Set());
      const sid = id ?? (events.find((e) => e.type === "session") as { sessionId: string } | undefined)?.sessionId;
      if (sid && events.some((e) => e.type === "read")) {
        saveToHistory({ id: sid, title: s.title, temperature: playbookTemp, events });
        loadPast();
      }
    }
  };

  const replay = async (id: string) => {
    const events = loadHistory().find((x) => x.id === id)?.events;
    if (!events) return loadPast();
    resetRoom();
    setView("room");
    setRunning(true);
    for (const ev of events) {
      handle(ev);
      await new Promise((r) => setTimeout(r, ev.type === "stage" ? 300 : 60));
    }
    setRunning(false);
  };

  const suggest = async () => {
    setSuggesting(true);
    try {
      const r = await api<{ seats: string[]; reason: string; questions: string[] }>("/api/analysis/suggest", { title, relationship, details, goal });
      setSeats(r.seats);
      setModNote({ reason: r.reason, questions: r.questions });
    } catch (e) {
      if (e instanceof LockedError) relock();
      setModNote({ reason: `Couldn't reach the moderator: ${(e as Error).message}`, questions: [] });
    } finally {
      setSuggesting(false);
    }
  };

  // ---------- speaker spotlight ----------
  useEffect(() => {
    if (follow && spot >= utterances.length && utterances.length) setSpot(utterances.length - 1);
  }, [utterances.length, follow, spot]);
  const current = utterances[Math.min(spot, utterances.length - 1)];
  const typed = useTypewriter(current?.text ?? "", `${spot}-${current?.seat}`);
  useEffect(() => {
    if (!follow || !current || typed.length < current.text.length) return;
    if (spot < utterances.length - 1) {
      const t = setTimeout(() => setSpot((s) => s + 1), 1600);
      return () => clearTimeout(t);
    }
  }, [typed, current, follow, spot, utterances.length]);

  const roomSeats = (situation?.seats ?? seats).map((id) => A_SEAT_BY_ID[id]).filter(Boolean);
  const stageIdx = A_STAGES.findIndex((s) => s.id === stage);

  const badgeFor = (id: string) => {
    const a = assessments[id];
    if (a) return `${a.temperature} · ${a.confidence}/10`;
    const c = crosses[id];
    if (c) return `→ ${A_SEAT_BY_ID[c.target]?.short}`;
    const r = reads[id];
    if (r) return `${r.temperature} (${r.confidence}/10)`;
    return null;
  };

  return (
    <div className="app theme-analysis">
      <header className="topbar">
        <div className="brand" onClick={() => !running && setView("situation")}>
          <Logo />
          <span className="divider" />
          <span>Analysis Room</span>
        </div>
        <nav className="steps">
          {A_STAGES.map((s, i) => (
            <span key={s.id} className={`step ${i < stageIdx ? "done" : ""} ${i === stageIdx ? "active" : ""}`}>
              <i />
              {s.label}
            </span>
          ))}
        </nav>
        <div className="topright">
          {config?.demo && (
            <span className="demo-pill" title="No ANTHROPIC_API_KEY set: canned answers">
              Demo mode
            </span>
          )}
        </div>
      </header>

      {config?.locked && !unlocked ? (
        <LockScreen onUnlock={() => setUnlocked(true)} />
      ) : view === "situation" ? (
        <main className="brief">
          <section className="card brief-card">
            <h1>Put a situation in the room.</h1>
            <p className="muted">
              Describe a conversation, a conflict, or a relationship dynamic. A panel of AI interpretations of psychology, communication and
              negotiation experts each read it through one lens, challenge each other, and hand you a playbook with exact words to say.
            </p>
            <label>In one line, what&apos;s going on?</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My partner goes silent for days after every disagreement" />
            <label>Who is this with?</label>
            <div className="rel-row">
              {RELATIONSHIPS.map((r) => (
                <button key={r} className={`rel-chip ${relationship === r ? "on" : ""}`} onClick={() => setRelationship(relationship === r ? "" : r)}>
                  {r}
                </button>
              ))}
            </div>
            <label>What happened? (paste texts or the conversation if you have them)</label>
            <textarea
              rows={9}
              maxLength={20000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={
                "Tell the story in your own words, or paste the messages, e.g.\n\nMe: Can we talk about last night?\nThem: There's nothing to talk about. You always do this.\nMe: I just felt hurt when...\n\nInclude how long it's been going on and anything that feels important."
              }
            />
            <label>What do you want out of this?</label>
            <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Understand what's really going on and know what to say next" />
            <div className="notice">
              Use first names or nicknames only, and leave out details that could identify someone. If you&apos;re in danger right now, contact local
              emergency services. In the US, call or text <b>988</b> (crisis line) or call <b>1-800-799-7233</b> (domestic violence hotline).
            </div>
          </section>

          <section className="card">
            <div className="row-between">
              <h2>Who sits on the panel?</h2>
              <button className="ghost" onClick={suggest} disabled={suggesting || !title.trim()}>
                {suggesting ? "Moderator is thinking…" : "Let the moderator pick"}
              </button>
            </div>
            {modNote && (
              <div className="chair-note">
                <b>Moderator:</b> {modNote.reason}
                {modNote.questions.length > 0 && (
                  <ul>
                    {modNote.questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="seat-grid">
              {A_SEATS.map((s) => {
                const on = seats.includes(s.id);
                return (
                  <button
                    key={s.id}
                    className={`seat-chip ${on ? "on" : ""}`}
                    style={{ ["--accent" as string]: s.accent }}
                    onClick={() => setSeats((x) => (on ? x.filter((y) => y !== s.id) : [...x, s.id]))}
                  >
                    <div className="chip-face">
                      <Avatar seat={s} />
                    </div>
                    <div className="chip-text">
                      <b>{s.name}</b>
                      <span>{s.question}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="row-between start-row">
              <span className="muted">{seats.length} panelists · 3 rounds</span>
              <button className="primary" onClick={start}>
                Start the analysis
              </button>
            </div>
          </section>

          {past.length > 0 && (
            <section className="card">
              <div className="row-between">
                <h2>Past analyses</h2>
                <button
                  className="ghost"
                  onClick={() => {
                    if (confirm("Delete all past analyses saved in this browser?")) {
                      clearHistory();
                      loadPast();
                    }
                  }}
                >
                  Clear all
                </button>
              </div>
              <p className="muted small">Saved only in this browser on this device. Nothing is stored on the server.</p>
              <ul className="past">
                {past.map((p) => (
                  <li key={p.id} className="past-row">
                    <button className="ghost wide" onClick={() => replay(p.id)}>
                      <span>{p.title}</span>
                      <span className="muted">{p.temperature ?? "unfinished"}</span>
                    </button>
                    <button
                      className="ghost x"
                      aria-label={`Delete ${p.title}`}
                      title="Delete"
                      onClick={() => {
                        deleteFromHistory(p.id);
                        loadPast();
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="disclaimer">{DISCLAIMER}</p>
        </main>
      ) : (
        <main className="room">
          <section className="stage-panel">
            <div className="arc">
              {roomSeats.map((s, i) => {
                const n = roomSeats.length;
                const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
                const left = 50 + t * 44;
                const top = 6 + t * t * 34;
                const scale = 0.86 + Math.abs(t) * 0.22;
                const speaking = current?.seat === s.id;
                const badge = badgeFor(s.id);
                return (
                  <div
                    key={s.id}
                    className={`seat ${speaking ? "speaking" : ""} ${current?.target === s.id ? "targeted" : ""}`}
                    style={{ left: `${left}%`, top: `${top}%`, transform: `translateX(-50%) scale(${scale})`, zIndex: Math.round(10 + Math.abs(t) * 10), ["--accent" as string]: s.accent }}
                    onClick={() => setDetail(s.id)}
                  >
                    {thinking.has(s.id) && (
                      <div className="dots">
                        <span />
                        <span />
                        <span />
                      </div>
                    )}
                    <div className="face">
                      <Avatar seat={s} speaking={speaking} />
                    </div>
                    <div className="nametag">{s.name}</div>
                    {badge && <div className="seat-badge">{badge}</div>}
                  </div>
                );
              })}
            </div>
            <div className="table">
              <div className="table-glow" />
              {current ? (
                <div className="speech">
                  <div className="speech-head">
                    <div className="mini">
                      <Avatar seat={A_SEAT_BY_ID[current.seat]} />
                    </div>
                    <b>{A_SEAT_BY_ID[current.seat].name}</b>
                    <span className="ai-tag">AI</span>
                    <span className="stance">{current.badge}</span>
                  </div>
                  <p>
                    {typed}
                    <span className="ghost-text">{current.text.slice(typed.length)}</span>
                  </p>
                  <div className="speech-nav">
                    <button className="ghost" disabled={spot <= 0} onClick={() => { setFollow(false); setSpot((s) => Math.max(0, s - 1)); }}>
                      ‹ Prev
                    </button>
                    <span className="muted">
                      {Math.min(spot, utterances.length - 1) + 1} / {utterances.length}
                    </span>
                    <button className="ghost" disabled={spot >= utterances.length - 1} onClick={() => { setFollow(false); setSpot((s) => s + 1); }}>
                      Next ›
                    </button>
                    {!follow && (
                      <button className="ghost" onClick={() => setFollow(true)}>
                        Follow live
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="speech waiting">
                  <p className="muted">{running ? "The panel is reading your situation…" : "Waiting to start."}</p>
                </div>
              )}
            </div>
          </section>

          {errors.length > 0 && (
            <section className="card error">
              {errors.map((e, i) => (
                <div key={i}>⚠ {e}</div>
              ))}
            </section>
          )}

          {situation && (
            <section className="card">
              <h2>Situation</h2>
              <p className="lead">{situation.title}</p>
              <div className="opts">
                {situation.relationship && <span className="opt">{situation.relationship}</span>}
                {situation.goal && (
                  <span className="opt">
                    <b>Goal</b> {situation.goal}
                  </span>
                )}
              </div>
            </section>
          )}

          {Object.keys(reads).length > 0 && (
            <section className="card">
              <h2>Round 1 · The read</h2>
              <div className="pos-grid">
                {roomSeats.filter((s) => reads[s.id]).map((s) => {
                  const r = reads[s.id];
                  return (
                    <button key={s.id} className="pos" style={{ ["--accent" as string]: s.accent }} onClick={() => setDetail(s.id)}>
                      <div className="pos-head">
                        <b>{s.name}</b>
                        <span style={{ marginLeft: "auto" }}>
                          <Temp t={r.temperature} />
                        </span>
                      </div>
                      <div className="pos-headline">{r.headline}</div>
                      <div className="muted small">Red flag: {r.redFlag}</div>
                      <div className="say">Say this: “{r.sayThis}”</div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {patterns && (
            <section className="card">
              <h2>Patterns</h2>
              <p>{patterns.summary}</p>
              <div className="pattern-list">
                {patterns.patterns.map((p, i) => (
                  <div key={i} className="pattern-item">
                    <b>{p.name}</b>
                    <div className="small">{p.evidence}</div>
                    {p.seenBy.length > 0 && <div className="who">Seen by {p.seenBy.map((id) => A_SEAT_BY_ID[id]?.short ?? id).join(", ")}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {patterns && stageIdx >= A_STAGES.findIndex((s) => s.id === "disagreements") && (
            <section className="card">
              <h2>Disagreements</h2>
              <ul className="lines">
                {patterns.disagreements.map((l, i) => (
                  <li key={i}>
                    <b>{l.between.map((id) => A_SEAT_BY_ID[id]?.short ?? id).join(" vs ")}</b> {l.issue}
                  </li>
                ))}
              </ul>
              {patterns.missing.length > 0 && (
                <div className="chair-note">
                  <b>What the panel doesn&apos;t know:</b>
                  <ul>
                    {patterns.missing.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {Object.keys(crosses).length > 0 && (
            <section className="card">
              <h2>Round 2 · Cross-exam</h2>
              <div className="feed">
                {roomSeats.filter((s) => crosses[s.id]).map((s) => {
                  const c = crosses[s.id];
                  return (
                    <div key={s.id} className="feed-item" style={{ ["--accent" as string]: s.accent }}>
                      <div className="mini">
                        <Avatar seat={s} />
                      </div>
                      <div>
                        <div className="feed-head">
                          <b>{s.name}</b> <span className="muted">challenges</span> <b>{A_SEAT_BY_ID[c.target]?.name}</b>
                        </div>
                        <p>{c.statement}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {Object.keys(assessments).length > 0 && (
            <section className="card">
              <h2>Round 3 · Assessment</h2>
              <TempTally assessments={assessments} />
              <div className="vote-list">
                {roomSeats.filter((s) => assessments[s.id]).map((s) => {
                  const a = assessments[s.id];
                  return (
                    <div key={s.id} className="vote-row" style={{ ["--accent" as string]: s.accent }}>
                      <b>{s.short}</b>
                      <span className="stance">
                        <Temp t={a.temperature} /> {a.confidence}/10{a.changedMind ? " · changed" : ""}
                      </span>
                      <span className="small">{a.keyInsight}</span>
                      <span className="muted small">
                        Next move: {a.oneMove} {a.concedesTo && <>Moved by {A_SEAT_BY_ID[a.concedesTo]?.short}. </>}
                        {a.disagreesMost && <>Disagrees most with {A_SEAT_BY_ID[a.disagreesMost]?.short}.</>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {playbook && situation && (
            <section className="card verdict">
              <div className="row-between">
                <h2>Playbook</h2>
                <div className="actions">
                  <button className="primary" onClick={() => downloadPlaybookPDF({ situation, reads, patterns, crosses, assessments, playbook })}>
                    Download PDF
                  </button>
                  <button className="ghost" onClick={() => { setView("situation"); resetRoom(); }}>
                    New analysis
                  </button>
                </div>
              </div>
              {playbook.safetyNote && <div className="safety">⚠ {playbook.safetyNote}</div>}
              <div className="pb-hero">
                <div className="gauge">
                  <Temp t={playbook.temperature} />
                  <div className="gauge-bar">
                    {TEMPERATURES.map((t, i) => (
                      <span key={t} className={i <= TEMPERATURES.indexOf(playbook.temperature) ? "lit" : ""} />
                    ))}
                  </div>
                  <div className="muted small" style={{ marginTop: 6 }}>{playbook.confidence}/10 confidence</div>
                </div>
                <div className="lead">{playbook.headline}</div>
              </div>
              <p>{playbook.whatsGoingOn}</p>
              <div className="two">
                <div>
                  <h3>Their side</h3>
                  <p>{playbook.theirSide}</p>
                </div>
                <div>
                  <h3>Your part</h3>
                  <p>{playbook.yourPart}</p>
                </div>
              </div>
              <h3>Say this</h3>
              <div className="scripts">
                {playbook.scripts.map((s, i) => (
                  <div key={i} className="script">
                    <div className="moment">{s.moment}</div>
                    <div className="line">“{s.line}”</div>
                  </div>
                ))}
              </div>
              <div className="four">
                <div><h3>Boundaries</h3><ul>{playbook.boundaries.map((c) => <li key={c}>{c}</li>)}</ul></div>
                <div><h3>Watch for</h3><ul>{playbook.watchFor.map((c) => <li key={c}>{c}</li>)}</ul></div>
                <div><h3>Avoid</h3><ul>{playbook.avoid.map((c) => <li key={c}>{c}</li>)}</ul></div>
                <div><h3>Next steps</h3><ul>{playbook.nextSteps.map((c) => <li key={c}>{c}</li>)}</ul></div>
              </div>
              <p className="chair-note" style={{ marginTop: 16 }}><b>Strongest dissent:</b> {playbook.dissent}</p>
              <p className="disclaimer" style={{ textAlign: "left" }}>{DISCLAIMER}</p>
            </section>
          )}

          {detail && (
            <div className="drawer-bg" onClick={() => setDetail(null)}>
              <aside className="drawer" onClick={(e) => e.stopPropagation()} style={{ ["--accent" as string]: A_SEAT_BY_ID[detail].accent }}>
                <button className="ghost x close" onClick={() => setDetail(null)}>×</button>
                <div className="drawer-face"><Avatar seat={A_SEAT_BY_ID[detail]} /></div>
                <h2>{A_SEAT_BY_ID[detail].name}<span className="ai-tag">AI interpretation</span></h2>
                <p className="muted">“{A_SEAT_BY_ID[detail].question}”</p>
                {reads[detail] && (
                  <>
                    <h3>Read · {reads[detail].temperature} ({reads[detail].confidence}/10)</h3>
                    <p>{reads[detail].statement}</p>
                    <p className="small"><b>Pattern:</b> {reads[detail].pattern}</p>
                    <p className="small"><b>Red flag:</b> {reads[detail].redFlag}</p>
                    <p className="small"><b>Underneath:</b> {reads[detail].underneath}</p>
                    <p className="small"><b>Say this:</b> “{reads[detail].sayThis}”</p>
                  </>
                )}
                {crosses[detail] && (
                  <>
                    <h3>Cross-exam → {A_SEAT_BY_ID[crosses[detail].target]?.name}</h3>
                    <p>{crosses[detail].statement}</p>
                  </>
                )}
                {assessments[detail] && (
                  <>
                    <h3>Final · {assessments[detail].temperature} ({assessments[detail].confidence}/10)</h3>
                    <p>{assessments[detail].keyInsight}</p>
                    <p className="small"><b>Next move:</b> {assessments[detail].oneMove}</p>
                  </>
                )}
                {!reads[detail] && <p className="muted">Hasn&apos;t spoken yet.</p>}
              </aside>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

function TempTally({ assessments }: { assessments: Record<string, Assessment> }) {
  const all = Object.values(assessments);
  return (
    <div className="temp-tally">
      {TEMPERATURES.map((t) => (
        <div key={t}>
          <b>{all.filter((a) => a.temperature === t).length}</b>
          <Temp t={t} />
        </div>
      ))}
    </div>
  );
}

function useTypewriter(text: string, key: string) {
  const [n, setN] = useState(0);
  const ref = useRef(key);
  useEffect(() => {
    ref.current = key;
    setN(0);
  }, [key]);
  useEffect(() => {
    if (n >= text.length) return;
    const t = setTimeout(() => setN((x) => Math.min(text.length, x + 2)), 18);
    return () => clearTimeout(t);
  }, [n, text]);
  return text.slice(0, n);
}

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="lens" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#5eead4" />
        </linearGradient>
      </defs>
      <circle cx="13" cy="13" r="9" fill="none" stroke="url(#lens)" strokeWidth="3.5" />
      <path d="M20 20 L28 28" stroke="url(#lens)" strokeWidth="4" strokeLinecap="round" />
      <path d="M9 14 C10 10 14 9 16 10" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      if (!r.ok) throw new Error("That code didn't work.");
      setAccessCode(code.trim());
      onUnlock();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="brief">
      <form className="card brief-card lock-card" onSubmit={submit}>
        <h1>Enter the access code.</h1>
        <p className="muted">This Analysis Room is private. Ask the owner for the code.</p>
        <input type="password" autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Access code" aria-label="Access code" />
        {err && <div className="lock-err">{err}</div>}
        <div className="row-between start-row">
          <span />
          <button className="primary" type="submit" disabled={busy || !code.trim()}>
            {busy ? "Checking…" : "Enter"}
          </button>
        </div>
      </form>
    </main>
  );
}
