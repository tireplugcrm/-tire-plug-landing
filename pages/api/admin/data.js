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
    const [leads, subscribers, campaigns, replies, reminders, unreadTexts] = await Promise.all([
      supabaseAdmin.from("leads").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("subscribers").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("email_campaigns").select("*").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("email_replies").select("*").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("reminders").select("*").eq("done", false).order("due_at", { ascending: true }),
      supabaseAdmin.from("lead_messages").select("lead_id").eq("direction", "inbound").eq("read", false),
    ]);

    // Count unread inbound texts per lead (for a badge on the lead row).
    const unreadByLead = {};
    (unreadTexts.data || []).forEach((m) => { if (m.lead_id) unreadByLead[m.lead_id] = (unreadByLead[m.lead_id] || 0) + 1; });

    return res.status(200).json({
      leads: leads.data || [],
      subscribers: subscribers.data || [],
      campaigns: campaigns.data || [],
      replies: replies.data || [],
      reminders: reminders.data || [],
      unreadByLead,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
