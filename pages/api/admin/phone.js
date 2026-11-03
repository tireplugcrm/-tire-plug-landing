/**
 * Admin → Phone: the phone AI's calls (phone_calls, filled by /api/voice-calls) and the report.
 * POST { action: "report", from, to }  -> { report, calls: [...] }  (from/to = YYYY-MM-DD, LA days; no transcripts)
 * POST { action: "call", id }          -> { call, audioUrl }       (full call + a 1-hour recording link)
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { report } from "../../../lib/phone-calls.js";
import { BUCKET } from "../voice-calls.js";

const LIST = "id,started_at,duration_secs,caller,caller_name,intent,vehicle,tire_size,urgency,language,quoted,quotes,in_stock,lowest_quote,booked,booking,booked_value,lead_saved,text_sent,transferred,transfer_reason,alignment_offered,alignment_accepted,alignment_question,used_tire_request,used_tire_size,objection,lost_reason,quality_score,quality,summary,cost_credits,avg_wait_secs,recording_path";

// Midnight in Los Angeles for a YYYY-MM-DD day, as an ISO instant.
function laMidnight(ymd) {
  const guess = new Date(`${ymd}T08:00:00Z`);
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" }).format(guess));
  return new Date(guess.getTime() - h * 3600000).toISOString();
}
const nextDay = (ymd) => new Date(new Date(`${ymd}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Database not configured." });
  const { action, from, to, id } = req.body || {};

  if (action === "report") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(to || "")) return res.status(400).json({ error: "from/to dates" });
    const { data, error } = await supabaseAdmin.from("phone_calls").select(LIST)
      .gte("started_at", laMidnight(from)).lt("started_at", laMidnight(nextDay(to)))
      .order("started_at", { ascending: false }).limit(5000);
    if (error) return res.status(500).json({ error: /phone_calls/.test(error.message) ? "The phone_calls table isn't set up yet (lib/phone-calls-schema.sql)." : error.message });
    return res.status(200).json({ report: report(data || []), calls: (data || []).slice(0, 300) });
  }

  if (action === "call") {
    const { data: call } = await supabaseAdmin.from("phone_calls").select("*").eq("id", id).maybeSingle();
    if (!call) return res.status(404).json({ error: "Call not found" });
    let audioUrl = null;
    if (call.recording_path) {
      const { data: s } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(call.recording_path, 3600);
      audioUrl = s?.signedUrl || null;
    }
    return res.status(200).json({ call, audioUrl });
  }

  return res.status(400).json({ error: "Unknown action" });
}
