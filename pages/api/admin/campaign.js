/**
 * Customer reactivation campaigns. Owner/Google gated.
 *
 * POST actions:
 *   { action: "recipients", segment, channel }            -> { total, reachable, sample }
 *   { action: "draft", segment, channel }                 -> { subject?, body }
 *   { action: "send", segment, channel, subject, body }   -> { sent, failed, reachable }
 *
 * Compliance: SMS only goes to customers with sms_opt_in = true (+ a phone).
 * Email goes to customers with an email on file and always carries an opt-out line.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { sendSms } from "../../../lib/sms.js";
import { SHOP_FACTS, AI_VOICE } from "../../../lib/shop-facts.js";
import { fetchAllCustomers } from "../../../lib/customers-data.js";

export const maxDuration = 60;
const MODEL = process.env.LEADS_AI_MODEL || "claude-sonnet-4-6";

function daysAgoYmd(days) { const d = new Date(); d.setDate(d.getDate() - days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function inSegment(c, seg) {
  if (seg === "all") return true;
  if (seg === "due_tires") return c.last_tire_date && c.last_tire_date < daysAgoYmd(365 * 3);
  if (seg === "lapsed") return c.last_visit && c.last_visit < daysAgoYmd(365);
  if (seg === "recent") return c.last_visit && c.last_visit >= daysAgoYmd(45);
  if (seg === "vip") return (Number(c.total_spent) || 0) >= 1500;
  if (seg === "commercial") return !!c.is_commercial;
  return false;
}
function reachableBy(c, channel) {
  if (channel === "email") return !!c.email;
  return !!c.sms_opt_in && !!c.phone; // sms
}
const first = (name) => (name || "").trim().split(/\s+/)[0] || "there";

const INTENT = {
  due_tires: "These past customers bought their tires about 3-4 years ago and are likely due for replacement. Invite them in for a free tire check or a fresh quote.",
  lapsed: "These customers haven't visited in over a year. Warmly win them back.",
  recent: "These customers visited recently. Thank them and ask them to leave a Google review.",
  vip: "These are top, loyal customers. Offer a VIP perk or early access to a deal.",
  commercial: "These are commercial / fleet accounts. Offer special fleet/wholesale pricing and a dedicated point of contact.",
  all: "A general friendly promotion to past customers.",
};

async function askClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 500, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  return (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

async function sendEmail(to, subject, body) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return false;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${body.replace(/\n/g, "<br>")}<hr style="border:none;border-top:1px solid #eee;margin:20px 0"><p style="color:#888;font-size:12px">The Tire Plug · Los Angeles · Reply STOP or unsubscribe to opt out.</p></div>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: subject || "The Tire Plug", html, reply_to: process.env.RESEND_REPLY_TO || undefined }),
    });
    return r.ok;
  } catch (e) { return false; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { action, segment = "all", channel = "sms" } = req.body || {};

  try {
    if (action === "draft") {
      if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "AI not set up." });
      const isEmail = channel === "email";
      const prompt = `You write customer messages for The Tire Plug (LA tire shop).
VOICE: ${AI_VOICE}
SHOP FACTS (only facts you may state; never invent prices): ${SHOP_FACTS}
AUDIENCE: ${INTENT[segment] || INTENT.all}
Write ${isEmail ? "a short marketing EMAIL" : "a short marketing SMS (under 320 characters)"} to send to this audience.
Use {name} where the customer's first name should go. Do NOT invent specific prices — refer to "a great deal" / "special pricing" or tell them to call 562-513-0217 for a quote.
${isEmail ? "Start with a line 'SUBJECT: <subject>' then a blank line then the email body. End the body with an opt-out note." : "End with 'Reply STOP to opt out.'"}
Output ONLY the message.`;
      const out = await askClaude(prompt);
      if (!out) return res.status(502).json({ error: "AI returned nothing." });
      if (isEmail) {
        const m = out.match(/^\s*SUBJECT:\s*(.+?)\n([\s\S]*)$/i);
        if (m) return res.status(200).json({ subject: m[1].trim(), body: m[2].trim() });
        return res.status(200).json({ subject: "A note from The Tire Plug", body: out });
      }
      return res.status(200).json({ body: out });
    }

    // Load all customers (paged past the 1000-row cap) for recipients + send.
    let all = [];
    try { all = await fetchAllCustomers("id,name,phone,email,sms_opt_in,total_spent,last_visit,last_tire_date,is_commercial"); }
    catch (e) { return res.status(500).json({ error: e.message }); }
    const inSeg = all.filter((c) => inSegment(c, segment));
    const reach = inSeg.filter((c) => reachableBy(c, channel));

    if (action === "recipients") {
      return res.status(200).json({ total: inSeg.length, reachable: reach.length, sample: reach.slice(0, 5).map((c) => c.name) });
    }

    if (action === "send") {
      const body = req.body.body, subject = req.body.subject;
      if (!body || !body.trim()) return res.status(400).json({ error: "Write a message first." });
      if (reach.length === 0) return res.status(400).json({ error: "No reachable recipients in this segment for that channel." });

      let sent = 0, failed = 0;
      const cap = reach.slice(0, 1000);
      for (const c of cap) {
        const msg = body.replace(/\{name\}/gi, first(c.name)).replace(/\{first\}/gi, first(c.name));
        let ok = false;
        if (channel === "email") ok = await sendEmail(c.email, subject, msg);
        else { const r = await sendSms({ to: c.phone, body: msg }); ok = r.ok; }
        if (ok) sent += 1; else failed += 1;
      }
      await supabaseAdmin.from("customer_campaigns").insert({ segment, channel, subject: subject || null, body, recipients: reach.length, sent });
      return res.status(200).json({ sent, failed, reachable: reach.length });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (e) {
    return res.status(500).json({ error: "Server error." });
  }
}
