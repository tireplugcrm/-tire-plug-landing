/**
 * Emilio's Pay Tracker (lib/emilio.js). Two ways in:
 *   - the 4-digit code (Emilio and the owner, /emilio): read only
 *   - admin login (the admin "Emilio pay" tab): read + edit
 *
 * POST { code | admin auth, action: "state", month: "YYYY-MM" }              -> month
 * POST { admin, action: "shift", day, hours, note }                         -> month   (hours 0 = off)
 * POST { admin, action: "addRo", day, ro_number, ro_name, labor, sold }     -> month
 * POST { admin, action: "removeRo", id, month }                             -> month
 * POST { admin, action: "paid", month, amount } / "unpaid"                  -> month
 * POST { demo: true, action: "state", month }                               -> made-up month (previews)
 */
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../lib/adminAuth.js";
import { REP, checkCode, demoState, monthState } from "../../lib/emilio.js";
import { rate } from "../../lib/commission.js";

const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const b = req.body || {};
  if (b.demo) return res.json(demoState(b.month));
  if (!supabaseAdmin) return res.status(500).json({ error: "Database not configured." });

  const admin = (b.password || b.accessToken || req.headers.authorization) ? (await requireAdmin(req)).ok : false;
  if (!admin) {
    const c = await checkCode(String(b.code || ""));
    if (!c.ok) return res.status(401).json({ error: c.error });
    if (b.action !== "state") return res.status(403).json({ error: "Only the owner can change this." });
  }

  const month = String(b.month || (isDay(b.day) ? b.day.slice(0, 7) : "")).slice(0, 7);
  const done = async () => res.json({ ...(await monthState(month)), canEdit: admin });

  if (b.action === "state") return done();

  if (b.action === "shift") {
    if (!isDay(b.day) || ![0, 6].includes(new Date(`${b.day}T12:00:00Z`).getUTCDay())) return res.status(400).json({ error: "Pick a Saturday or Sunday." });
    const hours = Math.max(0, Math.min(16, parseFloat(b.hours) || 0));
    const { error } = await supabaseAdmin.from("rep_shifts").upsert({ rep: REP, day: b.day, hours, note: String(b.note || "").slice(0, 200) || null, updated_at: new Date().toISOString() });
    if (error) return res.status(500).json({ error: error.message });
    return done();
  }

  if (b.action === "addRo") {
    const ro_number = String(b.ro_number || "").replace(/^#/, "").trim();
    if (!isDay(b.day) || !/^\d{1,10}$/.test(ro_number)) return res.status(400).json({ error: "Enter the RO # (numbers only)." });
    const labor = Math.max(0, parseFloat(b.labor) || 0);
    const pct = (await rate()) ?? 0.05;
    const { error } = await supabaseAdmin.from("commission_reports").upsert({
      rep: REP, day: b.day, ro_number, ro_name: String(b.ro_name || "").trim().slice(0, 80),
      status: "matched", labor_total: labor, sold_total: parseFloat(b.sold) || null,
      commission: Math.round(labor * pct * 100) / 100, matched_at: new Date().toISOString(),
    }, { onConflict: "rep,ro_number" });
    if (error) return res.status(500).json({ error: error.message });
    return done();
  }

  if (b.action === "removeRo") {
    const { error } = await supabaseAdmin.from("commission_reports").delete().eq("rep", REP).eq("id", b.id);
    if (error) return res.status(500).json({ error: error.message });
    return done();
  }

  if (b.action === "paid" || b.action === "unpaid") {
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "Which month?" });
    const q = b.action === "paid"
      ? supabaseAdmin.from("rep_payouts").upsert({ rep: REP, month: `${month}-01`, amount: parseFloat(b.amount) || 0, paid_at: new Date().toISOString() })
      : supabaseAdmin.from("rep_payouts").delete().eq("rep", REP).eq("month", `${month}-01`);
    const { error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return done();
  }

  return res.status(400).json({ error: "Unknown action" });
}
