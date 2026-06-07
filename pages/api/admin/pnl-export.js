/**
 * Download the cumulative weekly P&L workbook (.xlsx). POST { ...auth, start }.
 * Builds Sheet 1 (weekly summary) + one sheet per day from stored invoices + costs.
 */
import { requireAdmin } from "../../../lib/adminAuth.js";
import { getWeek } from "../../../lib/pnl/store.js";
import { buildWorkbook } from "../../../lib/pnl/excel.js";

export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  const start = req.body?.start;
  if (!start) return res.status(400).json({ error: "Missing week start." });
  try {
    const week = await getWeek(start);
    const buf = await buildWorkbook(week);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="TirePlug-PnL-Week-${start}.xlsx"`);
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Export failed." });
  }
}
