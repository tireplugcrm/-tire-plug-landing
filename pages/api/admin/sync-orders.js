/**
 * Manual "Sync TireBase orders" — match finalized orders to active leads (mark won).
 * Owner/Google gated. POST { store_id } -> { closed, scanned, names }
 */
import { requireAdmin } from "../../../lib/adminAuth.js";
import { convertFinalizedOrders } from "../../../lib/sync-orders-core.js";

export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!process.env.TIREBASE_API_KEY) return res.status(500).json({ error: "TireBase isn't connected." });
  try {
    const out = await convertFinalizedOrders({ store_id: (req.body && req.body.store_id) || 1 });
    return res.status(200).json(out);
  } catch (e) {
    return res.status(502).json({ error: e.message || "Could not reach TireBase." });
  }
}
