/**
 * Training AI. mode "draft" (owner: bullets → a full SOP guide) and
 * mode "ask" (any approved user: question answered from the company's modules).
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";

const MODEL = process.env.LEADS_AI_MODEL || "claude-sonnet-4-6";

async function askClaude(prompt, maxTokens = 900) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  return (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "AI is not set up (missing key)." });

  const { mode, title, bullets, question, content, count } = req.body || {};

  if (mode === "quiz") {
    if (!auth.user.isOwner) return res.status(403).json({ error: "Owner only." });
    const n = Math.min(15, Math.max(5, Number(count) || 5));
    if (!content || content.trim().length < 30) return res.status(400).json({ error: "Write/draft the guide first, then generate the quiz." });
    const prompt = `Create a ${n}-question multiple-choice quiz to test a new employee on this training guide for The Tire Plug tire shop. Each question must have exactly 4 options and exactly one correct answer. Base EVERY question only on the guide content below — do not test outside knowledge.

GUIDE TITLE: ${title}
GUIDE CONTENT:
${content}

Return ONLY valid JSON (no markdown, no preamble) in exactly this shape:
{"questions":[{"q":"question text","options":["option A","option B","option C","option D"],"answer":0}]}
where "answer" is the 0-based index (0-3) of the correct option. Produce exactly ${n} questions.`;
    try {
      const text = await askClaude(prompt, 3000);
      let quiz;
      try { quiz = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch (e) { return res.status(502).json({ error: "Quiz didn't come back clean — try generating again." }); }
      if (!quiz || !Array.isArray(quiz.questions) || !quiz.questions.length) return res.status(502).json({ error: "No questions generated — try again." });
      return res.status(200).json({ quiz });
    } catch (e) { return res.status(502).json({ error: "AI request failed — try again." }); }
  }

  if (mode === "draft") {
    if (!auth.user.isOwner) return res.status(403).json({ error: "Owner only." });
    if (!title) return res.status(400).json({ error: "Give the guide a title first." });
    const prompt = `You are writing an internal training guide (SOP) for a brand-new employee at The Tire Plug, a busy Los Angeles tire & auto shop.

GUIDE TITLE: ${title}
OWNER'S KEY POINTS: ${bullets || "(none given — use sensible best-practice for a tire shop)"}

Write a clear, simple, step-by-step guide a 19-year-old new hire with no experience can follow. Use short numbered steps and plain language (no corporate fluff). Where relevant, include brief safety notes and customer-service tips. Output ONLY the guide content.`;
    try {
      const draft = await askClaude(prompt, 2000);
      return res.status(200).json({ draft });
    } catch (e) { return res.status(502).json({ error: "AI request failed — try again." }); }
  }

  if (mode === "ask") {
    if (!question) return res.status(400).json({ error: "Ask a question." });
    let modules = [];
    try {
      const { data } = await supabaseAdmin.from("training_modules").select("category, title, content");
      modules = data || [];
    } catch (e) {}
    const kb = modules.map((m) => `## [${m.category}] ${m.title}\n${m.content || ""}`).join("\n\n");
    const prompt = `You are the AI trainer for The Tire Plug. Answer the employee's question using ONLY the company training material below. If the answer isn't covered, say you're not certain and they should ask a manager — do not make up shop-specific policy. Be clear, practical, and encouraging.

TRAINING MATERIAL:
${kb || "(no training material has been added yet)"}

EMPLOYEE QUESTION: ${question}

Answer:`;
    try {
      const answer = await askClaude(prompt, 700);
      return res.status(200).json({ answer });
    } catch (e) { return res.status(502).json({ error: "AI request failed — try again." }); }
  }

  return res.status(400).json({ error: "Unknown mode." });
}
