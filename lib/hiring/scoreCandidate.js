/**
 * The Tire Plug — Applicant & Employee Scoring
 * --------------------------------------------------
 * Two layers:
 *   1) GATES - auto-disqualify. A charming, skilled, but toxic person
 *      should never score high. If any gate fails, the candidate is out
 *      regardless of weighted score.
 *   2) WEIGHTED STRENGTHS - each trait scored 0-5, weighted by role,
 *      normalized to a 0-100 strength score.
 *
 * Same traits work for two modes:
 *   - HIRING:      evidence = references, work history, interview answers.
 *   - PERFORMANCE: evidence = observed/logged behavior.
 */

export function scoreCandidate({ role, traitScores = {}, failedGates = [] }, config) {
  const roleDef = config.roles[role];
  if (!roleDef) {
    throw new Error(`Unknown role "${role}". Valid: ${Object.keys(config.roles).join(", ")}`);
  }

  // ---- Layer 1: Gates ----
  const triggered = config.gates.filter(
    (g) => failedGates.includes(g.id) && g.applies_to.includes(role)
  );

  if (triggered.length > 0) {
    return {
      role,
      roleLabel: roleDef.label,
      disqualified: true,
      gateReasons: triggered.map((g) => g.label),
      strengthScore: null,
      band: "DISQUALIFIED",
      breakdown: []
    };
  }

  // ---- Layer 2: Weighted strengths ----
  const weights = roleDef.weights;
  const breakdown = [];
  let weightedTotal = 0;
  let weightSum = 0;

  for (const [traitId, weight] of Object.entries(weights)) {
    const raw = traitScores[traitId];
    if (raw === undefined || raw === null) {
      // Missing evidence is treated as a gap, not a free pass.
      breakdown.push({ traitId, name: config.traits[traitId]?.name ?? traitId, weight, raw: null, note: "no evidence - scored 0" });
      weightSum += weight;
      continue;
    }
    const clamped = Math.max(0, Math.min(5, raw));
    const contribution = (clamped / 5) * weight; // 0..weight
    weightedTotal += contribution;
    weightSum += weight;
    breakdown.push({
      traitId,
      name: config.traits[traitId]?.name ?? traitId,
      weight,
      raw: clamped,
      contributionPct: +(contribution * 100).toFixed(1)
    });
  }

  // Normalize in case weights don't sum to exactly 1.0
  const strengthScore = weightSum > 0
    ? +((weightedTotal / weightSum) * 100).toFixed(1)
    : 0;

  const band = (config.bands.find((b) => strengthScore >= b.min) || {}).label || "Pass";

  return {
    role,
    roleLabel: roleDef.label,
    disqualified: false,
    gateReasons: [],
    strengthScore,        // 0-100
    band,
    breakdown             // per-trait contribution
  };
}
