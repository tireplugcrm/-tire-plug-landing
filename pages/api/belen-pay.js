/**
 * Belen's pay tracker: the same calendar as Junior's (lib/junior-pay.js, PAY_REPS.belen), on her
 * work days (Mon-Sat), commission on her ROs only (her hours are in Homebase). Two ways in:
 *   - her 4-digit code (/belen, "My pay" tab): read only
 *   - admin login (the admin Belen tab): read + edit
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
import { PAY_REPS, demoState, monthState, nextMonth } from "../../lib/junior-pay.js";
import { shopDay } from "../../lib/invoices.js";
import { checkStaffCode } from "../../lib/staff-code.js";

const P = PAY_REPS.belen;
const REP = P.rep;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
import { rate } from "../../lib/commission.js";

const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const b = req.body || {};
  if (b.demo) return res.json({ ...demoState(b.month), who: { rep: REP, daysLabel: P.daysLabel, his: P.his, he: P.he, fill: P.fill, days: P.days, commissionOnly: true }, hourly: 0 });
  if (!supabaseAdmin) return res.status(500).json({ error: "Database not configured." });

  const admin = (b.password || b.accessToken || req.headers.authorization) ? (await requireAdmin(req)).ok : false;
  if (!admin) {
    const c = await checkStaffCode("belen", String(b.code || ""));
    if (!c.ok) return res.status(401).json({ error: c.error });
    if (!["state", "reportRo", "bookings"].includes(b.action)) return res.status(403).json({ error: "Only the owner can change this." });
  }

  const month = String(b.month || (isDay(b.day) ? b.day.slice(0, 7) : "")).slice(0, 7);
  const done = async () => res.json({ ...(await monthState(month, "belen")), canEdit: admin });

  if (b.action === "state") return done();

  // She logs an RO (RO # + the name on it), same as her commission tracker: today, waiting for the
  // shop to match it in Tekmetric (labor, then commission).
  if (b.action === "reportRo") {
    const ro_number = String(b.ro_number || "").replace(/^#/, "").trim();
    const ro_name = String(b.ro_name || "").trim().slice(0, 80);
    if (!/^[0-9]{1,10}$/.test(ro_number)) return res.status(400).json({ error: "RO # should be numbers only." });
    if (!ro_name) return res.status(400).json({ error: "Type the name on the RO." });
    const today = shopDay(0);
    const { error } = await supabaseAdmin.from("commission_reports").insert({ day: today, rep: REP, ro_number, ro_name });
    if (error) return res.status(400).json({ error: error.code === "23505" ? `RO #${ro_number} was already logged.` : error.message });
    return res.json({ ...(await monthState(today.slice(0, 7), "belen")), canEdit: admin });
  }

  // Appointments she booked this month (website bookings from her link, or Front Desk bookings
  // with her name), whether they showed, and the commission on the matching RO (by the name on it).
  if (b.action === "bookings") {
    const m = /^[0-9]{4}-[0-9]{2}$/.test(month) ? month : shopDay(0).slice(0, 7);
    const from = `${m}-01`, to = `${nextMonth(m)}-01`;
    const [{ data: leads, error }, { data: ros }] = await Promise.all([
      supabaseAdmin.from("leads").select("id, name, created_at, appointment_at, appt_status, status, service")
        .ilike("raw->>bookedBy", "belen%").gte("created_at", from).lt("created_at", to).order("created_at", { ascending: false }).limit(300),
      supabaseAdmin.from("commission_reports").select("ro_number, ro_name, commission, labor_total, status, day").eq("rep", REP).gte("day", from),
    ]);
    if (error) return res.status(500).json({ error: error.message });
    const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z]/g, "");
    const list = (leads || []).map((l) => {
      const ro = (ros || []).find((r) => norm(r.ro_name) && norm(r.ro_name) === norm(l.name));
      const past = l.appointment_at && new Date(l.appointment_at).getTime() < Date.now();
      const outcome = l.appt_status === "checked_in" || ro ? "showed" : l.appt_status === "canceled" ? "canceled" : l.appt_status === "no_show" ? "no_show" : past ? "unknown" : "upcoming";
      return { id: l.id, name: l.name, booked: l.created_at, at: l.appointment_at, service: l.service, outcome,
        ro: ro ? { ro_number: ro.ro_number, commission: ro.commission != null ? Number(ro.commission) : null, matched: ro.status === "matched" } : null };
    });
    const count = (o) => list.filter((x) => x.outcome === o).length;
    return res.json({ month: m, bookings: list, totals: { booked: list.length, showed: count("showed"), upcoming: count("upcoming"), canceled: count("canceled") + count("no_show"),
      commission: Math.round(list.reduce((t, x) => t + (x.ro?.commission || 0), 0) * 100) / 100 } });
  }

  if (b.action === "shift") {
    if (!isDay(b.day) || !P.days.includes(new Date(`${b.day}T12:00:00Z`).getUTCDay())) return res.status(400).json({ error: `Pick one of her work days (${P.days.map((d) => DAY_NAMES[d]).join(", ")}).` });
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
