/**
 * Tire picker for the Shop Floor: search what's on our shelf (same stock as the website).
 * POST { q } -> { tires: [{ brand, model, size, img, logo, level, count }] }. Owner/Google gated.
 */
import { requireAdmin } from "../../../lib/adminAuth.js";
import { searchShelf } from "../../../lib/shelf-search.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  try {
    return res.status(200).json({ tires: await searchShelf(req.body?.q) });
  } catch (e) {
    return res.status(500).json({ error: "Could not search the shelf." });
  }
}
