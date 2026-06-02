/**
 * Instagram DM webhook (Meta).
 * GET  — Meta verification handshake (uses IG_VERIFY_TOKEN).
 * POST — incoming DMs → create/find a lead by Instagram sender id, log the message.
 *
 * Configure in Meta: Webhooks → callback URL https://tireplugla.com/api/ig/webhook,
 * verify token = IG_VERIFY_TOKEN, subscribe to the "messages" field.
 *
 * Env: IG_VERIFY_TOKEN, IG_PAGE_ACCESS_TOKEN
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { getIgProfile } from "../../../lib/instagram.js";

export default async function handler(req, res) {
  // --- Verification handshake ---
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token && token === process.env.IG_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Process the event (fast — well within Meta's window), then 200 so the
  // work reliably runs on serverless before the function freezes.
  try {
    if (!supabaseAdmin) return res.status(200).json({ received: true });
    const body = req.body || {};
    const entries = body.entry || [];
    for (const entry of entries) {
      const events = entry.messaging || entry.changes || [];
      for (const ev of events) {
        const msg = ev.message;
        if (!msg || msg.is_echo) continue;               // skip our own echoes
        const igUserId = ev.sender && ev.sender.id;
        const text = msg.text || "";
        if (!igUserId || !text) continue;

        // Find or create the lead for this Instagram user
        let { data: lead } = await supabaseAdmin.from("leads").select("id").eq("ig_user_id", igUserId).single();
        if (!lead) {
          const prof = await getIgProfile(igUserId);
          const { data: created } = await supabaseAdmin.from("leads").insert({
            name: (prof && prof.name) || "Instagram lead",
            channel: "instagram",
            ig_user_id: igUserId,
            source: "instagram",
            lead_priority: "WARM",
            status: "new",
          }).select("id").single();
          lead = created;
        }

        if (lead) {
          await supabaseAdmin.from("lead_messages").insert({
            lead_id: lead.id,
            direction: "inbound",
            channel: "instagram",
            body: text,
            status: "received",
            read: false,
          });
        }
      }
    }
  } catch (e) {
    console.error("IG webhook error:", e);
  }
  return res.status(200).json({ received: true });
}
