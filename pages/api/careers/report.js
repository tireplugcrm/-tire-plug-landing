/**
 * Careers — downloadable candidate report (PDF), with the applicant's resume
 * appended into the same file. Password gated.
 *
 * POST { password, id } -> application/pdf (attachment)
 *
 * Builds a clean one+ page summary (score, band, traits, answers+grades,
 * resume notes, your notes) using pdf-lib, then copies the stored resume
 * PDF's pages onto the end so it's one packet per applicant.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { supabaseAdmin, RESUME_BUCKET } from "../../../lib/supabaseAdmin.js";
import { questionnaire } from "../../../lib/hiring/index.js";

export const maxDuration = 30;

// Map each questionId -> the actual question text the applicant answered.
const QUESTION_TEXT = Object.fromEntries(
  (questionnaire.questions || []).map((q) => [q.id, q.scenario])
);

const RED = rgb(0.8, 0.12, 0.12);
const DARK = rgb(0.1, 0.1, 0.1);
const GREY = rgb(0.42, 0.42, 0.42);
const LINE = rgb(0.85, 0.85, 0.85);

// pdf-lib standard fonts use WinAnsi — strip anything that can't encode.
function clean(s) {
  return String(s == null ? "" : s)
    .replace(/[‘’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\n]/g, "");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { password, id } = req.body || {};
  if (!process.env.CAREERS_ADMIN_PASSWORD || password !== process.env.CAREERS_ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!supabaseAdmin || !id) return res.status(400).json({ error: "Missing config or id." });

  const { data: a, error } = await supabaseAdmin.from("applicants").select("*").eq("id", id).single();
  if (error || !a) return res.status(404).json({ error: "Applicant not found." });

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const M = 50;             // margin
  const W = 612, H = 792;   // US Letter
  const MAXW = W - M * 2;
  let page = pdf.addPage([W, H]);
  let y = H - M;

  function space(n) { y -= n; }
  function newPageIfNeeded(need) {
    if (y - need < M) { page = pdf.addPage([W, H]); y = H - M; }
  }
  function wrap(text, f, size, maxw) {
    const out = [];
    for (const raw of clean(text).split("\n")) {
      const words = raw.split(/\s+/).filter(Boolean);
      if (!words.length) { out.push(""); continue; }
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (f.widthOfTextAtSize(test, size) > maxw && line) { out.push(line); line = w; }
        else line = test;
      }
      if (line) out.push(line);
    }
    return out;
  }
  function text(str, { size = 10, f = font, color = DARK, x = M, gap = 4, maxw = MAXW } = {}) {
    const lines = wrap(str, f, size, maxw);
    for (const ln of lines) {
      newPageIfNeeded(size + gap);
      page.drawText(ln, { x, y: y - size, size, font: f, color });
      y -= size + gap;
    }
  }
  function rule() {
    newPageIfNeeded(12);
    page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, thickness: 1, color: LINE });
    y -= 12;
  }
  function heading(str) {
    space(6);
    text(str, { size: 9, f: bold, color: GREY });
    rule();
  }

  // ---- Header ----
  text("THE TIRE PLUG  -  CANDIDATE REPORT", { size: 11, f: bold, color: RED, gap: 8 });
  text(clean(a.name) || "Applicant", { size: 22, f: bold, color: DARK, gap: 4 });
  text(`${clean(a.role_label) || "-"}   |   ${clean(a.email) || "no email"}   |   ${clean(a.phone) || "no phone"}`,
    { size: 10, color: GREY, gap: 6 });

  const score = a.strength_score != null ? Math.round(a.strength_score) : "-";
  const stageLabel = (a.stage || "new").replace(/^\w/, (c) => c.toUpperCase());
  text(`Strength score: ${score}    Band: ${a.band || a.status || "-"}    Stage: ${stageLabel}`,
    { size: 12, f: bold, color: DARK, gap: 6 });
  rule();

  // ---- Flags ----
  if (Array.isArray(a.gate_reasons) && a.gate_reasons.length) {
    heading("FLAGS TO CHECK");
    for (const g of a.gate_reasons) text("- " + clean(g), { size: 10, color: RED });
  }

  // ---- Trait scores ----
  const traits = a.trait_scores && typeof a.trait_scores === "object" ? a.trait_scores : null;
  if (traits && Object.keys(traits).length) {
    heading("TRAIT SCORES (0-5)");
    for (const [t, v] of Object.entries(traits)) {
      text(`${t.replace(/_/g, " ")}:  ${v}/5`, { size: 10 });
    }
  }

  // ---- Answers + grades ----
  const graded = Array.isArray(a.graded) ? a.graded : [];
  if (graded.length) {
    heading("ANSWERS + AI GRADES");
    for (const g of graded) {
      const sc = g.score != null ? `${g.score}/5` : "review";
      const question = QUESTION_TEXT[g.questionId] || (g.questionId || "").replace(/_/g, " ");
      // The actual question, then the grade, then the answer, then the AI's reasoning.
      text(`Q: ${question}`, { size: 10.5, f: bold, color: DARK, gap: 2 });
      text(`Grade: ${sc}`, { size: 9, f: bold, color: RED, gap: 3 });
      const ans = (a.survey_answers && a.survey_answers[g.questionId]) || "";
      if (ans) text(`Answer: "${clean(ans)}"`, { size: 10, color: DARK, gap: 2 });
      if (g.reasoning) text(`AI note: ${clean(g.reasoning)}`, { size: 9, color: GREY });
      space(8);
    }
  }

  // ---- Resume review ----
  const rr = a.resume_review;
  if (rr && (rr.overallNote || (rr.references && rr.references.length))) {
    heading("RESUME REVIEW");
    if (rr.overallNote) text(clean(rr.overallNote), { size: 10, gap: 5 });
    for (const r of rr.references || []) {
      text(`Reference: ${clean(r.name)} - ${clean(r.relationship)} ${r.contact ? "(" + clean(r.contact) + ")" : ""}`,
        { size: 10, f: bold, gap: 2 });
      if (r.mustAsk) text("Ask: " + clean(r.mustAsk), { size: 9, color: GREY });
      space(3);
    }
  }

  // ---- Owner notes ----
  if (a.owner_notes) {
    heading("YOUR NOTES");
    text(clean(a.owner_notes), { size: 10 });
  }

  // ---- Resume: load first, draw the note, THEN append pages ----
  // (Appending must come last so report text never lands after the resume.)
  let resumePages = null;
  let resumeNote;
  if (a.resume_path) {
    try {
      const { data: file, error: dlErr } = await supabaseAdmin.storage.from(RESUME_BUCKET).download(a.resume_path);
      if (!dlErr && file) {
        const ab = await file.arrayBuffer();
        const resumeDoc = await PDFDocument.load(ab);
        resumePages = await pdf.copyPages(resumeDoc, resumeDoc.getPageIndices());
        resumeNote = `Resume attached (${resumePages.length} page${resumePages.length > 1 ? "s" : ""}) on the following page(s).`;
      } else {
        resumeNote = "Resume on file could not be retrieved.";
      }
    } catch (e) {
      resumeNote = "Resume on file could not be merged (not a valid PDF).";
    }
  } else {
    resumeNote = "No resume was uploaded.";
  }
  heading("RESUME");
  text(resumeNote, { size: 10, color: GREY });

  // All report text is now placed; safe to append the resume pages at the end.
  if (resumePages) resumePages.forEach((p) => pdf.addPage(p));

  const bytes = await pdf.save();
  const safe = (clean(a.name) || "applicant").replace(/[^a-z0-9]/gi, "-").toLowerCase();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safe}-tireplug-report.pdf"`);
  return res.status(200).send(Buffer.from(bytes));
}
