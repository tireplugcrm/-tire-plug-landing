/**
 * Update a lead or subscriber (status, owner notes). Password gated.
 * table must be "leads" or "subscribers".
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";

const ALLOWED = {
  leads: { status: ["new", "called", "booked", "dead"], owner_notes: true, quotes: true, revenue: true },
  subscribers: { status: ["active", "unsubscribed"], owner_notes: false },
  email_replies: { read: true },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { password, table, id, status, owner_notes, read, quotes, revenue_amount } = req.body || {};
  if (!process.env.CAREERS_ADMIN_PASSWORD || password !== process.env.CAREERS_ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!supabaseAdmin || !id || !ALLOWED[table]) {
    return res.status(400).json({ error: "Missing config, id, or invalid table." });
  }

  const rules = ALLOWED[table];
  const patch = {};
  if (status !== undefined && rules.status && rules.status.includes(status)) {
    patch.status = status;
    // Stamp the booked time the first time a lead is marked booked.
    if (table === "leads" && status === "booked") patch.booked_at = new Date().toISOString();
  }
  if (owner_notes !== undefined && rules.owner_notes) patch.owner_notes = owner_notes;
  if (read !== undefined && rules.read) patch.read = !!read;
  if (quotes !== undefined && rules.quotes) patch.quotes = quotes;
  if (revenue_amount !== undefined && rules.revenue) {
    patch.revenue_amount = revenue_amount === null || revenue_amount === "" ? null : Number(revenue_amount);
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: "Nothing valid to update." });
  }

  const { error } = await supabaseAdmin.from(table).update(patch).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}
