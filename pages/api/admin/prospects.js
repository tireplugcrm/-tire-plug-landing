/**
 * Business outreach (cold email to local businesses). Owner/Google gated.
 *
 * POST actions:
 *   { action: "list" }                                   -> { prospects, sentToday, dailyLimit }
 *   { action: "import", csv }                            -> { added, skipped }   (paste or upload a CSV)
 *   { action: "find", group }                            -> { added, found, calls } (Google Places near the shop, no emails)
 *   { action: "update", id, patch }                      -> status / notes / contact edits
 *   { action: "delete", id }
 *   { action: "draft", category, step }                  -> AI-written { subject, message } with {name}/{business}
 *   { action: "preview", message, signer }               -> { html }
 *   { action: "test", subject, message, signer, to? }    -> one copy to you
 *   { action: "send", ids, step, subject, message, signer } -> { sent, skipped }
 *
 * Guardrails (keep the domain out of spam folders and inside CAN-SPAM):
 *   - a daily cap (OUTREACH_DAILY_LIMIT, default 40) across all outreach sends, ramped up over the
 *     first three weeks after the first outreach send so the sending domain warms up
 *   - step 1 only to businesses never emailed; step 2 (follow-up) only 4+ days after step 1
 *   - nobody who replied, unsubscribed, bounced, said no, or is already a customer
 *   - every email: real sender, labeled as an advertisement, shop address, a one-click unsubscribe,
 *     an honest subject (no fake "re:" / "fwd:")
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { SHOP_FACTS } from "../../../lib/shop-facts.js";
import { findBusinesses, GROUPS, RADIUS_MILES } from "../../../lib/places-prospects.js";
import { renderLetter, sendBatch, sendOne, suppressedSet, unsubPageUrl, personalize, textVersion, OUTREACH_FROM, REPLY_TO, BRAND, SITE } from "../../../lib/email.js";

export const maxDuration = 60;
const MODEL = process.env.LEADS_AI_MODEL || "claude-sonnet-4-6";
const DAILY_LIMIT = Number(process.env.OUTREACH_DAILY_LIMIT) || 40;
const FOLLOWUP_DAYS = 4;
const DONE = new Set(["replied", "customer", "not_interested", "unsubscribed", "bounced", "needs_email", "no_email"]);
const WHY = "This is an advertisement from The Tire Plug. You're getting it because your business is listed publicly near our shop in Los Angeles. We email a business at most twice, and if you unsubscribe you won't hear from us again.";
const CATALOG = { label: "See fleet tire prices", path: "/fleet" };
// Tire photos beside the logo: a car, a van and a pickup tire we sell (email-safe copies).
const HEADER_TIRES = [
  { img: "/images/email/tires/landspider-citytraxx-g-p.jpg", alt: "Landspider Citytraxx G/P" },
  { img: "/images/email/tires/gt-radial-maxmiler-pro.jpg", alt: "GT Radial Maxmiler Pro" },
  { img: "/images/email/tires/goodyear-wrangler-territory-ht.jpg", alt: "Goodyear Wrangler Territory HT" },
];
// A subject pretending to be a reply or forward is deceptive under CAN-SPAM.
const FAKE_THREAD = /^\s*(re|fwd?|fw)\s*:\s*/i;

// Warm-up: 10/day the first week of outreach, then 20, then 30, then the full limit.
async function dailyLimit() {
  const { data } = await supabaseAdmin.from("email_campaigns").select("created_at").eq("kind", "outreach").order("created_at", { ascending: true }).limit(1);
  const first = data?.[0]?.created_at;
  const week = first ? Math.floor((Date.now() - new Date(first).getTime()) / (7 * 864e5)) : 0;
  return Math.min(DAILY_LIMIT, [10, 20, 30][week] ?? DAILY_LIMIT);
}
// Dedupe key for Google listings: business name + start of the address.
const placeKey = (name, address) => `${String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "")}|${String(address || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24)}`;

/* ---- CSV import: tolerant of quotes and of whatever the column headers are called ---- */
function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === "," || c === "\t") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
const FIELDS = {
  business_name: /business|company|organi[sz]ation|^name$|title/i,
  contact_name: /contact|owner|person|first|manager/i,
  email: /e-?mail/i,
  phone: /phone|tel|mobile/i,
  category: /categor|industry|type|niche/i,
  address: /address|street|location/i,
  website: /web|site|url/i,
  notes: /note/i,
};
function rowsToProspects(csv) {
  const rows = parseCsv(String(csv || ""));
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim());
  const col = {};
  for (const [f, re] of Object.entries(FIELDS)) {
    const i = head.findIndex((h, idx) => re.test(h) && !Object.values(col).includes(idx));
    if (i >= 0) col[f] = i;
  }
  return rows.slice(1).map((r) => {
    const o = {};
    for (const [f, i] of Object.entries(col)) o[f] = (r[i] || "").trim() || null;
    if (o.email) o.email = o.email.toLowerCase();
    return o;
  }).filter((o) => o.business_name && o.email && /\S+@\S+\.\S+/.test(o.email));
}

async function askClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 700, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  return (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

const startOfTodayLA = () => {
  const now = new Date();
  const la = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return new Date(now.getTime() - (la.getHours() * 3600 + la.getMinutes() * 60 + la.getSeconds()) * 1000);
};

function letter({ message, signer, to, name, business }) {
  const unsubUrl = unsubPageUrl(to);
  const body = personalize(message, { name, business });
  const cta = { label: CATALOG.label, href: `${SITE}${CATALOG.path}` };
  return { html: renderLetter({ message: body, signer, unsubUrl, why: WHY, cta, tires: HEADER_TIRES }), text: textVersion(`${body}\n\n${cta.label}: ${cta.href}`, unsubUrl, WHY) };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });
  const b = req.body || {};
  const signer = { name: (b.signer?.name || "").trim(), title: (b.signer?.title || "").trim() };

  try {
    if (b.action === "list") {
      const { data, error } = await supabaseAdmin.from("business_prospects").select("*").order("created_at", { ascending: false }).limit(2000);
      if (error) return res.status(500).json({ error: `${error.message}. Run lib/email-schema.sql in Supabase first.` });
      const { count } = await supabaseAdmin.from("business_prospects").select("id", { count: "exact", head: true }).gte("last_emailed_at", startOfTodayLA().toISOString());
      return res.status(200).json({ prospects: data || [], sentToday: count || 0, dailyLimit: await dailyLimit(), from: OUTREACH_FROM, groups: Object.keys(GROUPS), radius: RADIUS_MILES, places: !!process.env.GOOGLE_PLACES_API_KEY });
    }

    if (b.action === "import") {
      const list = rowsToProspects(b.csv);
      if (!list.length) return res.status(400).json({ error: "No rows with both a business name and an email. The first row must be headers like: Business, Contact, Email, Phone, Category." });
      const { data: existing } = await supabaseAdmin.from("business_prospects").select("email");
      const have = new Set((existing || []).map((r) => (r.email || "").toLowerCase()));
      const seen = new Set();
      const fresh = list.filter((p) => !have.has(p.email) && !seen.has(p.email) && seen.add(p.email));
      if (fresh.length) {
        const { error } = await supabaseAdmin.from("business_prospects").insert(fresh);
        if (error) return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ added: fresh.length, skipped: list.length - fresh.length });
    }

    if (b.action === "find") {
      const { found, calls, api } = await findBusinesses(b.group);
      const { data: existing } = await supabaseAdmin.from("business_prospects").select("business_name,address");
      const have = new Set((existing || []).map((r) => placeKey(r.business_name, r.address)));
      const fresh = found.filter((p) => !have.has(placeKey(p.name, p.address))).map((p) => ({
        business_name: p.name, address: p.address, phone: p.phone, website: p.website, category: b.group,
        status: "needs_email", notes: [p.type, `${p.miles} mi from the shop`, "from Google Maps"].filter(Boolean).join(" · "),
      }));
      for (let i = 0; i < fresh.length; i += 200) {
        const { error } = await supabaseAdmin.from("business_prospects").insert(fresh.slice(i, i + 200));
        if (error) return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ added: fresh.length, found: found.length, calls, api });
    }

    if (b.action === "update") {
      const allowed = ["status", "notes", "contact_name", "email", "phone", "category", "business_name"];
      const patch = Object.fromEntries(Object.entries(b.patch || {}).filter(([k]) => allowed.includes(k)));
      if ("email" in patch) {
        patch.email = String(patch.email || "").trim().toLowerCase() || null;
        if (patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)) return res.status(400).json({ error: "That doesn't look like an email address." });
        // Adding the email to a Google listing makes it ready for an intro.
        if (patch.email && !patch.status) {
          const { data: row } = await supabaseAdmin.from("business_prospects").select("status").eq("id", b.id).single();
          if (["needs_email", "no_email"].includes(row?.status)) patch.status = "new";
        }
      }
      const { error } = await supabaseAdmin.from("business_prospects").update(patch).eq("id", b.id);
      if (error) return res.status(400).json({ error: /duplicate|unique/i.test(error.message) ? "Another business on the list already has that email." : error.message });
      return res.status(200).json({ ok: true });
    }

    if (b.action === "delete") {
      await supabaseAdmin.from("business_prospects").delete().eq("id", b.id);
      return res.status(200).json({ ok: true });
    }

    if (b.action === "draft") {
      if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "AI not set up." });
      const followup = Number(b.step) === 2;
      const prompt = `You write cold outreach emails for The Tire Plug, a 5.0-star Google-rated tire & auto shop in Los Angeles (${BRAND.vehicles} vehicles serviced, open 7 days, English and Spanish).
SHOP FACTS (only facts you may state; never invent prices, discounts or claims): ${SHOP_FACTS}
TARGET: local businesses within ${RADIUS_MILES} miles of the shop, category "${b.category || "local businesses with company vehicles"}". Think about how they use vehicles and what downtime costs them.
OFFER: a fleet / business account — priority same-day service so vehicles get back on the road fast, one point of contact, budget/mid/premium tire options quoted by text, and our posted prices. There is NO discount: never say "special pricing", "discount" or "deal", and never state a number. The template adds a "See fleet tire prices" button to our live price list, so you may say they can see our prices there.
${followup
  ? "Write a SHORT follow-up (3-4 sentences) to an intro email sent a few days ago that got no reply. Friendly, no guilt-tripping, one easy yes/no question."
  : "Write the FIRST email: 90-130 words, sounds like a real local owner wrote it personally, not a flyer. One clear ask: a quick reply or a call."}
Use {name} for the contact's first name and {business} for the business name. Plain text, short paragraphs, no bullet lists, no emojis, no ALL CAPS, no exclamation-heavy hype, no "I hope this email finds you well".
Do NOT add a signature, address or unsubscribe line — the template adds the logo, signature, Google rating, address and unsubscribe link.
Start with 'SUBJECT: <subject>' (short, lowercase-ish, like a real person's email, honestly saying what the email is about, may include {business}; never start it with "re:" or "fwd:"), then a blank line, then the body. Output ONLY that.`;
      const out = await askClaude(prompt);
      const m = out.match(/^\s*SUBJECT:\s*(.+?)\n([\s\S]*)$/i);
      if (!m) return res.status(502).json({ error: "AI returned nothing usable. Try again." });
      return res.status(200).json({ subject: m[1].trim().replace(FAKE_THREAD, ""), message: m[2].trim() });
    }

    if (b.action === "preview") {
      return res.status(200).json({ html: letter({ message: b.message, signer, to: "preview@example.com", name: "Maria", business: "Sunset Landscaping" }).html });
    }

    if (!b.subject || !b.message) return res.status(400).json({ error: "Write a subject and message first." });
    if (FAKE_THREAD.test(b.subject)) return res.status(400).json({ error: "Take \"re:\" / \"fwd:\" off the subject. On a first-time email it's misleading, which CAN-SPAM forbids." });
    if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: "Email is not set up yet — add your RESEND_API_KEY first." });

    if (b.action === "test") {
      const to = (b.to || (auth.user.email !== "owner" ? auth.user.email : REPLY_TO)).trim();
      const subject = `[TEST] ${personalize(b.subject, { name: "Maria", business: "Sunset Landscaping" })}`;
      const out = await sendOne({ to, from: OUTREACH_FROM, subject, ...letter({ message: b.message, signer, to, name: "Maria", business: "Sunset Landscaping" }) });
      if (!out.sent) return res.status(502).json({ error: out.error || "Test send failed." });
      return res.status(200).json({ ok: true, to });
    }

    if (b.action === "send") {
      const step = Number(b.step) === 2 ? 2 : 1;
      const ids = Array.isArray(b.ids) ? b.ids : [];
      if (!ids.length) return res.status(400).json({ error: "Pick at least one business." });

      const { count } = await supabaseAdmin.from("business_prospects").select("id", { count: "exact", head: true }).gte("last_emailed_at", startOfTodayLA().toISOString());
      const limit = await dailyLimit();
      const room = Math.max(0, limit - (count || 0));
      if (!room) return res.status(429).json({ error: `Daily limit reached (${limit}/day while the sending domain warms up keeps your email out of spam). Send more tomorrow.` });

      const { data: rows } = await supabaseAdmin.from("business_prospects").select("*").in("id", ids);
      const blocked = await suppressedSet();
      const cutoff = Date.now() - FOLLOWUP_DAYS * 864e5;
      const eligible = (rows || []).filter((p) => p.email && !blocked.has(p.email.toLowerCase()) && !DONE.has(p.status)
        && (step === 1 ? p.touches === 0 : p.touches === 1 && p.last_emailed_at && new Date(p.last_emailed_at).getTime() <= cutoff));
      const batch = eligible.slice(0, room);
      if (!batch.length) return res.status(400).json({ error: step === 1 ? "None of those can get an intro (already emailed, replied, or unsubscribed)." : `None of those are ready for a follow-up (needs an intro ${FOLLOWUP_DAYS}+ days ago and no reply).` });

      const { data: camp } = await supabaseAdmin.from("email_campaigns").insert({
        kind: "outreach", subject: b.subject, body: b.message, audience: `businesses (step ${step})`, status: "sending", send_at: new Date().toISOString(), created_by: auth.user.email,
      }).select().single();

      const msgs = batch.map((p) => ({
        to: p.email, from: OUTREACH_FROM,
        subject: personalize(b.subject, { name: p.contact_name, business: p.business_name }),
        ...letter({ message: b.message, signer, to: p.email, name: p.contact_name, business: p.business_name }),
        tags: { campaign: camp?.id, kind: "outreach" },
      }));
      const out = await sendBatch(msgs);
      if (out.sent) {
        await supabaseAdmin.from("business_prospects").update({ status: "emailed", touches: step, last_emailed_at: new Date().toISOString() }).in("id", batch.map((p) => p.id));
      }
      if (camp) await supabaseAdmin.from("email_campaigns").update({ status: out.sent ? "sent" : "failed", recipient_count: batch.length, sent_count: out.sent, error_count: out.failed }).eq("id", camp.id);
      return res.status(200).json({ sent: out.sent, failed: out.failed, skipped: ids.length - batch.length, error: out.error, remainingToday: room - out.sent });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (e) {
    console.error("prospects error:", e);
    return res.status(500).json({ error: "Server error." });
  }
}
