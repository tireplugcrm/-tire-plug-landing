/**
 * Resend webhook for email stats + list hygiene.
 *
 * In Resend → Webhooks, add  https://tireplugla.com/api/email-events  with the events
 * email.delivered, email.opened, email.clicked, email.bounced, email.complained,
 * and put its signing secret (whsec_…) in RESEND_WEBHOOK_SECRET.
 * Open/click tracking must also be switched on for the sending domain in Resend → Domains.
 *
 * - opens/clicks/deliveries are counted once per person per campaign (dashboard stats)
 * - a bounce or spam complaint puts the address on the suppression list for good
 */
import crypto from "node:crypto";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { suppress } from "../../lib/email.js";

export const config = { api: { bodyParser: false } };

const readRaw = (req) => new Promise((resolve, reject) => {
  let data = ""; req.setEncoding("utf8");
  req.on("data", (c) => { data += c; }); req.on("end", () => resolve(data)); req.on("error", reject);
});

// Resend signs webhooks with Svix.
function verify(raw, headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;
  const id = headers["svix-id"], ts = headers["svix-timestamp"], sigs = headers["svix-signature"];
  if (!id || !ts || !sigs || Math.abs(Date.now() / 1000 - Number(ts)) > 600) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${ts}.${raw}`).digest("base64");
  return String(sigs).split(" ").some((s) => {
    const v = s.split(",")[1] || "";
    return v.length === expected.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expected));
  });
}

const TYPES = { "email.delivered": "delivered", "email.opened": "opened", "email.clicked": "clicked", "email.bounced": "bounced", "email.complained": "complained" };
const COLUMN = { delivered: "delivered", opened: "opened", clicked: "clicked", bounced: "bounced" };

function campaignTag(tags) {
  if (!tags) return null;
  if (Array.isArray(tags)) return tags.find((t) => t.name === "campaign")?.value || null;
  return tags.campaign || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const raw = await readRaw(req);
  if (!verify(raw, req.headers)) return res.status(401).json({ error: "Bad signature" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  let event;
  try { event = JSON.parse(raw); } catch { return res.status(400).json({ error: "Bad JSON" }); }
  const type = TYPES[event.type];
  if (!type) return res.status(200).json({ ignored: event.type });

  const d = event.data || {};
  const email = String((Array.isArray(d.to) ? d.to[0] : d.to) || "").toLowerCase();
  const campaignId = campaignTag(d.tags);
  const uuid = /^[0-9a-f-]{36}$/i.test(campaignId || "") ? campaignId : null;

  try {
    if (type === "bounced" || type === "complained") await suppress(email, type);

    await supabaseAdmin.from("email_events").upsert(
      { campaign_id: uuid, email, type, link: d.click?.link || null },
      { onConflict: "campaign_id,email,type", ignoreDuplicates: true },
    );
    if (uuid && COLUMN[type]) {
      const { count } = await supabaseAdmin.from("email_events").select("id", { count: "exact", head: true }).eq("campaign_id", uuid).eq("type", type);
      await supabaseAdmin.from("email_campaigns").update({ [COLUMN[type]]: count || 0 }).eq("id", uuid);
    }
  } catch (e) {
    console.error("email-events error:", e);
    return res.status(500).json({ error: "Could not record event." });
  }
  return res.status(200).json({ ok: true });
}
