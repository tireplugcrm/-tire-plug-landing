/**
 * Daily send of scheduled email blasts (Vercel Cron, 9 AM Pacific).
 * Sends every campaign whose status is "scheduled" and whose send_at has passed.
 * Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { deliverCampaign } from "../../../lib/email-campaigns.js";

export const maxDuration = 60;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers.authorization || "") !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const { data: due } = await supabaseAdmin.from("email_campaigns").select("*")
      .eq("status", "scheduled").lte("send_at", new Date().toISOString()).order("send_at");
    const results = [];
    for (const row of due || []) results.push({ id: row.id, ...(await deliverCampaign(row)) });
    return res.status(200).json({ ok: true, sent: results });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
