/**
 * Pricing autopilot (lib/pricing.js autopilot): stock sync, price rules, page rebuilds, live-site
 * checks, alerts, the morning report. Called daily by Vercel Cron ("Authorization: Bearer
 * <CRON_SECRET>"), which also texts the owner if the 10-minute schedule has stopped, and every
 * 10 min by Supabase pg_cron, which sends the random key stored in app_settings 'pricing_cron_key'
 * (generated inside the database, so it never has to be copied anywhere; see lib/pricing-schema.sql).
 */
import crypto from "node:crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { autopilot, checkSchedule } from "../../../lib/pricing.js";
import { pricingContext } from "../../../lib/pricing-context.js";

export const maxDuration = 60;

const same = (a, b) => !!a && !!b && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function authorized(req) {
  const got = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!got) return false;
  if (same(got, process.env.CRON_SECRET || "")) return true;
  if (!supabaseAdmin) return false;
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "pricing_cron_key").maybeSingle();
  return (data?.value || "").length >= 32 && same(got, data.value);
}

export default async function handler(req, res) {
  if (!(await authorized(req))) return res.status(401).json({ error: "Unauthorized" });
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
