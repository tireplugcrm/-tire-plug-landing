/**
 * The Tire Plug — AI grading of free-text survey answers
 * --------------------------------------------------------
 * Grades one applicant's answer to one situational question against the
 * anchors in questionnaire.json, returning a 0-5 score + short reasoning
 * + any red flags hit. Roll these up into traitScores and pass to
 * scoreCandidate() for the final strength score.
 *
 * Set ANTHROPIC_API_KEY in your environment.
 */

const MODEL = process.env.HIRING_MODEL || "claude-sonnet-4-6";

export async function gradeAnswer({ question, answer }) {
  const prompt = `You are grading a job applicant's answer for a high-volume tire shop.

SCENARIO:
${question.scenario}

WHAT A STRONG (5) ANSWER LOOKS LIKE:
${question.strong}

WHAT A MEETS-THE-BAR (3) ANSWER LOOKS LIKE:
${question.meets_bar}

RED FLAGS (push the score down; a customer-harming, dishonest, or unsafe action is a 0):
${question.red_flags}

APPLICANT'S ANSWER:
"${answer}"

Grade strictly against the anchors. Do not reward confident wording over substance.
Respond with ONLY a JSON object, no markdown, no preamble:
{"score": <integer 0-5>, "reasoning": "<one or two sentences>", "redFlagsHit": ["<short phrase>", ...]}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await res.json();
  const text = (data.content || [])
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .replace(/```json|```/g, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    // Fail safe: never silently pass a bad answer. Flag for human review.
    return { score: null, reasoning: "Could not parse grade - needs human review.", redFlagsHit: [], raw: text };
  }

  parsed.score = Math.max(0, Math.min(5, Math.round(parsed.score)));
  parsed.questionId = question.id;
  parsed.traits = question.traits;
  return parsed;
}

/**
 * Grade a whole survey and roll answers up into traitScores.
 * answers = { q1_acknowledge_customer: "text", q2_wrong_tires_mistake: "text", ... }
 */
export async function gradeSurvey(answers, questionnaire) {
  // Grade every question in parallel - keeps the whole submit well under
  // the serverless time limit even with 10 questions.
  const graded = await Promise.all(
    questionnaire.questions.map(async (q) => {
      const answer = answers[q.id];
      if (answer == null || String(answer).trim() === "") {
        return { questionId: q.id, traits: q.traits, score: 0, reasoning: "No answer given.", redFlagsHit: [] };
      }
      return gradeAnswer({ question: q, answer });
    })
  );

  // Average each trait across the questions that measure it.
  const buckets = {};
  for (const g of graded) {
    if (g.score == null) continue; // skip human-review items in the auto-roll-up
    for (const t of g.traits) {
      (buckets[t] = buckets[t] || []).push(g.score);
    }
  }
  const traitScores = {};
  for (const [t, arr] of Object.entries(buckets)) {
    traitScores[t] = +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);
  }

  // Any 0 on an integrity/safety question is worth surfacing as a possible gate.
  const gateWatch = graded.filter(
    (g) => g.score === 0 && (g.traits.includes("integrity") || g.traits.includes("torque_safety"))
  );

  return { graded, traitScores, gateWatch };
}
