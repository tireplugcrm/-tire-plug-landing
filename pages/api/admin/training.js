/**
 * Training hub data.
 *  list        — modules + my progress (quiz answers hidden from non-owners)
 *  complete    — mark a no-quiz guide done
 *  get-quiz    — questions WITHOUT answers, for taking the quiz
 *  submit-quiz — grade server-side, save score/passed/time/attempts
 *  save/delete — owner only (modules incl. quiz)
 *  report      — owner only: everyone's grades
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";

const PASS = 80; // % to pass

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { action } = req.body || {};
  const email = auth.user.email;
  const isOwner = !!auth.user.isOwner;

  if (action === "list") {
    const { data: modules } = await supabaseAdmin.from("training_modules").select("*").order("category").order("sort");
    const { data: prog } = await supabaseAdmin.from("training_progress").select("*").eq("email", email);
    const progress = {};
    (prog || []).forEach((p) => { progress[p.module_id] = { score: p.score, passed: p.passed, time: p.time_spent_seconds, attempts: p.attempts }; });
    const out = (modules || []).map((m) => {
      const q = m.quiz && Array.isArray(m.quiz.questions) ? m.quiz.questions : [];
      const base = { id: m.id, category: m.category, title: m.title, content: m.content, sort: m.sort, hasQuiz: q.length > 0, quizCount: q.length };
      if (isOwner) base.quiz = m.quiz || null; // owners can review/edit the quiz
      return base;
    });
    return res.status(200).json({ modules: out, progress, isOwner });
  }

  if (action === "complete") {
    const { module_id, done } = req.body || {};
    if (!module_id) return res.status(400).json({ error: "Missing module." });
    if (done === false) await supabaseAdmin.from("training_progress").delete().eq("email", email).eq("module_id", module_id);
    else await supabaseAdmin.from("training_progress").upsert({ email, module_id, passed: true, score: 100, completed_at: new Date().toISOString() }, { onConflict: "email,module_id" });
    return res.status(200).json({ success: true });
  }

  if (action === "get-quiz") {
    const { module_id } = req.body || {};
    const { data: m } = await supabaseAdmin.from("training_modules").select("quiz, title").eq("id", module_id).single();
    const q = m && m.quiz && Array.isArray(m.quiz.questions) ? m.quiz.questions : [];
    // strip the answers
    return res.status(200).json({ title: m && m.title, questions: q.map((x) => ({ q: x.q, options: x.options })) });
  }

  if (action === "submit-quiz") {
    const { module_id, answers, time_spent } = req.body || {};
    const { data: m } = await supabaseAdmin.from("training_modules").select("quiz").eq("id", module_id).single();
    const questions = m && m.quiz && Array.isArray(m.quiz.questions) ? m.quiz.questions : [];
    if (!questions.length) return res.status(400).json({ error: "No quiz on this guide." });
    let correct = 0;
    const results = questions.map((q, i) => {
      const ok = Number((answers || [])[i]) === Number(q.answer);
      if (ok) correct += 1;
      return { correct: ok, correctIndex: q.answer };
    });
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= PASS;

    const { data: existing } = await supabaseAdmin.from("training_progress").select("*").eq("email", email).eq("module_id", module_id).single();
    await supabaseAdmin.from("training_progress").upsert({
      email, module_id,
      score: existing ? Math.max(existing.score || 0, score) : score,
      passed: (existing && existing.passed) || passed,
      attempts: (existing ? existing.attempts || 0 : 0) + 1,
      time_spent_seconds: (existing ? existing.time_spent_seconds || 0 : 0) + (Number(time_spent) || 0),
      completed_at: passed ? new Date().toISOString() : (existing ? existing.completed_at : null),
    }, { onConflict: "email,module_id" });

    return res.status(200).json({ score, correct, total: questions.length, passed, pass: PASS, results });
  }

  // ---- owner only ----
  if (!isOwner) return res.status(403).json({ error: "Owner only." });

  if (action === "save") {
    const { id, category, title, content, sort, quiz } = req.body || {};
    if (!category || !title) return res.status(400).json({ error: "Category and title required." });
    const row = { category, title, content: content || "", sort: sort || 0, updated_at: new Date().toISOString() };
    if (quiz !== undefined) row.quiz = quiz;
    if (id) await supabaseAdmin.from("training_modules").update(row).eq("id", id);
    else await supabaseAdmin.from("training_modules").insert(row);
    return res.status(200).json({ success: true });
  }

  if (action === "delete") {
    if (!req.body.id) return res.status(400).json({ error: "Missing id." });
    await supabaseAdmin.from("training_modules").delete().eq("id", req.body.id);
    return res.status(200).json({ success: true });
  }

  if (action === "report") {
    const { data: modules } = await supabaseAdmin.from("training_modules").select("id, title");
    const { data: prog } = await supabaseAdmin.from("training_progress").select("email, module_id, score, passed, time_spent_seconds, attempts");
    return res.status(200).json({ modules: modules || [], progress: prog || [] });
  }

  return res.status(400).json({ error: "Unknown action." });
}
