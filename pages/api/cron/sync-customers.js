/**
 * Weekly auto customer-sync (Vercel Cron). Keeps the customer list current as
 * new TireBase orders come in — no manual button needed.
 * Auth: Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
 */
import { syncCustomers } from "../../../lib/sync-customers.js";

export const maxDuration = 60;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers.authorization || "") !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!process.env.TIREBASE_API_KEY) return res.status(500).json({ error: "TireBase isn't connected." });
  try {
    // 12-month window keeps recent activity + new customers fresh (the deep
    // history was backfilled once via the master import + initial sync).
    const out = await syncCustomers({ months: 12, store_id: 1 });
    return res.status(200).json({ ok: true, ...out });
  } catch (e) {
    return res.status(502).json({ error: e.message || "Could not reach TireBase." });
  }
}
