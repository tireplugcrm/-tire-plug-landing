/**
 * Create / complete / delete reminders for a lead (password gated).
 * action: "create" | "complete" | "delete"
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { password, action, lead_id, due_at, note, kind, id } = req.body || {};
  if (!process.env.CAREERS_ADMIN_PASSWORD || password !== process.env.CAREERS_ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  try {
    if (action === "create") {
      if (!lead_id || !due_at) return res.status(400).json({ error: "Missing lead or date." });
      const { error } = await supabaseAdmin.from("reminders").insert({
        lead_id, due_at, note: note || null,
        kind: kind === "service_ready" ? "service_ready" : "followup",
      });
      if (error) throw error;
    } else if (action === "complete") {
      if (!id) return res.status(400).json({ error: "Missing id." });
      const { error } = await supabaseAdmin.from("reminders").update({ done: true }).eq("id", id);
      if (error) throw error;
    } else if (action === "delete") {
      if (!id) return res.status(400).json({ error: "Missing id." });
      const { error } = await supabaseAdmin.from("reminders").delete().eq("id", id);
      if (error) throw error;
    } else {
      return res.status(400).json({ error: "Unknown action." });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  return res.status(200).json({ success: true });
}
