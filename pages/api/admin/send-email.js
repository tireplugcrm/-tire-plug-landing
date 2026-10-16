/**
 * Email blasts to leads / subscribers (dashboard Email tab). Owner/Google gated.
 *
 * POST actions:
 *   { action: "count", audience }                          -> { total }  (after unsubscribes)
 *   { action: "preview", subject, headline, message, tires } -> { html }
 *   { action: "test", to?, subject, headline, message, tires } -> sends one copy to you
 *   { action: "send", audience, subject, headline, message, tires }           -> send now
 *   { action: "schedule", audience, sendAt, ...same }       -> the daily 9 AM cron sends it
 *   { action: "cancel", id }                                -> cancel a scheduled send
 *   { action: "tires" }                                     -> next-day tires the builder can feature
 *
 * Every email carries the logo, Google rating, a real review, the shop address and a working
 * unsubscribe link; unsubscribed/bounced addresses are skipped automatically.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { dealTires, sendOne, REPLY_TO } from "../../../lib/email.js";
import { blastRecipients, blastEmail, deliverCampaign } from "../../../lib/email-campaigns.js";

export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { action = "send", audience, subject, headline, message, tires = [], sendAt, to, id } = req.body || {};
  const content = { subject, headline: headline || subject, message, tires };

  try {
    if (action === "tires") return res.status(200).json({ tires: dealTires() });

    if (action === "preview") {
      return res.status(200).json({ html: blastEmail(content, "preview@example.com", "Maria").html });
    }

    if (action === "count") {
      if (!["leads", "subscribers", "both"].includes(audience)) return res.status(400).json({ error: "Pick who to send to." });
      return res.status(200).json({ total: (await blastRecipients(audience)).length });
    }

    if (action === "cancel") {
      await supabaseAdmin.from("email_campaigns").update({ status: "canceled" }).eq("id", id).eq("status", "scheduled");
      return res.status(200).json({ ok: true });
    }

    if (!subject || !message) return res.status(400).json({ error: "Subject and message are required." });
    if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: "Email is not set up yet — add your RESEND_API_KEY first." });

    if (action === "test") {
      const dest = (to || (auth.user.email !== "owner" ? auth.user.email : REPLY_TO) || "").trim();
      const out = await sendOne({ to: dest, subject: `[TEST] ${subject}`, ...blastEmail(content, dest, "Maria") });
      if (!out.sent) return res.status(502).json({ error: out.error || "Test send failed." });
      return res.status(200).json({ ok: true, to: dest });
    }

    if (!["leads", "subscribers", "both"].includes(audience)) return res.status(400).json({ error: "Pick who to send to." });

    const row = {
      kind: "blast", subject, headline: headline || null, body: message, audience, tire_ids: tires,
      created_by: auth.user.email, status: action === "schedule" ? "scheduled" : "sending",
      send_at: action === "schedule" ? new Date(sendAt).toISOString() : new Date().toISOString(),
    };
    if (action === "schedule" && (!sendAt || isNaN(new Date(sendAt)))) return res.status(400).json({ error: "Pick a date to send." });

    const { data: saved, error } = await supabaseAdmin.from("email_campaigns").insert(row).select().single();
    if (error) return res.status(500).json({ error: `Could not save the campaign (${error.message}). Did you run lib/email-schema.sql?` });

    if (action === "schedule") return res.status(200).json({ scheduled: true, id: saved.id, sendAt: saved.send_at });

    const out = await deliverCampaign(saved);
    return res.status(200).json({ success: out.sent > 0, sent: out.sent, errors: out.failed, total: out.total, error: out.error });
  } catch (e) {
    console.error("send-email error:", e);
    return res.status(500).json({ error: "Server error." });
  }
}
