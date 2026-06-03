/**
 * Customer list + segments for the reactivation engine. Owner/Google gated.
 * POST actions:
 *   { action: "list" }   -> { customers (with segments), counts, avgTicket, duePotential }
 *   { action: "setFlag", id, is_commercial?, sms_opt_in?, email?, notes? }
 *   { action: "applySuggested" }  -> mark all auto-detected commercial accounts as commercial
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";

function daysAgoYmd(days) {
  const d = new Date(); d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { action } = req.body || {};

  try {
    if (action === "setFlag") {
      const patch = {};
      ["is_commercial", "sms_opt_in"].forEach((k) => { if (req.body[k] !== undefined) patch[k] = !!req.body[k]; });
      if (req.body.email !== undefined) patch.email = req.body.email || null;
      if (req.body.notes !== undefined) patch.notes = req.body.notes || null;
      if (!Object.keys(patch).length) return res.status(400).json({ error: "Nothing to update." });
      const { error } = await supabaseAdmin.from("customers").update(patch).eq("id", req.body.id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }
    if (action === "applySuggested") {
      const { error } = await supabaseAdmin.from("customers").update({ is_commercial: true }).eq("commercial_suggested", true);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    // list
    const { data, error } = await supabaseAdmin.from("customers").select("*").order("total_spent", { ascending: false }).limit(5000);
    if (error) return res.status(500).json({ error: error.message });

    const tire3y = daysAgoYmd(365 * 3);
    const lapsed1y = daysAgoYmd(365);
    const recent45 = daysAgoYmd(45);
    const VIP_MIN = 1500;

    let spendSum = 0, orderSum = 0;
    const customers = (data || []).map((c) => {
      spendSum += Number(c.total_spent) || 0;
      orderSum += Number(c.order_count) || 0;
      const segments = [];
      if (c.last_tire_date && c.last_tire_date < tire3y) segments.push("due_tires");
      if (c.last_visit && c.last_visit < lapsed1y) segments.push("lapsed");
      if (c.last_visit && c.last_visit >= recent45) segments.push("recent");
      if ((Number(c.total_spent) || 0) >= VIP_MIN) segments.push("vip");
      if (c.is_commercial) segments.push("commercial");
      return { ...c, segments };
    });

    const counts = { all: customers.length, due_tires: 0, lapsed: 0, recent: 0, vip: 0, commercial: 0, suggested: 0 };
    for (const c of customers) {
      c.segments.forEach((s) => { counts[s] = (counts[s] || 0) + 1; });
      if (c.commercial_suggested && !c.is_commercial) counts.suggested += 1;
    }
    const avgTicket = orderSum ? Math.round(spendSum / orderSum) : 0;
    const duePotential = counts.due_tires * avgTicket;

    return res.status(200).json({ customers, counts, avgTicket, duePotential });
  } catch (e) {
    return res.status(500).json({ error: "Server error." });
  }
}
