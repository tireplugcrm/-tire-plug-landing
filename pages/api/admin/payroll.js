/**
 * Payroll prep + performance (Phase 5). Owner/Google gated.
 * Pulls together hours (time_punches), pay rate (staff), logged commission/output
 * (service_log), and shifts into one per-person summary for a date range.
 *
 * POST actions:
 *   { action: "summary", from, to }                 -> { rows, from, to }   (YYYY-MM-DD)
 *   { action: "rate", staff_id, rating, perf_notes } -> { ok: true }
 *
 * Note: hours use day boundaries in UTC, so totals at the very edges of a period
 * can be approximate — fine for prep; the owner reviews before paying.
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
    if (action === "rate") {
      const { staff_id, rating, perf_notes } = req.body;
      if (!staff_id) return res.status(400).json({ error: "Missing staff." });
      const patch = {};
      if (rating !== undefined) patch.rating = rating === null ? null : Math.max(1, Math.min(5, Number(rating) || 0)) || null;
      if (perf_notes !== undefined) patch.perf_notes = perf_notes || null;
      const { error } = await supabaseAdmin.from("staff").update(patch).eq("id", staff_id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    // ---- summary ----
    const to = req.body.to || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
    const from = req.body.from || to;
    const fromISO = `${from}T00:00:00.000Z`;
    const toEx = new Date(`${to}T00:00:00.000Z`); toEx.setUTCDate(toEx.getUTCDate() + 1);
    const toISO = toEx.toISOString();

    const { data: staff } = await supabaseAdmin
      .from("staff").select("id, name, hourly_rate, commission_note, rating, perf_notes, active")
      .eq("active", true).order("name");

    const { data: punches } = await supabaseAdmin
      .from("time_punches").select("staff_id, clock_in, clock_out").gte("clock_in", fromISO).lt("clock_in", toISO);
    const { data: logs } = await supabaseAdmin
      .from("service_log").select("staff_id, service_type, qty, amount").gte("logged_at", fromISO).lt("logged_at", toISO);
    const { data: shifts } = await supabaseAdmin
      .from("shifts").select("staff_id, shift_date").gte("shift_date", from).lte("shift_date", to);

    const now = new Date();
    const agg = {};
    const get = (id) => (agg[id] || (agg[id] = { hours: 0, days: new Set(), commission: 0, output: {}, shifts: 0 }));

    for (const p of punches || []) {
      if (!p.staff_id) continue;
      const start = new Date(p.clock_in);
      const end = p.clock_out ? new Date(p.clock_out) : now;
      const hrs = Math.max(0, (end - start) / 3600000);
      const m = get(p.staff_id);
      m.hours += hrs;
      m.days.add(p.clock_in.slice(0, 10));
    }
    for (const l of logs || []) {
      if (!l.staff_id) continue;
      const m = get(l.staff_id);
      m.commission += Number(l.amount) || 0;
      m.output[l.service_type] = (m.output[l.service_type] || 0) + (Number(l.qty) || 0);
    }
    for (const s of shifts || []) {
      if (!s.staff_id) continue;
      get(s.staff_id).shifts += 1;
    }

    const rows = (staff || []).map((s) => {
      const m = agg[s.id] || { hours: 0, days: new Set(), commission: 0, output: {}, shifts: 0 };
      const hours = Math.round(m.hours * 100) / 100;
      const rate = Number(s.hourly_rate) || 0;
      const basePay = Math.round(hours * rate * 100) / 100;
      const commission = Math.round(m.commission * 100) / 100;
      return {
        staff_id: s.id, name: s.name, hourly_rate: rate, commission_note: s.commission_note,
        rating: s.rating || null, perf_notes: s.perf_notes || "",
        hours, base_pay: basePay, commission, total_pay: Math.round((basePay + commission) * 100) / 100,
        days_worked: m.days.size, shifts: m.shifts, output: m.output,
      };
    }).sort((a, b) => b.total_pay - a.total_pay);

    return res.status(200).json({ rows, from, to });
  } catch (e) {
    return res.status(500).json({ error: "Server error." });
  }
}
