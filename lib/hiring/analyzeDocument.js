/**
 * The Tire Plug — Resume & Certification Analyzer
 * -------------------------------------------------
 * Documents are STORED for human review, not auto-scored. This function
 * does NOT change an applicant's score. It reads the resume/certs and
 * hands the owner a review summary (fit highlights, red flags, certs,
 * references). References ALWAYS get the "Would you rehire?" prompt - a
 * "no" is a hard gate in scoring-config.json.
 *
 * Accepts extracted `text` OR a base64 `pdf`. Set ANTHROPIC_API_KEY.
 */

const MODEL = process.env.HIRING_MODEL || "claude-sonnet-4-6";

export async function analyzeDocument({ text, pdf, applicantName = "the applicant" }) {
  const instructions = `You are screening a resume for a HIGH-VOLUME tire shop (20-30 cars/day) with three role types: office/sales reps, tire technicians, and alignment technicians.

What the owner values most: integrity, team contribution, professionalism/composure, and reliability - then role skill (tire/alignment experience, ASE certs, customer service).

Read ${applicantName}'s document and return ONLY this JSON (no markdown, no preamble):
{
  "fitHighlights": [{"line": "<the resume detail>", "why": "<why it would excel here>"}],
  "redFlags": [{"concern": "<what to be aware of>", "severity": "low|medium|high"}],
  "certifications": [{"name": "<cert>", "verifyNote": "ask for proof / lapsed?"}],
  "references": [{"name": "<name>", "relationship": "<prior employer/role>", "contact": "<phone/email if present>", "mustAsk": "Would you rehire? Why or why not?"}],
  "overallNote": "<2-3 sentence summary for the owner's review>"
}

Be honest about red flags (short tenures, unexplained gaps, vague or inflated claims, no references listed). If a section has nothing, return an empty array. Do not invent references or certs that aren't in the document.`;

  const content = [];
  if (pdf) {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } });
  }
  if (text) {
    content.push({ type: "text", text: `DOCUMENT:\n${text}` });
  }
  content.push({ type: "text", text: instructions });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content }]
    })
  });

  const data = await res.json();
  const out = (data.content || [])
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .replace(/```json|```/g, "")
    .trim();

  try {
    const parsed = JSON.parse(out);
    parsed.needsHumanReview = true; // always - this never auto-scores
    return parsed;
  } catch (e) {
    return {
      fitHighlights: [],
      redFlags: [{ concern: "Could not parse document automatically - review manually.", severity: "low" }],
      certifications: [],
      references: [],
      overallNote: "Automatic analysis failed; the stored file still needs a manual read.",
      needsHumanReview: true,
      raw: out
    };
  }
}
