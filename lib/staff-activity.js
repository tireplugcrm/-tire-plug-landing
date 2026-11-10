// What staff do on their phone pages (/belen), so the owner can see they use them. SERVER ONLY.
// Table staff_activity (lib/staff-activity-schema.sql). Logging never breaks the page: errors are ignored.
import { supabaseAdmin } from "./supabaseAdmin.js";

export const EVENTS = ["open", "tab", "tick", "untick", "add_account"];

export async function logActivity(who, event, detail = null) {
  if (!supabaseAdmin || !EVENTS.includes(event)) return;
  try {
    await supabaseAdmin.from("staff_activity").insert({ who, event, detail: detail ? String(detail).slice(0, 200) : null });
  } catch { /* table missing or offline: skip */ }
}

/** The last `days` days of a person's activity, newest first. */
export async function recentActivity(who, days = 14) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data, error } = await supabaseAdmin.from("staff_activity").select("event, detail, at").eq("who", who).gte("at", since).order("at", { ascending: false }).limit(500);
  if (error) throw new Error(`${error.message}. Run lib/staff-activity-schema.sql in Supabase first.`);
  return data || [];
}
