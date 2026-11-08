import { jsPDF } from "jspdf";
import { A_SEAT_BY_ID } from "./seats";
import type { Assessment, CrossExam, Patterns, Playbook, Read, Situation } from "./types";

export function downloadPlaybookPDF(args: {
  situation: Situation;
  reads: Record<string, Read>;
  patterns: Patterns | null;
  crosses: Record<string, CrossExam>;
  assessments: Record<string, Assessment>;
  playbook: Playbook;
}) {
  const { situation, reads, patterns, crosses, assessments, playbook } = args;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 54;
  let y = M;
  const ACC: [number, number, number] = [120, 80, 200];

  const ensure = (h: number) => {
    if (y + h > H - M) {
      doc.addPage();
      y = M;
    }
  };
  const text = (s: string, size = 11, opts: { bold?: boolean; color?: [number, number, number]; gap?: number } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(opts.color ?? [30, 34, 45]));
    const lines = doc.splitTextToSize(s, W - M * 2) as string[];
    for (const line of lines) {
      ensure(size * 1.4);
      doc.text(line, M, y);
      y += size * 1.4;
    }
    y += opts.gap ?? 4;
  };
  const heading = (s: string) => {
    y += 8;
    ensure(40);
    text(s.toUpperCase(), 10, { bold: true, color: ACC, gap: 2 });
    doc.setDrawColor(230, 230, 235);
    doc.line(M, y - 6, W - M, y - 6);
    y += 6;
  };
  const bullets = (items: string[]) => items.forEach((i) => text(`•  ${i}`, 11, { gap: 2 }));

  text("ANALYSIS ROOM · PLAYBOOK", 10, { bold: true, color: ACC });
  text(situation.title, 20, { bold: true, gap: 6 });
  text(`${situation.relationship ? situation.relationship + " · " : ""}${new Date().toLocaleString()}`, 9, { color: [120, 120, 130], gap: 12 });

  if (playbook.safetyNote) {
    heading("Safety first");
    text(playbook.safetyNote, 11, { bold: true, color: [170, 30, 40] });
  }

  heading(`Panel read: ${playbook.temperature} · ${playbook.confidence}/10`);
  text(playbook.headline, 14, { bold: true, gap: 6 });
  text(playbook.whatsGoingOn);
  heading("Their side");
  text(playbook.theirSide);
  heading("Your part");
  text(playbook.yourPart);
  heading("Say this");
  playbook.scripts.forEach((s) => {
    text(s.moment, 10, { bold: true, color: [90, 90, 100], gap: 0 });
    text(`"${s.line}"`, 11, { gap: 6 });
  });
  heading("Boundaries");
  bullets(playbook.boundaries);
  heading("Watch for");
  bullets(playbook.watchFor);
  heading("Avoid");
  bullets(playbook.avoid);
  heading("Next steps");
  bullets(playbook.nextSteps);
  heading("Strongest dissent");
  text(playbook.dissent);

  if (patterns) {
    heading("Patterns");
    text(patterns.summary);
    patterns.patterns.forEach((p) => text(`•  ${p.name}: ${p.evidence}`, 11, { gap: 2 }));
    heading("Disagreements");
    patterns.disagreements.forEach((d) => text(`•  ${d.between.map((id) => A_SEAT_BY_ID[id]?.name ?? id).join(" vs ")}: ${d.issue}`, 11, { gap: 2 }));
    heading("What the panel doesn't know");
    bullets(patterns.missing);
  }

  heading("The panel");
  for (const id of situation.seats) {
    const s = A_SEAT_BY_ID[id];
    const r = reads[id];
    const c = crosses[id];
    const a = assessments[id];
    ensure(80);
    text(`${s.name} (AI interpretation)`, 13, { bold: true, gap: 0 });
    text(`"${s.question}"`, 9, { color: [120, 120, 130] });
    if (r) text(`Read: ${r.temperature} (${r.confidence}/10). ${r.statement} Red flag: ${r.redFlag} Say this: "${r.sayThis}"`, 10);
    if (c) text(`Cross-exam → ${A_SEAT_BY_ID[c.target]?.name}: ${c.statement}`, 10);
    if (a)
      text(
        `Final: ${a.temperature} (${a.confidence}/10)${a.changedMind ? ", changed mind" : ""}. ${a.keyInsight} Next move: ${a.oneMove}`,
        10,
        { gap: 10 },
      );
  }

  y += 10;
  text(
    "Panelists are AI interpretations of public figures' published ideas. They are not the real people and are not affiliated with or endorsed by them. This is educational reflection based on one side of a story, not therapy, diagnosis, or legal advice. If you are in danger, contact local emergency services.",
    8,
    { color: [140, 140, 150] },
  );

  const slug = situation.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  doc.save(`analysis-room-playbook-${slug}.pdf`);
}
