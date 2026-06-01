/**
 * Fetch the SMS conversation for one lead (password gated).
 * Also marks inbound messages as read.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  const { lead_id } = req.body || {};
  if (!supabaseAdmin || !lead_id) return res.status(400).json({ error: "Missing config or lead." });

  const { data, error } = await supabaseAdmin
    .from("lead_messages")
    .select("*")
    .eq("lead_id", lead_id)
    .order("created_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Mark inbound as read (fire and forget)
  supabaseAdmin.from("lead_messages").update({ read: true }).eq("lead_id", lead_id).eq("direction", "inbound").then(() => {});

  return res.status(200).json({ messages: data || [] });
}
