/**
 * Tekmetric -> Lexi's Commission Tracker, while the Tekmetric API isn't connected.
 * Whoever has Tekmetric open (Claude in the signed-in browser) posts the shop's posted ROs here:
 * ROs she reported get their lines, labor and commission; ROs where Lexy is the service writer but
 * she didn't report them are added and flagged. Everything else is ignored.
 *
 * POST { ros: [{ ro_number, day, customer, writer_id, writer, lines, total, labor }] }
 *   Auth: "Authorization: Bearer <app_settings commission_cron_key>"  -> { matched, added, flagged }
 */
import crypto from "crypto";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { applyMatch, setting } from "../../lib/commission.js";

export const maxDuration = 60;

const same = (a, b) => !!a && !!b && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Database not configured." });
  const key = await setting("commission_cron_key");
  if (!(key.length >= 32 && same((req.headers.authorization || "").replace(/^Bearer\s+/i, ""), key))) return res.status(401).json({ error: "Unauthorized" });

  const ros = Array.isArray(req.body?.ros) ? req.body.ros : [];
  const lexiId = String(await setting("commission_writer_id"));
  const nums = ros.map((r) => String(r.ro_number));
  const { data: reports } = await supabaseAdmin.from("commission_reports").select("*").eq("rep", "Lexi").in("ro_number", nums.length ? nums : ["-"]);
  const byNum = new Map((reports || []).map((r) => [r.ro_number, r]));

  let matched = 0, added = 0, flagged = 0;
  for (const ro of ros) {
    const row = byNum.get(String(ro.ro_number)) || null;
    if (!row && String(ro.writer_id || "") !== lexiId) continue;
    const out = await applyMatch(row, ro);
    if (row) matched++; else added++;
    if (out?.notes) flagged++;
  }
  return res.json({ matched, added, flagged });
}
