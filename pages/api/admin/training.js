/**
 * Training hub data. list / complete (any approved user); save / delete (owner only).
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { action } = req.body || {};
  const email = auth.user.email;

  if (action === "list") {
    const { data: modules } = await supabaseAdmin.from("training_modules").select("*").order("category").order("sort");
    const { data: prog } = await supabaseAdmin.from("training_progress").select("module_id, completed_at").eq("email", email);
    const progress = {};
    (prog || []).forEach((p) => { progress[p.module_id] = p.completed_at; });
    return res.status(200).json({ modules: modules || [], progress, isOwner: !!auth.user.isOwner });
  }

  if (action === "complete") {
    const { module_id, done } = req.body || {};
    if (!module_id) return res.status(400).json({ error: "Missing module." });
    if (done === false) {
      await supabaseAdmin.from("training_progress").delete().eq("email", email).eq("module_id", module_id);
    } else {
      await supabaseAdmin.from("training_progress").upsert(
        { email, module_id, completed_at: new Date().toISOString() }, { onConflict: "email,module_id" });
    }
    return res.status(200).json({ success: true });
  }

  // --- owner only below ---
  if (!auth.user.isOwner) return res.status(403).json({ error: "Owner only." });

  if (action === "save") {
    const { id, category, title, content, sort } = req.body || {};
    if (!category || !title) return res.status(400).json({ error: "Category and title required." });
    if (id) {
      await supabaseAdmin.from("training_modules").update({ category, title, content: content || "", sort: sort || 0, updated_at: new Date().toISOString() }).eq("id", id);
    } else {
      await supabaseAdmin.from("training_modules").insert({ category, title, content: content || "", sort: sort || 0 });
    }
    return res.status(200).json({ success: true });
  }

  if (action === "delete") {
    if (!req.body.id) return res.status(400).json({ error: "Missing id." });
    await supabaseAdmin.from("training_modules").delete().eq("id", req.body.id);
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: "Unknown action." });
}
