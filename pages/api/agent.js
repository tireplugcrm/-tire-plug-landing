/**
 * Jarvis API for the scheduled Claude agents on the shop PC (lib/agent.js).
 * Auth: "Authorization: Bearer <app_settings.agent_key>".
 *
 * POST { action: "ask", agent, question, details?, call? }  text the owner a yes/no question -> { id, code };
 *                                                     call: true also phones them (pages/api/agent-voice.js)
 * POST { action: "status", id }                       -> { status: open|yes|no, answer }
 * POST { action: "notify", agent, text, call? }       text the owner a FYI (call: true also reads it out)
 * POST { action: "log", agent, message, data? }       write to agent_log
 * POST { action: "invoices" }                         check-in uploads not entered in Tekmetric yet,
 *                                                     with the AI read and a 1-hour photo link
 * POST { action: "entered", ids, note? }              mark uploads entered in Tekmetric
 * POST { action: "stock", csv, confirmShrink? }       Tekmetric inventory CSV -> website stock + prices
 * POST { action: "health" }                           stock freshness, pricing checks, leads, check-in texts, agent errors,
 *                                                     shelf tires priced under cost + $20 (under_margin),
 *                                                     ElevenLabs credit balance for Mary (elevenlabs_credits, .low = flag it)
 * POST { action: "reprice" }                          run the pricing autopilot now (rebuilds stale tire pages)
 * POST { action: "outreach-plan" }                    business cold email due today (lib/outreach.js): cap left, the owner-approved
 *                                                     templates, intros and follow-ups due in priority order, phone-only counts
 * POST { action: "vendor-load", vendor, eta_days, rows: [{ size, brand, model, load_speed?, qty, cost }] }
 *                                                     load one distributor's catalog for the phone AI (replaces its rows; append: true adds a batch)
 * POST { action: "vendor-upload-token" }             a 2-hour pass for /api/vendor-upload (portal pages post their catalogs directly)
 * POST { action: "brake-parts-save", car: { year, make, model, trim?, front_pads, rear_pads, front_rotor?, rear_rotor?,
 *        pads_brand, pads_warranty?, rotor_brand? } }  one car's cheapest AutoZone Pro brake parts (costs), so the phone AI
 *                                                     quotes that car's brakes exactly; { action: "brake-parts" } lists them
 * POST { action: "phone-calls", since? }             Mary's calls (default last 24 h) with quality checks and transcripts
 * POST { action: "quote-queue" }                   phone AI callers waiting on an exact quote (brakes, special-order tires)
 * POST { action: "quote-send", id, title, lines: [[label, amount]], total, tax_included }
 *                                                     text the customer the exact quote; copies to the owner (and the brake tech)
 * POST { action: "outreach-send", step, ids }         send the APPROVED template for that step (1 intro, 2 follow-up) to those
 *                                                     businesses; the agent never supplies the wording
 */
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { agentKeyOk, ask, approval, notify, log } from "../../lib/agent.js";
import { INVOICE_BUCKET } from "../../lib/invoices.js";
import { pricingContext } from "../../lib/pricing-context.js";
import * as P from "../../lib/pricing.js";
import { linesFromCsv } from "../../lib/stock-csv.mjs";
import { isCommercialSize } from "../../lib/pricing-engine.js";
import { dailyLimit, sentToday, eligibleFor, sendOutreach } from "../../lib/outreach.js";
import { suppressedSet } from "../../lib/email.js";
import { sendSms } from "../../lib/sms.js";
import { digits10 } from "../../lib/phone.js";
import { logEvent } from "../../lib/front-desk.js";
import { elevenCredits } from "../../lib/elevenlabs-credits.js";
import { loadVendor, vendorStatus } from "../../lib/vendor-tires.js";
import { brakeParts, saveBrakeParts } from "../../lib/brake-parts.js";
import { autoLead } from "./voice-calls.js";

// Outreach order: the businesses that fit truck and work-vehicle tires first.
const OUTREACH_ORDER = ["Delivery & trucking", "Contractors & trades", "Auto-adjacent", "Rideshare & limo"];
const rank = (c) => { const i = OUTREACH_ORDER.indexOf(c); return i < 0 ? OUTREACH_ORDER.length : i; };
// The owner-approved wording, edited only by a person (app_settings outreach_templates):
// { signer: {name,title}, intro: {subject,message,button}, followup: {subject,message,button} }
async function outreachTemplates() {
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "outreach_templates").maybeSingle();
  try { return JSON.parse(data?.value || "{}"); } catch { return {}; }
}

// ---- Exact quotes (Jarvis quotes agent) ----
// Mary (the phone AI) can only estimate brakes and can't price special-order tires (Toyo, Michelin...).
// Those callers land here; Jarvis looks up the real parts in AutoZone Pro / US AutoForce on the shop PC,
// applies the owner's pricing and sends the exact quote with quote-send.
const isBrakeLead = (l) => /brake|rotor/i.test(`${l.service || ""} ${l.raw?.notes || ""} ${l.raw?.brakes || ""}`);
const isSpecialOrder = (l) => /special order|toyo|michelin/i.test(`${l.service || ""} ${l.raw?.notes || ""}`);
async function quoteQueue() {
  const since = new Date(Date.now() - 3 * 864e5).toISOString();
  const { data } = await supabaseAdmin.from("leads").select("id, created_at, name, phone, vehicle, tire_size, tire_type, service, appointment_at, appt_status, raw")
    .eq("source", "Phone AI").gte("created_at", since).order("created_at");
  return (data || [])
    .filter((l) => !l.raw?.quote_sent_at && l.appt_status !== "canceled" && (isBrakeLead(l) || isSpecialOrder(l)))
    .map((l) => ({
      id: l.id, at: l.created_at, kind: isBrakeLead(l) ? "brakes" : "tires", name: l.name, phone: l.phone,
      vehicle: l.vehicle || l.raw?.vehicle || null, vin_or_plate: l.raw?.vin_or_plate || null,
      brakes: l.raw?.brakes || null, rotors: l.raw?.rotors ?? null, epb: l.raw?.epb ?? null,
      tire_size: l.tire_size, tire: l.tire_type, service: l.service, notes: l.raw?.notes || null,
      appointment_at: l.appointment_at, sms_ok: l.raw?.smsConsent === true,
    }));
}
// b: { id, title, lines: [[label, amount]], total, tax_included, footer? }
async function quoteSend(b, agent) {
  const { data: l } = await supabaseAdmin.from("leads").select("*").eq("id", b.id).maybeSingle();
  if (!l) return { ok: false, error: "Lead not found" };
  if (l.raw?.quote_sent_at) return { ok: false, error: "Quote already sent" };
  if (!Array.isArray(b.lines) || !b.lines.length || !(Number(b.total) > 0) || !b.title) return { ok: false, error: "Need title, lines and total" };
  const d = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;
  const body = [
    `The Tire Plug: ${b.title}`,
    ...b.lines.map(([label, amount]) => `${label}: ${d(amount)}`),
    `${b.tax_included ? "Out the door" : "Total (before tax)"}: ${d(b.total)}`,
    l.appointment_at ? `See you ${new Date(l.appointment_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.` : "Reply here or call 562-500-4625 to book.",
    b.footer || "2331 E Olympic Blvd, Los Angeles.",
  ].join("\n");
  const sms = await sendSms({ to: l.phone, body });
  if (!sms.ok) return { ok: false, error: sms.error || "Text failed" };
  await supabaseAdmin.from("leads").update({ raw: { ...l.raw, quote_sent_at: new Date().toISOString(), quote: { title: b.title, lines: b.lines, total: b.total, tax_included: !!b.tax_included } } }).eq("id", l.id);
  await supabaseAdmin.from("lead_messages").insert({ lead_id: l.id, direction: "outbound", phone: digits10(l.phone), body, twilio_sid: sms.sid, status: sms.status, read: true });
  await logEvent(l.id, "quote_sent", `Jarvis texted ${l.name || "the customer"} the exact quote: ${d(b.total)}`);
  // Copies: the owner always; brake quotes also go to the brake tech (app_settings brake_alert_phone).
  await notify(agent, `Quote sent to ${l.name || "customer"} (${digits10(l.phone).slice(-4)}): ${b.title}, ${d(b.total)}${b.tax_included ? " out the door" : " before tax"}.`);
  // Test leads (raw.test, made for dry runs) never copy the brake tech.
  if (isBrakeLead(l) && !l.raw?.test) {
    const { data: s } = await supabaseAdmin.from("app_settings").select("value").eq("key", "brake_alert_phone").maybeSingle();
    if (s?.value) await sendSms({ to: s.value, body: `Jarvis sent this brake quote to ${l.name || "the customer"} (${digits10(l.phone)}):\n${body}` });
  }
  await log(agent, `quote sent ${l.id}: ${d(b.total)}`);
  return { ok: true, sent: body };
}

export const maxDuration = 60;
export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

// What the background jobs left behind, for the nightly watchdog to judge. Read-only.
async function health() {
  const day = new Date(Date.now() - 864e5).toISOString();
  const keys = ["stock_synced_at", "stock_source", "stock_prices_live", "pricing_autopilot", "pricing_dirty_pages", "pricing_mismatch", "pricing_alerted", "pricing_report_day"];
  const [settings, leads, invoiceDays, commissionDays, errors, open, prices, stock] = await Promise.all([
    supabaseAdmin.from("app_settings").select("key, value, updated_at").in("key", keys),
    supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).gte("created_at", day),
    supabaseAdmin.from("invoice_days").select("*").order("day", { ascending: false }).limit(3),
    supabaseAdmin.from("commission_days").select("*").order("day", { ascending: false }).limit(3),
    supabaseAdmin.from("agent_log").select("at, agent, message").gte("at", day).ilike("message", "error%").order("at", { ascending: false }).limit(20),
    supabaseAdmin.from("agent_approvals").select("code, agent, question, asked_at").eq("status", "open"),
    supabaseAdmin.from("site_prices").select("id, price, source"),
    supabaseAdmin.from("tire_stock").select("id, brand, model, size_key, cost").eq("active", true),
  ]);
  // The money rule: every shelf tire sells for at least cost + $20 (commercial sizes cost + $35).
  // Owner and catalog prices don't follow cost on their own, so they can fall under it.
  const priceOf = new Map((prices.data || []).map((p) => [p.id, p]));
  const under_margin = (stock.data || []).flatMap((t) => {
    const p = priceOf.get(t.id);
    if (!p || p.price == null || !(t.cost > 0)) return [];
    const need = Number(t.cost) + (isCommercialSize(t.size_key) ? 35 : 20);
    return Number(p.price) < need - 0.005 ? [{ tire: `${t.brand} ${t.model} ${t.size_key}`, source: p.source, price: Number(p.price), cost: Number(t.cost), short_by: Math.round((need - p.price) * 100) / 100 }] : [];
  });
  return {
    now: new Date().toISOString(),
    settings: Object.fromEntries((settings.data || []).map((s) => [s.key, { value: s.value, updated_at: s.updated_at }])),
    leads_last_24h: leads.count ?? null,
    invoice_days: invoiceDays.data || [],
    commission_days: commissionDays.data || [],
    agent_errors_24h: errors.data || [],
    open_approvals: open.data || [],
    under_margin,
    elevenlabs_credits: await elevenCredits(),
    vendor_catalogs: await vendorStatus(),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });
  if (!(await agentKeyOk(req))) return res.status(401).json({ error: "Unauthorized" });
  const b = req.body || {};
  const agent = String(b.agent || "jarvis").slice(0, 40);

  try {
    if (b.action === "ask") {
      if (!b.question) return res.status(400).json({ error: "question is required" });
      return res.status(200).json({ ok: true, ...(await ask(agent, String(b.question).slice(0, 600), b.details || null, { call: !!b.call })) });
    }
    if (b.action === "status") {
      const a = await approval(b.id);
      if (!a) return res.status(404).json({ error: "No such request." });
      return res.status(200).json({ ok: true, status: a.status, answer: a.answer, answered_at: a.answered_at });
    }
    if (b.action === "notify") return res.status(200).json(await notify(agent, String(b.text || "").slice(0, 600), { call: !!b.call }));
    if (b.action === "log") { await log(agent, String(b.message || "").slice(0, 2000), b.data || null); return res.status(200).json({ ok: true }); }

    if (b.action === "invoices") {
      const { data, error } = await supabaseAdmin.from("invoice_uploads")
        .select("id, day, file_name, path, read, read_error, uploaded_by, created_at")
        .is("entered_at", null).order("day").order("created_at").limit(60);
      if (error) throw new Error(error.message);
      const uploads = await Promise.all((data || []).map(async (u) => {
        const { data: s } = await supabaseAdmin.storage.from(INVOICE_BUCKET).createSignedUrl(u.path, 3600);
        return { ...u, photo: s?.signedUrl || null };
      }));
      return res.status(200).json({ ok: true, uploads });
    }
    if (b.action === "entered") {
      const ids = Array.isArray(b.ids) ? b.ids : [];
      if (!ids.length) return res.status(400).json({ error: "ids is required" });
      const { error } = await supabaseAdmin.from("invoice_uploads")
        .update({ entered_at: new Date().toISOString(), entered_by: "Jarvis" }).in("id", ids).is("entered_at", null);
      if (error) throw new Error(error.message);
      await log(agent, `marked ${ids.length} invoice upload(s) entered${b.note ? `: ${b.note}` : ""}`, { ids });
      return res.status(200).json({ ok: true });
    }
    if (b.action === "stock") {
      const ctx = pricingContext();
      const lines = linesFromCsv(String(b.csv || ""));
      const stock = await P.syncStock(ctx, lines, { source: "tekmetric-csv", who: "jarvis", allowShrink: !!b.confirmShrink });
      const pages = await P.drainPages(ctx, (path) => res.revalidate(path), { budgetMs: 20000 });
      await log(agent, "synced website stock from a Tekmetric export", { lines: lines.length });
      return res.status(200).json({ ok: true, stock, pages });
    }
    if (b.action === "call-status") {
      const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN;
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${encodeURIComponent(b.sid)}.json`, {
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
      });
      const c = await r.json();
      const notes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${encodeURIComponent(b.sid)}/Notifications.json`, {
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
      }).then((x) => x.json()).catch(() => null);
      return res.status(200).json({ ok: r.ok, status: c.status, duration: c.duration, to: c.to, from: c.from, answered_by: c.answered_by,
        error: c.message || null, notifications: (notes?.notifications || []).map((n) => ({ code: n.error_code, text: n.message_text })) });
    }
    if (b.action === "health") return res.status(200).json({ ok: true, ...(await health()) });
    if (b.action === "reprice") {
      const ctx = pricingContext();
      const report = await P.autopilot(ctx, (path) => res.revalidate(path), { budgetMs: 45000, force: true });
      await log(agent, "ran the pricing autopilot", report);
      return res.status(200).json({ ok: true, report });
    }
    if (b.action === "outreach-plan") {
      const [limit, sent, blocked, t, { data: rows }] = await Promise.all([dailyLimit(), sentToday(), suppressedSet(), outreachTemplates(),
        supabaseAdmin.from("business_prospects").select("id,business_name,category,email,phone,status,touches,last_emailed_at").limit(5000)]);
      const all = rows || [];
      const slim = (p) => ({ id: p.id, business: p.business_name, category: p.category, email: p.email, last_emailed_at: p.last_emailed_at });
      const byRank = (a, c) => rank(a.category) - rank(c.category) || String(a.business_name).localeCompare(String(c.business_name));
      const intros = all.filter((p) => eligibleFor(1, p, blocked)).sort(byRank).map(slim);
      const followups = all.filter((p) => eligibleFor(2, p, blocked)).sort((a, c) => new Date(a.last_emailed_at) - new Date(c.last_emailed_at)).map(slim);
      const phoneOnly = {};
      for (const p of all) if (p.status === "needs_email" && p.phone) phoneOnly[p.category || "Other"] = (phoneOnly[p.category || "Other"] || 0) + 1;
      return res.status(200).json({ ok: true, limit, sentToday: sent, room: Math.max(0, limit - sent), templates: { intro: !!t.intro, followup: !!t.followup, ...t }, intros, followups, phoneOnly });
    }
    if (b.action === "outreach-send") {
      const step = Number(b.step) === 2 ? 2 : 1;
      const t = await outreachTemplates();
      const tpl = step === 1 ? t.intro : t.followup;
      if (!tpl?.subject || !tpl?.message) return res.status(400).json({ error: `No approved ${step === 1 ? "intro" : "follow-up"} template yet. Ask the owner to approve one in Admin > Businesses.` });
      const r = await sendOutreach({ ids: b.ids, step, subject: tpl.subject, message: tpl.message, button: tpl.button, signer: t.signer || {}, createdBy: `jarvis:${agent}` });
      await log(agent, `outreach step ${step}: sent ${r.body.sent ?? 0}${r.body.error ? ` (${r.body.error})` : ""}`, { ids: r.body.sentIds || [] });
      return res.status(r.status).json({ ok: r.status === 200, ...r.body });
    }
    // Nightly distributor catalog load (Jarvis vendor sync): replaces that vendor's rows in vendor_tires.
    if (b.action === "vendor-load") {
      if (!b.vendor || !Array.isArray(b.rows)) return res.status(400).json({ error: "vendor and rows are required" });
      const r = await loadVendor(String(b.vendor).slice(0, 40), b.rows, b.eta_days, b.append === true);
      await log(agent, `vendor-load ${b.vendor}: ${r.ok ? `${r.loaded} tires` : `error ${r.error}`}`);
      return res.status(r.ok ? 200 : 400).json(r);
    }
    // Brake parts per car (lib/brake-parts.js): Jarvis saves each car it prices on AutoZone Pro.
    if (b.action === "brake-parts-save") {
      const c = b.car || {};
      if (!c.year || !c.make || !c.model || (c.front_pads == null && c.rear_pads == null)) return res.status(400).json({ error: "car needs year, make, model and front_pads or rear_pads" });
      const n = await saveBrakeParts(c);
      await log(agent, `brake parts saved: ${c.year} ${c.make} ${c.model}${c.trim ? ` ${c.trim}` : ""}`, c);
      return res.status(200).json({ ok: true, cars: n });
    }
    // Phone calls since a time that didn't book or save a lead become rep leads (same as the post-call webhook now does).
    if (b.action === "phone-leads-backfill") {
      const since = b.since || new Date(Date.now() - 24 * 36e5).toISOString();
      const { data: rows, error } = await supabaseAdmin.from("phone_calls").select("*").gte("started_at", since).order("started_at");
      if (error) throw error;
      let made = 0;
      for (const r of rows || []) if (await autoLead(r)) made++;
      return res.status(200).json({ ok: true, calls: rows?.length || 0, leads: made });
    }
    if (b.action === "brake-parts") return res.status(200).json({ cars: await brakeParts() });
    // A 2-hour pass for /api/vendor-upload, so a portal page can post its catalog without holding the Jarvis key.
    if (b.action === "vendor-upload-token") {
      const token = (await import("node:crypto")).randomBytes(24).toString("hex");
      const expires = new Date(Date.now() + 2 * 3600e3).toISOString();
      await supabaseAdmin.from("app_settings").upsert({ key: "vendor_upload_token", value: JSON.stringify({ token, expires }), updated_at: new Date().toISOString() }, { onConflict: "key" });
      return res.status(200).json({ token, expires, url: "https://tireplugla.com/api/vendor-upload" });
    }
    if (b.action === "quote-queue") return res.status(200).json({ quotes: await quoteQueue() });
    // Mary's calls since a time (default 24 h), for the coach: outcome, failed quality checks, transcript.
    if (b.action === "phone-calls") {
      const since = b.since || new Date(Date.now() - 864e5).toISOString();
      const { data } = await supabaseAdmin.from("phone_calls")
        .select("id, started_at, duration_secs, intent, vehicle, tire_size, quoted, booked, lead_saved, transferred, transfer_reason, alignment_offered, alignment_accepted, objection, lost_reason, quality_score, quality, summary, transcript")
        .eq("test", false).gte("started_at", since).order("started_at").limit(60);
      return res.status(200).json({ calls: data || [] });
    }
    if (b.action === "quote-send") {
      const r = await quoteSend(b, agent);
      return res.status(r.ok ? 200 : 400).json(r);
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error("agent:", e);
    await log(agent, `error: ${e.message}`).catch(() => {});
    return res.status(400).json({ error: e.message || "Agent request failed" });
  }
}
