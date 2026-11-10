/**
 * Staff to-do lists for the admin ("Belen's to-do"). Owner/Google gated.
 *
 * The list's words live in Supabase (app_settings key `todo_<who>`), not in this public repo,
 * so vendor names and shop notes stay private. Ticks are shared: everyone signed in to the
 * admin sees the same boxes checked.
 *
 * POST actions:
 *   { action: "get",  who }                 -> { text, done, updated_at, updated_by }
 *   { action: "save", who, text }           -> the same, after replacing the words
 *   { action: "tick", who, item, checked }  -> the same, after ticking / unticking one item
 *   { action: "reset", who }                -> the same, with every box unticked (start a new day)
 *
 * Ticks are keyed by the item's words, so editing the list keeps the ticks on unchanged items.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";

const WHO = /^[a-z]{2,20}$/;

async function load(who) {
  const { data } = await supabaseAdmin.from("app_settings").select("value, updated_at").eq("key", `todo_${who}`).maybeSingle();
  let v = {};
  try { v = data?.value ? JSON.parse(data.value) : {}; } catch { v = { text: String(data.value || "") }; }
  return { text: v.text || "", done: Array.isArray(v.done) ? v.done : [], updated_at: data?.updated_at || null, updated_by: v.updated_by || null };
}

async function store(who, v, user) {
  const value = JSON.stringify({ text: v.text, done: v.done, updated_by: user?.name || user?.email || null });
  const updated_at = new Date().toISOString();
  const { error } = await supabaseAdmin.from("app_settings").upsert({ key: `todo_${who}`, value, updated_at }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return { ...v, updated_at, updated_by: user?.name || user?.email || null };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { action, who = "belen" } = req.body || {};
  if (!WHO.test(who)) return res.status(400).json({ error: "Bad list name." });

  try {
    const cur = await load(who);
    if (action === "get") return res.status(200).json(cur);
    if (action === "save") {
      const text = String(req.body.text || "").slice(0, 20000);
      return res.status(200).json(await store(who, { text, done: cur.done }, auth.user));
    }
    if (action === "tick") {
      const item = String(req.body.item || "").slice(0, 500);
      if (!item) return res.status(400).json({ error: "Missing item." });
      const done = new Set(cur.done);
      if (req.body.checked) done.add(item); else done.delete(item);
      return res.status(200).json(await store(who, { text: cur.text, done: [...done] }, auth.user));
    }
    if (action === "reset") return res.status(200).json(await store(who, { text: cur.text, done: [] }, auth.user));
    return res.status(400).json({ error: "Unknown action." });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Failed" });
  }
}
