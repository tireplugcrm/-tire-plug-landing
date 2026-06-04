/**
 * Daily auto review-request loop (Vercel Cron). Asks recent customers for a
 * Google review automatically (gated by the 'auto_reviews' toggle).
 * Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
 */
import { runAutoReviewRequests } from "../../../lib/auto-reviews.js";

export const maxDuration = 60;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers.authorization || "") !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const out = await runAutoReviewRequests({ days: 45, max: 40 });
    return res.status(200).json({ ok: true, ...out });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
