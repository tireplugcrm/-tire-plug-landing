/**
 * Belen's field-rep tracker (lib/belen-bonus.js). Two ways in:
 *   - her 4-digit code (/belen): read the month, and log a business she just signed up
 *   - admin login (the admin "Belen" tab): everything below
 *
 * POST { code | admin, action: "state", month }                                      -> month
 * POST { code | admin, action: "addAccount", name, kind, contact, phone, notes, existing? } -> month (existing: admin only)
 * POST { admin, action: "updateAccount", id, patch }                                 -> month
 * POST { admin, action: "removeAccount", id }                                        -> month (and its profit)
 * POST { admin, action: "addProfit", account_id, day, kind, ref, profit, note }      -> month
 * POST { admin, action: "removeProfit", id, month }                                  -> month
 * POST { admin, action: "paid", month, amount } / "unpaid"                           -> month
 * POST { demo: true, action: "state", month }                                        -> made-up month (previews)
 */
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../lib/adminAuth.js";
import { checkStaffCode } from "../../lib/staff-code.js";
import { REP, KINDS, demoState, monthState } from "../../lib/belen-bonus.js";

const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
const clean = (v, n = 120) => (v == null ? null : String(v).trim().slice(0, n) || null);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const b = req.body || {};
  if (b.demo) return res.json(demoState(b.month));
  if (!supabaseAdmin) return res.status(500).json({ error: "Database not configured." });

  const auth = (b.password || b.accessToken || req.headers.authorization) ? await requireAdmin(req) : { ok: false };
  const admin = auth.ok;
  if (!admin) {
    const c = await checkStaffCode("belen", String(b.code || ""));
    if (!c.ok) return res.status(401).json({ error: c.error });
    if (!["state", "addAccount"].includes(b.action)) return res.status(403).json({ error: "Only the owner can change this." });
  }

  const month = String(b.month || (isDay(b.day) ? b.day.slice(0, 7) : "")).slice(0, 7);
  const done = async () => {
    try { return res.json({ ...(await monthState(month)), canEdit: admin, kinds: KINDS }); }
    catch (e) { return res.status(500).json({ error: e.message }); }
  };
  const fail = (error) => res.status(500).json({ error: error.message });

  if (b.action === "state") return done();

  if (b.action === "addAccount") {
    const name = clean(b.name, 80);
    if (!name) return res.status(400).json({ error: "Enter the business name." });
    const { error } = await supabaseAdmin.from("rep_accounts").insert({
      rep: REP, name, kind: KINDS[b.kind] ? b.kind : "fleet", existing: admin ? !!b.existing : false,
      contact: clean(b.contact, 80), phone: clean(b.phone, 30), notes: clean(b.notes, 500),
      signed_on: admin && isDay(b.signed_on) ? b.signed_on : undefined, created_by: admin ? (auth.user?.name || "Owner") : REP,
    });
    if (error) return fail(error);
    return done();
  }

  if (b.action === "updateAccount") {
    const p = b.patch || {}, patch = {};
    if ("name" in p) patch.name = clean(p.name, 80);
    if ("kind" in p && KINDS[p.kind]) patch.kind = p.kind;
    if ("existing" in p) patch.existing = !!p.existing;
    for (const k of ["contact", "phone", "notes"]) if (k in p) patch[k] = clean(p[k], k === "notes" ? 500 : 80);
    for (const k of ["signed_on", "qualified_on"]) if (k in p) patch[k] = isDay(p[k]) ? p[k] : null;
    if (patch.name === null || patch.signed_on === null) return res.status(400).json({ error: "Name and signed date can't be empty." });
    const { error } = await supabaseAdmin.from("rep_accounts").update(patch).eq("rep", REP).eq("id", b.id);
    if (error) return fail(error);
    return done();
  }

  if (b.action === "removeAccount") {
    const { error } = await supabaseAdmin.from("rep_accounts").delete().eq("rep", REP).eq("id", b.id);
    if (error) return fail(error);
    return done();
  }

  if (b.action === "addProfit") {
    const profit = parseFloat(b.profit);
    if (!b.account_id) return res.status(400).json({ error: "Pick the account." });
    if (!isDay(b.day)) return res.status(400).json({ error: "Pick the day it was paid." });
    if (!Number.isFinite(profit)) return res.status(400).json({ error: "Enter the profit in dollars." });
    const { error } = await supabaseAdmin.from("rep_profit").insert({
      rep: REP, account_id: b.account_id, day: b.day, kind: KINDS[b.kind] ? b.kind : "fleet",
      ref: clean(b.ref, 40), profit: Math.round(profit * 100) / 100, note: clean(b.note, 200),
    });
    if (error) return fail(error);
    return done();
  }

  if (b.action === "removeProfit") {
    const { error } = await supabaseAdmin.from("rep_profit").delete().eq("rep", REP).eq("id", b.id);
    if (error) return fail(error);
    return done();
  }

  if (b.action === "paid" || b.action === "unpaid") {
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "Which month?" });
    const q = b.action === "paid"
      ? supabaseAdmin.from("rep_payouts").upsert({ rep: REP, month: `${month}-01`, amount: parseFloat(b.amount) || 0, paid_at: new Date().toISOString() })
      : supabaseAdmin.from("rep_payouts").delete().eq("rep", REP).eq("month", `${month}-01`);
    const { error } = await q;
    if (error) return fail(error);
    return done();
  }

  return res.status(400).json({ error: "Unknown action" });
}
