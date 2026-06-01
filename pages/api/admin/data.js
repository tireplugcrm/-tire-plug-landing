/**
 * Unified admin dashboard — load all CRM data (password gated).
 * Returns leads, subscribers, recent campaigns, and inbound replies.
 * Reuses the same CAREERS_ADMIN_PASSWORD as the hiring dashboard.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  // Mark the signed-in Google user as active right now.
  if (auth.user.email && auth.user.email !== "owner") {
    await supabaseAdmin.from("team_access").update({ last_active: new Date().toISOString() }).eq("email", auth.user.email);
  }

  try {
    const [leads, subscribers, campaigns, replies, reminders, unreadTexts, team] = await Promise.all([
      supabaseAdmin.from("leads").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("subscribers").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("email_campaigns").select("*").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("email_replies").select("*").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("reminders").select("*").eq("done", false).order("due_at", { ascending: true }),
      supabaseAdmin.from("lead_messages").select("lead_id").eq("direction", "inbound").eq("read", false),
      supabaseAdmin.from("team_access").select("email, name, status, is_owner, last_active").order("last_active", { ascending: false, nullsFirst: false }),
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
      team: (team.data || []).filter((t) => t.status === "approved"),
      me: { email: auth.user.email, name: auth.user.name, isOwner: auth.user.isOwner },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
