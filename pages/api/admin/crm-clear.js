/**
 * Admin → CRM "Clear board": takes cards off the board by stamping crm_closed_at, or puts them
 * back ({ undo: true }). The leads themselves aren't touched, and a customer reply after the
 * stamp brings the card back on its own.
 *
 * POST { ids: [...], undo? } -> { ok, count }
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";

const CHUNK = 100;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Database not configured." });

  const { ids, undo } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: "No cards to clear." });

  const crm_closed_at = undo ? null : new Date().toISOString();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await supabaseAdmin.from("leads").update({ crm_closed_at }).in("id", ids.slice(i, i + CHUNK));
    if (error) return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ ok: true, count: ids.length });
}
