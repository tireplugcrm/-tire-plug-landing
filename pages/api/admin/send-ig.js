/**
 * Send an Instagram DM to a lead (password/Google gated) and log it.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { sendIgMessage } from "../../../lib/instagram.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });

  const { lead_id, body } = req.body || {};
  if (!supabaseAdmin || !lead_id) return res.status(400).json({ error: "Missing config or lead." });
  if (!body || !body.trim()) return res.status(400).json({ error: "Message is empty." });

  const { data: lead } = await supabaseAdmin.from("leads").select("ig_user_id").eq("id", lead_id).single();
  if (!lead || !lead.ig_user_id) return res.status(400).json({ error: "This lead isn't an Instagram conversation." });

  const result = await sendIgMessage({ igUserId: lead.ig_user_id, text: body });
  if (!result.ok) return res.status(502).json({ error: result.error });

  await supabaseAdmin.from("lead_messages").insert({
    lead_id,
    direction: "outbound",
    channel: "instagram",
    body,
    status: "sent",
    read: true,
  });

  return res.status(200).json({ success: true });
}
