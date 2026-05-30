/**
 * The Tire Plug — Hiring brain (single import surface)
 * ----------------------------------------------------
 * The applicant page and the API both import from here. Kept as one
 * self-contained module so the whole hiring system is liftable into
 * Calle Systems later (resell as a productized hiring page).
 */
import scoringConfig from "./scoring-config.json";
import questionnaire from "./questionnaire.json";
import knockout from "./knockout.json";
import { scoreCandidate } from "./scoreCandidate.js";
import { gradeAnswer, gradeSurvey } from "./scoreAnswer.js";
import { analyzeDocument } from "./analyzeDocument.js";

// The three roles an applicant can apply for, derived from the scoring config
// so the form and the scorer can never drift out of sync.
export const ROLES = Object.entries(scoringConfig.roles).map(([id, def]) => ({
  id,
  label: def.label
}));

export {
  scoringConfig,
  questionnaire,
  knockout,
  scoreCandidate,
  gradeAnswer,
  gradeSurvey,
  analyzeDocument
};

/**
 * Check knockout answers. Returns { passed, failedIds }.
 * answers = { ko_transport: "yes", ... }
 */
export function checkKnockout(answers = {}) {
  const failedIds = [];
  for (const q of knockout.questions) {
    const a = String(answers[q.id] ?? "").toLowerCase().trim();
    if (a !== String(q.passAnswer).toLowerCase()) failedIds.push(q.id);
  }
  return { passed: failedIds.length === 0, failedIds };
}
