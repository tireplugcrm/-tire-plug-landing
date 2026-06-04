/**
 * Daily auto-scan of TireBase orders → convert matching leads to Won.
 * This is the "AI checks if a cold lead finalized their order" step.
 * Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
 */
import { convertFinalizedOrders } from "../../../lib/sync-orders-core.js";

export const maxDuration = 30;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers.authorization || "") !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!process.env.TIREBASE_API_KEY) return res.status(500).json({ error: "TireBase isn't connected." });
  try {
    const out = await convertFinalizedOrders({ store_id: 1 });
    return res.status(200).json({ ok: true, ...out });
  } catch (e) {
    return res.status(502).json({ error: e.message || "Could not reach TireBase." });
  }
}
