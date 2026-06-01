/**
 * Live company scoreboard — real TireBase order data for a day, aggregated.
 * Password/Google gated. Uses lib/tirebase.js.
 */
import { requireAdmin } from "../../../lib/adminAuth.js";
import { fetchDayScoreboard } from "../../../lib/tirebase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });

  const { date, store_id = 1 } = req.body || {};
  try {
    const sb = await fetchDayScoreboard({ date, store_id });
    return res.status(200).json(sb);
  } catch (e) {
    return res.status(502).json({ error: e.message || "Could not reach TireBase." });
  }
}
