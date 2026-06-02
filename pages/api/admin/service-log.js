/**
 * Per-rep work log (Phase 3 attribution). Owner/Google gated.
 * Captures who did what (alignments, tires, leads handled, etc.) since TireBase
 * doesn't record the salesperson. Feeds performance + commission.
 *
 * POST actions:
 *   { action: "list", days? }                          -> { entries, staff, sinceDays }
 *   { action: "add", entry: { staff_id, service_type, qty, amount, note } }
 *   { action: "delete", id }
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";

const TYPES = ["tire", "alignment", "tpms", "oil", "brake", "lead", "other"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { action } = req.body || {};

  try {
    if (action === "add") {
      const e = req.body.entry || {};
      if (!e.staff_id) return res.status(400).json({ error: "Pick a staff member." });
      if (!TYPES.includes(e.service_type)) return res.status(400).json({ error: "Pick a service type." });
      const row = {
        staff_id: e.staff_id,
        service_type: e.service_type,
        qty: e.qty !== "" && e.qty != null ? Number(e.qty) || 1 : 1,
        amount: e.amount !== "" && e.amount != null ? Number(e.amount) : null,
        note: e.note || null,
      };
      const { error } = await supabaseAdmin.from("service_log").insert(row);
      if (error) return res.status(500).json({ error: error.message });
    } else if (action === "delete") {
      const { error } = await supabaseAdmin.from("service_log").delete().eq("id", req.body.id);
      if (error) return res.status(500).json({ error: error.message });
    }

    // List: entries in the window (default today) + the active roster for the picker.
    const days = Math.max(0, Number(req.body.days) || 0);
    const since = new Date();
    if (days > 0) since.setDate(since.getDate() - days);
    else since.setHours(0, 0, 0, 0);

    const { data: entries, error: e1 } = await supabaseAdmin
      .from("service_log").select("id, staff_id, service_type, qty, amount, note, logged_at")
      .gte("logged_at", since.toISOString())
      .order("logged_at", { ascending: false });
    if (e1) return res.status(500).json({ error: e1.message });

    const { data: staff } = await supabaseAdmin
      .from("staff").select("id, name, commission_note").eq("active", true).order("name");

    return res.status(200).json({ entries: entries || [], staff: staff || [], sinceDays: days });
  } catch (e) {
    return res.status(500).json({ error: "Server error." });
  }
}
