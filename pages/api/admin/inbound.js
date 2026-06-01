/**
 * Inbound email webhook — catches replies and saves them to the Replies tab.
 *
 * In Resend → Webhooks, add this URL and subscribe to the "email.received" event:
 *    https://tireplugla.com/api/admin/inbound?token=YOUR_SECRET
 * and set RESEND_INBOUND_SECRET to that same secret in your env.
 *
 * Resend's webhook only sends metadata (from, subject, email id) — NOT the body.
 * So we fetch the full message from Resend's Received Emails API, then save it.
 *
 * This endpoint is public (Resend calls it), so the ?token guards it.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";

function parseFrom(raw) {
  if (!raw) return { name: null, email: null };
  if (typeof raw === "object") {
    return { name: raw.name || null, email: raw.email || raw.address || null };
  }
  const m = String(raw).match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1] || null, email: m[2] };
  return { name: null, email: String(raw).trim() };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secret = process.env.RESEND_INBOUND_SECRET;
  if (!secret || req.query.token !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const event = req.body || {};
  const data = event.data || event;

  // Metadata from the webhook
  let from = parseFrom(data.from);
  let subject = data.subject || "(no subject)";
  let body = data.text || data.html || "";
  const emailId = data.email_id || data.id;

  // The webhook omits the body — fetch the full message from Resend.
  if (!body && emailId && process.env.RESEND_API_KEY) {
    try {
      const r = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      });
      if (r.ok) {
        const full = await r.json();
        body = full.text || full.html || "";
        if (full.from) from = parseFrom(full.from);
        if (full.subject) subject = full.subject;
      } else {
        console.error("Resend received-email fetch failed:", await r.text());
      }
    } catch (err) {
      console.error("Resend received-email fetch error:", err);
    }
  }

  const safeBody = typeof body === "string" ? body.slice(0, 20000) : JSON.stringify(body);

  try {
    await supabaseAdmin.from("email_replies").insert({
      from_email: from.email,
      from_name: from.name,
      subject,
      body: safeBody,
      raw: event,
    });
  } catch (err) {
    console.error("Reply save error:", err);
    return res.status(500).json({ error: "Could not save reply." });
  }

  // Safety net: also forward the reply to your inbox so it's never missed.
  const forwardTo = process.env.RESEND_FORWARD_TO;
  if (forwardTo && process.env.RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "The Tire Plug <deals@tireplugla.com>",
          to: forwardTo,
          reply_to: from.email || undefined,
          subject: `↩ Reply from ${from.name || from.email || "a customer"}: ${subject}`,
          text: `From: ${from.name || ""} <${from.email || ""}>\n\n${safeBody}`,
        }),
      });
    } catch (err) {
      console.error("Reply forward error (non-blocking):", err);
    }
  }

  return res.status(200).json({ received: true });
}
