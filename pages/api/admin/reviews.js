/**
 * Reviews & Referrals engine. Owner/Google gated.
 *
 * POST actions:
 *   { action: "getSettings" } -> { google_review_url, booking_url }
 *   { action: "setSettings", google_review_url, booking_url }
 *   { action: "recipients", mode, channel, segment } -> { total, reachable, sample }
 *   { action: "draft", mode, channel }              -> { subject?, body }
 *   { action: "send", mode, channel, segment, subject, body } -> { sent, failed, reachable }
 *
 * mode: "review" (recent customers not yet asked) | "referral" (a chosen segment).
 * SMS only to opted-in; email to those with an address. Confirm in the UI before send.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { sendSms } from "../../../lib/sms.js";
import { SHOP_FACTS, AI_VOICE } from "../../../lib/shop-facts.js";
import { fetchAllCustomers } from "../../../lib/customers-data.js";

export const maxDuration = 60;
const MODEL = process.env.LEADS_AI_MODEL || "claude-sonnet-4-6";

function daysAgoYmd(days) { const d = new Date(); d.setDate(d.getDate() - days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
const first = (name) => (name || "").trim().split(/\s+/)[0] || "there";
function reachableBy(c, channel) { return channel === "email" ? !!c.email : (!!c.sms_opt_in && !!c.phone); }
function inSegment(c, seg) {
  if (!seg || seg === "all") return true;
  if (seg === "vip") return (Number(c.total_spent) || 0) >= 1500;
  if (seg === "lapsed") return c.last_visit && c.last_visit < daysAgoYmd(365);
  if (seg === "commercial") return !!c.is_commercial;
  if (seg === "due_tires") return c.last_tire_date && c.last_tire_date < daysAgoYmd(365 * 3);
  return true;
}

async function askClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 500, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  return (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}
async function sendEmail(to, subject, body) {
  const key = process.env.RESEND_API_KEY, from = process.env.RESEND_FROM;
  if (!key || !from) return false;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${body.replace(/\n/g, "<br>")}<hr style="border:none;border-top:1px solid #eee;margin:20px 0"><p style="color:#888;font-size:12px">The Tire Plug · Los Angeles · Reply STOP or unsubscribe to opt out.</p></div>`;
  try {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject: subject || "The Tire Plug", html, reply_to: process.env.RESEND_REPLY_TO || undefined }) });
    return r.ok;
  } catch (e) { return false; }
}
async function getSetting(k) { const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", k).single(); return data ? data.value : ""; }

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { action, mode = "review", channel = "email", segment = "all" } = req.body || {};

  try {
    if (action === "getSettings") {
      return res.status(200).json({ google_review_url: await getSetting("google_review_url"), booking_url: await getSetting("booking_url") });
    }
    if (action === "setSettings") {
      const rows = [
        { key: "google_review_url", value: req.body.google_review_url || "", updated_at: new Date().toISOString() },
        { key: "booking_url", value: req.body.booking_url || "", updated_at: new Date().toISOString() },
      ];
      const { error } = await supabaseAdmin.from("app_settings").upsert(rows, { onConflict: "key" });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    const reviewUrl = await getSetting("google_review_url");
    const bookingUrl = (await getSetting("booking_url")) || "https://tireplugla.com/#booking";

    if (action === "draft") {
      if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "AI not set up." });
      const isEmail = channel === "email";
      const link = mode === "review" ? (reviewUrl || "(your Google review link)") : bookingUrl;
      const intent = mode === "review"
        ? `Thank a recent customer and warmly ask them to leave a Google review. Include this review link: ${link}. Keep it genuine and short, not pushy.`
        : `Invite a happy customer to refer a friend to The Tire Plug. Mention they and their friend both get a deal. Include this link/contact: ${link} (or call 562-513-0217). Don't invent specific dollar amounts unless general.`;
      const prompt = `You write messages for The Tire Plug (LA tire shop).
VOICE: ${AI_VOICE}
FACTS (only facts you may state; never invent prices): ${SHOP_FACTS}
TASK: Write a short ${isEmail ? "EMAIL" : "SMS (under 320 chars)"} that does this: ${intent}
Use {name} for the first name. ${isEmail ? "Start with 'SUBJECT: <subject>' then a blank line then the body, ending with an opt-out note." : "End with 'Reply STOP to opt out.'"}
Output ONLY the message.`;
      const out = await askClaude(prompt);
      if (!out) return res.status(502).json({ error: "AI returned nothing." });
      if (isEmail) { const m = out.match(/^\s*SUBJECT:\s*(.+?)\n([\s\S]*)$/i); if (m) return res.status(200).json({ subject: m[1].trim(), body: m[2].trim() }); return res.status(200).json({ subject: mode === "review" ? "How did we do?" : "Refer a friend to The Tire Plug", body: out }); }
      return res.status(200).json({ body: out });
    }

    // Build recipient list (paged past the 1000-row cap)
    let all = [];
    try { all = await fetchAllCustomers("id,name,phone,email,sms_opt_in,total_spent,last_visit,last_tire_date,is_commercial,review_requested_at"); }
    catch (e) { return res.status(500).json({ error: e.message }); }
    let pool;
    if (mode === "review") pool = (all || []).filter((c) => c.last_visit && c.last_visit >= daysAgoYmd(45) && !c.review_requested_at);
    else pool = (all || []).filter((c) => inSegment(c, segment));
    const reach = pool.filter((c) => reachableBy(c, channel));

    if (action === "recipients") {
      return res.status(200).json({ total: pool.length, reachable: reach.length, sample: reach.slice(0, 5).map((c) => c.name) });
    }

    if (action === "send") {
      let body = req.body.body, subject = req.body.subject;
      if (!body || !body.trim()) return res.status(400).json({ error: "Write a message first." });
      if (reach.length === 0) return res.status(400).json({ error: "No reachable recipients." });
      // Guarantee the call-to-action link is present.
      const link = mode === "review" ? reviewUrl : bookingUrl;
      if (link && !body.includes(link)) body += (mode === "review" ? `\n\nLeave a review: ${link}` : `\n\n${link}`);

      let sent = 0, failed = 0; const sentIds = [];
      for (const c of reach.slice(0, 1000)) {
        const msg = body.replace(/\{name\}/gi, first(c.name)).replace(/\{first\}/gi, first(c.name));
        let ok = false;
        if (channel === "email") ok = await sendEmail(c.email, subject, msg);
        else { const r = await sendSms({ to: c.phone, body: msg }); ok = r.ok; }
        if (ok) { sent += 1; sentIds.push(c.id); } else failed += 1;
      }
      if (mode === "review" && sentIds.length) await supabaseAdmin.from("customers").update({ review_requested_at: new Date().toISOString() }).in("id", sentIds);
      await supabaseAdmin.from("customer_campaigns").insert({ segment: mode === "review" ? "review-request" : `referral:${segment}`, channel, subject: subject || null, body, recipients: reach.length, sent });
      return res.status(200).json({ sent, failed, reachable: reach.length });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (e) {
    return res.status(500).json({ error: "Server error." });
  }
}
