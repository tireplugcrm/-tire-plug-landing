/**
 * Clock in/out kiosk endpoint (Phase 2). Public, but gated by a shop kiosk code
 * (env KIOSK_CODE) entered once on the shared shop tablet — staff then use only
 * their 4-digit PIN day-to-day.
 *
 * POST { kioskCode, pin } -> { name, action: "in"|"out", time, hours? }
 *
 * Toggle logic: if the staff member has an open punch (clock_out null) they get
 * clocked OUT; otherwise a new clock-IN row is created.
 */
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Not configured." });

  const { kioskCode, pin } = req.body || {};
  if (!process.env.KIOSK_CODE) return res.status(500).json({ error: "Kiosk code not set up yet." });
  if (!kioskCode || kioskCode !== process.env.KIOSK_CODE) return res.status(401).json({ error: "Wrong kiosk code." });
  if (!pin || !String(pin).trim()) return res.status(400).json({ error: "Enter your PIN." });

  // Find the active staff member with this PIN.
  const { data: matches } = await supabaseAdmin
    .from("staff").select("id, name, location, active, pin").eq("pin", String(pin).trim()).eq("active", true).limit(1);
  const staff = matches && matches[0];
  if (!staff) return res.status(404).json({ error: "PIN not recognized." });

  // Is there an open punch? -> clock out. Otherwise clock in.
  const { data: openRows } = await supabaseAdmin
    .from("time_punches").select("id, clock_in").eq("staff_id", staff.id).is("clock_out", null)
    .order("clock_in", { ascending: false }).limit(1);
  const open = openRows && openRows[0];

  const now = new Date();
  if (open) {
    const { error } = await supabaseAdmin.from("time_punches").update({ clock_out: now.toISOString() }).eq("id", open.id);
    if (error) return res.status(500).json({ error: "Could not clock out." });
    const hours = Math.round(((now - new Date(open.clock_in)) / 3600000) * 100) / 100;
    return res.status(200).json({ name: staff.name, action: "out", time: now.toISOString(), hours });
  }

  const { error } = await supabaseAdmin.from("time_punches").insert({
    staff_id: staff.id, clock_in: now.toISOString(), location: staff.location || null,
  });
  if (error) return res.status(500).json({ error: "Could not clock in." });
  return res.status(200).json({ name: staff.name, action: "in", time: now.toISOString() });
}
