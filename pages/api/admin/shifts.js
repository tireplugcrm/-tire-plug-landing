/**
 * Scheduling (Phase 4). Owner/Google gated.
 * POST actions:
 *   { action: "list", from, to }                 -> { shifts, staff }  (date range YYYY-MM-DD)
 *   { action: "add", shift: { staff_id, shift_date, start_time, end_time, location, note } }
 *   { action: "delete", id }
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { action } = req.body || {};

  try {
    if (action === "add") {
      const s = req.body.shift || {};
      if (!s.staff_id || !s.shift_date) return res.status(400).json({ error: "Pick a staff member and date." });
      const { error } = await supabaseAdmin.from("shifts").insert({
        staff_id: s.staff_id,
        shift_date: s.shift_date,
        start_time: s.start_time || null,
        end_time: s.end_time || null,
        location: s.location || null,
        note: s.note || null,
      });
      if (error) return res.status(500).json({ error: error.message });
    } else if (action === "delete") {
      const { error } = await supabaseAdmin.from("shifts").delete().eq("id", req.body.id);
      if (error) return res.status(500).json({ error: error.message });
    }

    const from = req.body.from;
    const to = req.body.to;
    let q = supabaseAdmin.from("shifts").select("id, staff_id, shift_date, start_time, end_time, location, note, reminded_at");
    if (from) q = q.gte("shift_date", from);
    if (to) q = q.lte("shift_date", to);
    const { data: shifts, error } = await q.order("shift_date").order("start_time");
    if (error) return res.status(500).json({ error: error.message });

    const { data: staff } = await supabaseAdmin
      .from("staff").select("id, name, location").eq("active", true).order("name");

    return res.status(200).json({ shifts: shifts || [], staff: staff || [] });
  } catch (e) {
    return res.status(500).json({ error: "Server error." });
  }
}
