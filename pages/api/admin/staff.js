/**
 * Staff roster (People/HR). Owner/Google gated.
 * POST actions:
 *   { action: "list" }                       -> { staff: [...] }
 *   { action: "save", staff: {...} }          -> upsert, returns refreshed roster
 *   { action: "setActive", id, active }       -> toggle active, returns roster
 *
 * Foundation for scheduling, clock-in, payroll, and performance.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { action, staff } = req.body || {};

  try {
    if (action === "save") {
      if (!staff || !staff.name || !staff.name.trim()) {
        return res.status(400).json({ error: "Name is required." });
      }
      const row = {
        name: staff.name.trim(),
        role: staff.role || null,
        location: staff.location || null,
        phone: staff.phone || null,
        pay_type: staff.pay_type || "hourly_commission",
        hourly_rate: staff.hourly_rate !== "" && staff.hourly_rate != null ? Number(staff.hourly_rate) || 0 : 0,
        commission_note: staff.commission_note || null,
        pin: staff.pin || null,
        active: staff.active !== false,
      };
      if (staff.id) {
        const { error } = await supabaseAdmin.from("staff").update(row).eq("id", staff.id);
        if (error) return res.status(500).json({ error: error.message });
      } else {
        const { error } = await supabaseAdmin.from("staff").insert(row);
        if (error) return res.status(500).json({ error: error.message });
      }
    } else if (action === "setActive") {
      const { error } = await supabaseAdmin.from("staff").update({ active: !!req.body.active }).eq("id", req.body.id);
      if (error) return res.status(500).json({ error: error.message });
    }

    // Always return the current roster (active first, then by name).
    const { data, error } = await supabaseAdmin
      .from("staff").select("*")
      .order("active", { ascending: false })
      .order("name", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    // Enrich with live clock status + today's hours (from time_punches).
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const { data: punches } = await supabaseAdmin
      .from("time_punches").select("staff_id, clock_in, clock_out")
      .gte("clock_in", startOfDay.toISOString());
    const byStaff = {};
    for (const p of punches || []) {
      const m = byStaff[p.staff_id] || (byStaff[p.staff_id] = { hours: 0, open: false });
      const end = p.clock_out ? new Date(p.clock_out) : new Date();
      m.hours += Math.max(0, (end - new Date(p.clock_in)) / 3600000);
      if (!p.clock_out) m.open = true;
    }
    const enriched = (data || []).map((s) => ({
      ...s,
      clocked_in: !!(byStaff[s.id] && byStaff[s.id].open),
      today_hours: Math.round(((byStaff[s.id] && byStaff[s.id].hours) || 0) * 10) / 10,
    }));
    return res.status(200).json({ staff: enriched });
  } catch (e) {
    return res.status(500).json({ error: "Server error." });
  }
}
