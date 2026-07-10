/**
 * Send an email blast via Resend (password gated).
 * - audience: "leads" | "subscribers" | "both"
 * - Each recipient gets their own private copy (Resend batch, chunks of 100).
 * - Reply-To is set so customer replies land somewhere you control
 *   (and, once inbound DNS is set up, also flow into the Replies tab).
 *
 * Required env: RESEND_API_KEY
 * Optional env: RESEND_FROM   (default: "The Tire Plug <deals@tireplugla.com>")
 *               RESEND_REPLY_TO (default: "tiredepotplug@gmail.com")
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";

const FROM = process.env.RESEND_FROM || "The Tire Plug <deals@tireplugla.com>";
const REPLY_TO = process.env.RESEND_REPLY_TO || "tiredepotplug@gmail.com";

// Wrap the owner's message in the cinematic red/black Tire Plug template.
function renderEmail({ subject, message }) {
  const paragraphs = String(message || "")
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 16px;color:#e8e8e8;font-size:16px;line-height:1.6;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#000;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:linear-gradient(135deg,#111 0%,#000 100%);border:1px solid rgba(255,31,31,0.25);border-radius:18px;overflow:hidden;">
          <tr><td style="height:4px;background:linear-gradient(90deg,transparent,#FF1F1F,transparent);"></td></tr>
          <tr><td style="padding:36px 36px 8px;text-align:center;">
            <div style="color:#FF3838;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">The Tire Plug</div>
          </td></tr>
          <tr><td style="padding:8px 36px 0;text-align:center;">
            <h1 style="margin:0 0 24px;color:#fff;font-size:26px;font-weight:900;letter-spacing:-0.5px;text-transform:uppercase;line-height:1.1;">${subject || ""}</h1>
          </td></tr>
          <tr><td style="padding:0 36px 24px;">${paragraphs}</td></tr>
          <tr><td style="padding:0 36px 36px;text-align:center;">
            <a href="tel:562-500-4625" style="display:inline-block;background:linear-gradient(180deg,#FF2A2A,#8B0000);color:#fff;padding:14px 32px;border-radius:8px;font-weight:800;font-size:14px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;">Call 562-500-4625</a>
          </td></tr>
          <tr><td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
            <p style="margin:0;color:rgba(255,255,255,0.4);font-size:12px;line-height:1.5;">
              The Tire Plug · Los Angeles, CA<br/>
              Reply <strong>STOP</strong> to unsubscribe.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  const { audience, subject, message } = req.body || {};
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: "Email is not set up yet — add your RESEND_API_KEY first." });
  }
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });
  if (!subject || !message) return res.status(400).json({ error: "Subject and message are required." });
  if (!["leads", "subscribers", "both"].includes(audience)) {
    return res.status(400).json({ error: "Pick who to send to." });
  }

  // ---- Gather recipients ----
  const emails = new Set();
  if (audience === "leads" || audience === "both") {
    const { data } = await supabaseAdmin.from("leads").select("email").neq("status", "dead");
    (data || []).forEach((r) => r.email && emails.add(r.email.trim().toLowerCase()));
  }
  if (audience === "subscribers" || audience === "both") {
    const { data } = await supabaseAdmin.from("subscribers").select("email").eq("status", "active");
    (data || []).forEach((r) => r.email && emails.add(r.email.trim().toLowerCase()));
  }
  const recipients = [...emails].filter((e) => /\S+@\S+\.\S+/.test(e));

  if (recipients.length === 0) {
    return res.status(400).json({ error: "No valid email addresses to send to in that group yet." });
  }

  const html = renderEmail({ subject, message });

  // ---- Send via Resend batch endpoint (max 100 per call) ----
  let sent = 0;
  let errors = 0;
  for (const group of chunk(recipients, 100)) {
    const payload = group.map((to) => ({
      from: FROM,
      to,
      subject,
      html,
      reply_to: REPLY_TO,
    }));
    try {
      const r = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        sent += group.length;
      } else {
        errors += group.length;
        console.error("Resend batch error:", await r.text());
      }
    } catch (err) {
      errors += group.length;
      console.error("Resend send error:", err);
    }
  }

  // ---- Log the campaign ----
  try {
    await supabaseAdmin.from("email_campaigns").insert({
      subject,
      body: message,
      audience,
      recipient_count: recipients.length,
      sent_count: sent,
      error_count: errors,
    });
  } catch (err) {
    console.error("Campaign log error (non-blocking):", err);
  }

  return res.status(200).json({ success: sent > 0, sent, errors, total: recipients.length });
}
