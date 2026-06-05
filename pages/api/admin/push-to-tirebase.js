/**
 * Push a CRM lead's saved quote into TireBase as a Quote order.
 * POST { ...auth, lead_id }  ->  { ok, order_id, customer_id, created_customer, lines }
 *
 * Flow: load lead -> find customer by phone (create if missing) -> build generic
 * order lines from the quote -> createOrder(order_status_id = Quote). Records
 * tirebase_quote_id / tirebase_pushed_at on the lead so we can show "Pushed ✓".
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { findCustomerByPhone, createCustomer, buildOrderLines, createQuoteOrder } from "../../../lib/tirebase-write.js";

export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { lead_id } = req.body || {};
  if (!lead_id) return res.status(400).json({ error: "Missing lead_id." });

  try {
    const { data: lead, error } = await supabaseAdmin.from("leads").select("*").eq("id", lead_id).single();
    if (error || !lead) return res.status(404).json({ error: "Lead not found." });
    if (!lead.phone) return res.status(400).json({ error: "Lead has no phone number — can't match a TireBase customer." });

    const { lines, notesText } = buildOrderLines({
      quotes: lead.quotes,
      road_hazard_per_tire: lead.road_hazard_per_tire,
      services: lead.services,
    });
    if (!lines.length) return res.status(400).json({ error: "Save a quote with at least one priced line first." });

    // Find or create the TireBase customer.
    let customer_id = await findCustomerByPhone(lead.phone);
    let created_customer = false;
    if (!customer_id) {
      customer_id = await createCustomer({ name: lead.name, phone: lead.phone, email: lead.email, isCommercial: !!lead.is_commercial });
      created_customer = true;
    }

    const notes = `Quote from The Tire Plug CRM${lead.name ? ` for ${lead.name}` : ""}.\n${notesText}`;
    const order_id = await createQuoteOrder({ customer_id, lines, notes });

    // Best-effort: record on the lead (ignore if columns don't exist yet).
    try {
      await supabaseAdmin.from("leads").update({ tirebase_quote_id: String(order_id), tirebase_pushed_at: new Date().toISOString() }).eq("id", lead_id);
    } catch (e) { /* columns optional */ }

    return res.status(200).json({ ok: true, order_id, customer_id, created_customer, lines: lines.length });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Push failed." });
  }
}
