/**
 * Unified admin dashboard — load all CRM data (password gated).
 * Returns leads, subscribers, recent campaigns, and inbound replies.
 * Reuses the same CAREERS_ADMIN_PASSWORD as the hiring dashboard.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { password } = req.body || {};
  if (!process.env.CAREERS_ADMIN_PASSWORD || password !== process.env.CAREERS_ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  try {
    const [leads, subscribers, campaigns, replies] = await Promise.all([
      supabaseAdmin.from("leads").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("subscribers").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("email_campaigns").select("*").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("email_replies").select("*").order("created_at", { ascending: false }).limit(200),
    ]);

    return res.status(200).json({
      leads: leads.data || [],
      subscribers: subscribers.data || [],
      campaigns: campaigns.data || [],
      replies: replies.data || [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
