/**
 * Lexi's Commission Tracker (/lexi?k=<key>). Gated by the key in the link (app_settings.commission_key).
 *
 * POST { k, action: "state" }                    -> { today, reported: [{ ro_number, ro_name, status }] }
 * POST { k, action: "report", ro_number, ro_name } -> { ok }  (saves it, then tries the Tekmetric match)
 */
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { keyOk, matchReport, shopDay } from "../../lib/commission.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Database not configured." });
  const { k, action } = req.body || {};
  if (!(await keyOk(k))) return res.status(401).json({ error: "This link isn't valid. Open it from the text." });
  const today = shopDay(0);

  if (action === "state") {
    const { data } = await supabaseAdmin.from("commission_reports").select("ro_number, ro_name, status").eq("day", today).order("created_at", { ascending: false });
    return res.json({ today, reported: data || [] });
  }

  if (action === "report") {
    const ro_number = String(req.body.ro_number || "").replace(/^#/, "").trim().slice(0, 20);
    const ro_name = String(req.body.ro_name || "").trim().slice(0, 80);
    if (!/^\d+$/.test(ro_number)) return res.status(400).json({ error: "RO # should be numbers only." });
    if (!ro_name) return res.status(400).json({ error: "Type the name on the RO." });
    const { data: row, error } = await supabaseAdmin.from("commission_reports").insert({ day: today, ro_number, ro_name }).select("*").single();
    if (error) return res.status(400).json({ error: error.code === "23505" ? `RO #${ro_number} was already reported.` : error.message });
    await matchReport(row);
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: "Unknown action" });
}
