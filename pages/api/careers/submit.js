/**
 * The Tire Plug — Careers application intake + scoring
 * ----------------------------------------------------
 * Pipeline:
 *   1. Knockout check  -> fail = store as rejected_knockout, skip AI (cheap filter)
 *   2. Grade survey    -> 0-5 per answer -> rolled up to traitScores
 *   3. Score candidate -> gates + weighted 0-100 strength score + band
 *   4. Resume (optional)-> stored in Supabase Storage + AI review for the owner
 *   5. Insert applicant row
 *
 * Degrades gracefully: if the AI key or Supabase isn't configured yet, the
 * applicant still gets a friendly response and (where possible) the row is
 * saved for manual review - nothing is silently lost.
 */
import {
  questionnaire,
  scoringConfig,
  checkKnockout,
  gradeSurvey,
  scoreCandidate,
  analyzeDocument
} from "../../../lib/hiring/index.js";
import { supabaseAdmin, RESUME_BUCKET } from "../../../lib/supabaseAdmin.js";

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } }
};
export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    name,
    phone,
    email,
    role,
    knockoutAnswers = {},
    surveyAnswers = {},
    resumeBase64,       // base64 PDF (no data: prefix), optional
    resumeFilename
  } = req.body || {};

  if (!name || !role || !scoringConfig.roles[role]) {
    return res.status(400).json({ error: "Missing name or valid role." });
  }

  const roleLabel = scoringConfig.roles[role].label;

  // ---------------------------------------------------------------
  // 1. KNOCKOUT — the cheap auto-reject filter (no AI spent)
  // ---------------------------------------------------------------
  const ko = checkKnockout(knockoutAnswers);
  if (!ko.passed) {
    await safeInsert({
      name, phone, email, role, role_label: roleLabel,
      status: "rejected_knockout",
      knockout_answers: knockoutAnswers,
      knockout_failed: ko.failedIds,
      disqualified: true,
      gate_reasons: ["Failed knockout requirement(s)"]
    });
    return res.status(200).json({ success: true, outcome: "not_a_fit" });
  }

  // ---------------------------------------------------------------
  // 2 + 3. GRADE THE SURVEY and SCORE (needs the AI key)
  // ---------------------------------------------------------------
  let graded = null, traitScores = null, gateWatch = [], scoreResult = null;
  const haveKey = !!process.env.ANTHROPIC_API_KEY;

  if (haveKey) {
    try {
      const survey = await gradeSurvey(surveyAnswers, questionnaire);
      graded = survey.graded;
      traitScores = survey.traitScores;
      gateWatch = survey.gateWatch;
      scoreResult = scoreCandidate({ role, traitScores, failedGates: [] }, scoringConfig);
    } catch (err) {
      console.error("Grading error:", err);
    }
  }

  // ---------------------------------------------------------------
  // 4. RESUME — store + AI review (optional, for human review only)
  // ---------------------------------------------------------------
  let resumePath = null, resumeReview = null;
  if (resumeBase64) {
    resumePath = await uploadResume(resumeBase64, resumeFilename, name);
    if (haveKey) {
      try {
        resumeReview = await analyzeDocument({ pdf: resumeBase64, applicantName: name });
      } catch (err) {
        console.error("Resume analysis error:", err);
      }
    }
  }

  // ---------------------------------------------------------------
  // 5. INSERT
  // ---------------------------------------------------------------
  const status = scoreResult ? "scored" : "needs_review";
  await safeInsert({
    name, phone, email, role, role_label: roleLabel,
    status,
    knockout_answers: knockoutAnswers,
    knockout_failed: [],
    survey_answers: surveyAnswers,
    graded,
    trait_scores: traitScores,
    strength_score: scoreResult?.strengthScore ?? null,
    band: scoreResult?.band ?? null,
    disqualified: scoreResult?.disqualified ?? false,
    gate_reasons: [
      ...(scoreResult?.gateReasons || []),
      ...gateWatch.map((g) => `Survey 0 on ${g.questionId} (${g.traits.join("/")})`)
    ],
    resume_path: resumePath,
    resume_review: resumeReview
  });

  return res.status(200).json({ success: true, outcome: "received" });
}

// ---- helpers -------------------------------------------------------

async function uploadResume(base64, filename, name) {
  if (!supabaseAdmin) return null;
  try {
    const buffer = Buffer.from(base64, "base64");
    const safeName = String(name || "applicant").replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const stamp = `${safeName}-${buffer.length}-${(filename || "resume.pdf").replace(/[^a-z0-9.]/gi, "-")}`;
    const path = `applications/${stamp}`;
    const { error } = await supabaseAdmin.storage
      .from(RESUME_BUCKET)
      .upload(path, buffer, { contentType: "application/pdf", upsert: true });
    if (error) {
      console.error("Resume upload error:", error.message);
      return null;
    }
    return path;
  } catch (err) {
    console.error("Resume upload exception:", err);
    return null;
  }
}

async function safeInsert(row) {
  if (!supabaseAdmin) {
    console.warn("Supabase not configured - applicant not persisted:", row.name);
    return;
  }
  const { error } = await supabaseAdmin.from("applicants").insert(row);
  if (error) console.error("Applicant insert error:", error.message);
}
