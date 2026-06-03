/**
 * Shop Floor / Work Orders board. Owner/Google gated.
 * POST actions:
 *   { action: "list" }                       -> { orders (active), staff }
 *   { action: "create", order }              -> add a job (status waiting)
 *   { action: "setStatus", id, status }      -> waiting | in_bay | done (stamps times)
 *   { action: "assign", id, assigned_staff_id }
 *   { action: "archive", id }                -> clear from the board
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";

const STATUSES = ["waiting", "in_bay", "done"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { action } = req.body || {};

  try {
    if (action === "create") {
      const o = req.body.order || {};
      if (!o.customer_name && !o.vehicle) return res.status(400).json({ error: "Add a customer name or vehicle." });
      const { error } = await supabaseAdmin.from("work_orders").insert({
        customer_name: o.customer_name || null, phone: o.phone || null, vehicle: o.vehicle || null,
        service: o.service || null, location: o.location || null,
        assigned_staff_id: o.assigned_staff_id || null, note: o.note || null, status: "waiting",
      });
      if (error) return res.status(500).json({ error: error.message });
    } else if (action === "setStatus") {
      const status = STATUSES.includes(req.body.status) ? req.body.status : null;
      if (!status) return res.status(400).json({ error: "Bad status." });
      const patch = { status };
      if (status === "in_bay") patch.started_at = new Date().toISOString();
      if (status === "done") patch.done_at = new Date().toISOString();
      const { error } = await supabaseAdmin.from("work_orders").update(patch).eq("id", req.body.id);
      if (error) return res.status(500).json({ error: error.message });
    } else if (action === "assign") {
      const { error } = await supabaseAdmin.from("work_orders").update({ assigned_staff_id: req.body.assigned_staff_id || null }).eq("id", req.body.id);
      if (error) return res.status(500).json({ error: error.message });
    } else if (action === "archive") {
      const { error } = await supabaseAdmin.from("work_orders").update({ archived: true }).eq("id", req.body.id);
      if (error) return res.status(500).json({ error: error.message });
    }

    const { data: orders, error } = await supabaseAdmin
      .from("work_orders").select("*").eq("archived", false).order("created_at", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    const { data: staff } = await supabaseAdmin.from("staff").select("id, name").eq("active", true).order("name");

    return res.status(200).json({ orders: orders || [], staff: staff || [] });
  } catch (e) {
    return res.status(500).json({ error: "Server error." });
  }
}
