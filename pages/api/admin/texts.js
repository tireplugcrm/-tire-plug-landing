/**
 * Admin → Texts: every SMS conversation on the shop number, grouped by phone, including
 * numbers that aren't a lead yet (password / Google gated).
 *
 * POST { action: "list" }                 -> { threads: [{ phone, lead_id, name, last, last_at, last_dir, unread }], isOwner }
 * POST { action: "thread", phone }        -> { messages, lead }   (marks that phone's inbound as read)
 * POST { action: "send", phone, body }    -> { ok }               (texts from the shop number, logs it)
 * POST { action: "ghl-import", dryRun }   -> { conversations, found, added, unread }  (owner only)
 *   Copies the last 30 days of GHL SMS (both ways) into lead_messages. Safe to run again:
 *   messages already stored (twilio_sid "ghl:<id>") are skipped. Never sends anything.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { digits10 } from "../../../lib/phone.js";
import { cancelFollowups } from "../../../lib/followups.js";
import { sendSms, ghlRecentConversations } from "../../../lib/sms.js";

export const maxDuration = 60;

const HIDDEN = ["scheduled", "canceled"]; // queued follow-ups aren't part of the conversation yet

async function leadForPhone(phone) {
  const { data } = await supabaseAdmin.from("leads").select("id, name, phone").order("created_at", { ascending: false }).limit(1000);
  return (data || []).find((l) => digits10(l.phone) === phone) || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Database not configured." });

  const { action, body } = req.body || {};
  const phone = digits10(req.body?.phone);

  if (action === "list") {
    const since = new Date(Date.now() - 90 * 864e5).toISOString();
    const { data, error } = await supabaseAdmin
      .from("lead_messages")
      .select("lead_id, direction, phone, body, status, read, created_at, channel")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(3000);
    if (error) return res.status(500).json({ error: error.message });

    const byPhone = new Map();
    for (const m of data || []) {
      if ((m.channel && m.channel !== "sms") || HIDDEN.includes(m.status)) continue;
      const p = digits10(m.phone);
      if (p.length !== 10) continue;
      let t = byPhone.get(p);
      if (!t) { t = { phone: p, lead_id: null, last: m.body, last_at: m.created_at, last_dir: m.direction, unread: 0 }; byPhone.set(p, t); }
      if (!t.lead_id && m.lead_id) t.lead_id = m.lead_id;
      if (m.direction === "inbound" && !m.read) t.unread++;
    }
    const threads = [...byPhone.values()];
    const ids = [...new Set(threads.map((t) => t.lead_id).filter(Boolean))];
    if (ids.length) {
      const { data: leads } = await supabaseAdmin.from("leads").select("id, name").in("id", ids);
      const names = new Map((leads || []).map((l) => [l.id, l.name]));
      for (const t of threads) t.name = names.get(t.lead_id) || null;
    }
    return res.status(200).json({ threads, isOwner: !!auth.user?.isOwner });
  }

  if (action === "ghl-import") {
    if (!auth.user?.isOwner) return res.status(403).json({ error: "Only the owner can import from GHL." });
    let convs;
    try { convs = await ghlRecentConversations(30); }
    catch (err) { return res.status(502).json({ error: err.message || "Could not read GHL." }); }
    if (!convs) return res.status(400).json({ error: "GHL isn't set up." });

    const { data: leads } = await supabaseAdmin.from("leads").select("id, phone, last_reply_at").order("created_at", { ascending: false }).limit(2000);
    const leadByPhone = new Map();
    for (const l of leads || []) { const p = digits10(l.phone); if (p && !leadByPhone.has(p)) leadByPhone.set(p, l); }

    let found = 0, added = 0, unread = 0;
    for (const c of convs) {
      const p = digits10(c.phone);
      if (p.length !== 10) continue;
      const msgs = c.messages.filter((m) => !["scheduled", "canceled", "cancelled"].includes(m.status));
      found += msgs.length;
      const { data: seen } = await supabaseAdmin.from("lead_messages").select("twilio_sid").in("twilio_sid", msgs.map((m) => m.sid));
      const have = new Set((seen || []).map((r) => r.twilio_sid));
      // GHL only keeps an unread count per conversation: the newest that many inbound texts are unread.
      const unreadSids = new Set(msgs.filter((m) => m.direction === "inbound").slice(0, c.unreadCount).map((m) => m.sid));
      const lead = leadByPhone.get(p) || null;
      const rows = msgs.filter((m) => !have.has(m.sid)).map((m) => ({
        lead_id: lead?.id || null,
        direction: m.direction,
        phone: p,
        body: m.body,
        twilio_sid: m.sid,
        status: m.direction === "inbound" ? "received" : "sent",
        read: !unreadSids.has(m.sid),
        created_at: m.at,
      }));
      if (!rows.length) continue;
      unread += rows.filter((r) => !r.read).length;
      added += rows.length;
      if (req.body?.dryRun) continue;
      const { error } = await supabaseAdmin.from("lead_messages").insert(rows);
      if (error) return res.status(500).json({ error: error.message, added: added - rows.length });

      // A customer reply counts as one for the lead: stamp it with GHL's time.
      const lastIn = rows.find((r) => r.direction === "inbound");
      if (lead && lastIn && (!lead.last_reply_at || new Date(lastIn.created_at) > new Date(lead.last_reply_at))) {
        await supabaseAdmin.from("leads").update({ last_reply_at: lastIn.created_at }).eq("id", lead.id);
        if (!lastIn.read) await cancelFollowups(lead.id); // still waiting on us; old replies leave newer nudges alone
      }
    }
    return res.status(200).json({ ok: true, dryRun: !!req.body?.dryRun, conversations: convs.length, found, added, unread });
  }

  if (phone.length !== 10) return res.status(400).json({ error: "Enter a 10-digit phone number." });

  if (action === "thread") {
    const { data, error } = await supabaseAdmin
      .from("lead_messages")
      .select("id, direction, body, status, created_at, channel")
      .eq("phone", phone)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) return res.status(500).json({ error: error.message });
    supabaseAdmin.from("lead_messages").update({ read: true }).eq("phone", phone).eq("direction", "inbound").eq("read", false).then(() => {});
    const messages = (data || []).filter((m) => (!m.channel || m.channel === "sms") && !HIDDEN.includes(m.status));
    return res.status(200).json({ messages, lead: await leadForPhone(phone) });
  }

  if (action === "send") {
    if (!body || !body.trim()) return res.status(400).json({ error: "Message is empty." });
    const r = await sendSms({ to: phone, body });
    if (!r.ok) return res.status(502).json({ error: r.error });
    const lead = await leadForPhone(phone);
    await supabaseAdmin.from("lead_messages").insert({
      lead_id: lead?.id || null, direction: "outbound", phone, body, twilio_sid: r.sid, status: r.status, read: true,
    });
    // Same as replying from the lead drawer: the Front Desk agent stops nagging about this lead.
    if (lead) await supabaseAdmin.from("leads").update({ first_response_at: new Date().toISOString() }).eq("id", lead.id).is("first_response_at", null);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Unknown action." });
}
