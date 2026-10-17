/**
 * Pricing autopilot (lib/pricing.js autopilot): stock sync, price rules, page rebuilds, live-site
 * checks, alerts, the morning report. Called every 10 min by Supabase pg_cron (lib/pricing-schema.sql)
 * and daily by Vercel Cron, which also texts the owner if the 10-minute schedule has stopped.
 * Both send "Authorization: Bearer <CRON_SECRET>".
 */
import { autopilot, checkSchedule } from "../../../lib/pricing.js";
import { pricingContext } from "../../../lib/pricing-context.js";

export const maxDuration = 60;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers.authorization || "") !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const ctx = pricingContext();
  if (!ctx.db) return res.status(500).json({ error: "Supabase not configured." });
  try {
    // Vercel's daily run checks the 10-minute schedule before it runs itself.
    const scheduleOk = (req.headers["user-agent"] || "").includes("vercel-cron") ? await checkSchedule(ctx) : null;
    const report = await autopilot(ctx, (path) => res.revalidate(path), { budgetMs: 45000 });
    return res.status(200).json({ ...report, scheduleOk });
  } catch (e) {
    console.error("pricing autopilot:", e);
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
