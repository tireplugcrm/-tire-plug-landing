/**
 * Emailed tire quotes: one link per tire option (/quote/<lead id>.<option>.<sig>), each with the full
 * out-the-door breakdown and a Book button. The quote lives on a lead (leads.quotes + raw.quote), so the
 * customer shows up in Admin like any lead, and booking goes through the same intake as the website
 * (owner alert, confirmation email/text, "ORDER NOW" when the tires need ordering).
 *
 * POST { action: "create", code | admin, name, email?, phone?, vehicle?, size, install, fee, taxRate,
 *        options: [{ brand, model, price, availability: "in_stock"|"next_day"|"special_order", note?, photo?, logo? }] }
 *        -> { lead_id, links: [url] }                 (owner only: admin login or the /alex code)
 * POST { action: "get", t }                         -> { quote, option, breakdown, days, booked }
 * POST { action: "book", t, at, alignment? }        -> { ok, when }   (alignment: true adds the quote's alignment offer)
 * create also takes alignment: { price, regular } to offer an alignment on the same booking.
 */
import crypto from "node:crypto";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../lib/adminAuth.js";
import { checkStaffCode } from "../../lib/staff-code.js";
import { setting, SITE } from "../../lib/invoices.js";
import { openSlots, isSlotOpen, fmtWhen, laParts } from "../../lib/booking.js";
import { onNewLead, newToken } from "../../lib/front-desk.js";

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

async function sig(id, i) {
  const key = (await setting("agent_key")) || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return crypto.createHmac("sha256", key).update(`quote:${id}:${i}`).digest("base64url").slice(0, 16);
}
async function parse(t) {
  const m = /^([0-9a-f-]{36})\.(\d{1,2})\.([\w-]{16})$/.exec(String(t || ""));
  if (!m) return null;
  const expect = await sig(m[1], +m[2]);
  if (expect.length !== m[3].length || !crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(m[3]))) return null;
  return { id: m[1], i: +m[2] };
}

function breakdown(q, o) {
  const qty = Number(q.qty) || 4;
  const tires = r2(o.price * qty), install = r2(q.install * qty), fee = r2(q.fee * qty), tax = r2(tires * q.taxRate);
  return { qty, each: r2(o.price), tires, install, fee, tax, total: r2(tires + install + fee + tax) };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Database not configured." });
  const b = req.body || {};

  try {
    if (b.action === "create") {
      const admin = (b.password || b.accessToken || req.headers.authorization) ? (await requireAdmin(req)).ok : false;
      if (!admin && !(await checkStaffCode("alex", String(b.code || ""))).ok) return res.status(401).json({ error: "Unauthorized" });
      const options = (Array.isArray(b.options) ? b.options : []).filter((o) => o && o.brand && Number(o.price) > 0).slice(0, 8)
        .map((o) => ({ brand: String(o.brand), model: String(o.model || ""), price: r2(o.price), availability: ["in_stock", "next_day", "special_order"].includes(o.availability) ? o.availability : "special_order", note: o.note ? String(o.note).slice(0, 200) : null, photo: o.photo || null, logo: o.logo || null, warranty: o.warranty || null }));
      if (!options.length || !b.size) return res.status(400).json({ error: "Need a size and at least one option with a price." });
      const alignment = b.alignment && Number(b.alignment.price) > 0 ? { price: r2(b.alignment.price), regular: r2(b.alignment.regular || 0) || null } : null;
      const quote = { alignment, size: String(b.size), qty: Number(b.qty) || 4, install: r2(b.install ?? 25), fee: r2(b.fee ?? 2), taxRate: Number(b.taxRate ?? 0.1), note: b.note || null, options, sent_at: new Date().toISOString() };
      const { data: lead, error } = await supabaseAdmin.from("leads").insert({
        name: b.name || null, email: b.email || null, phone: b.phone || null, vehicle: b.vehicle || null, tire_size: quote.size,
        service: "New tires", source: "Email quote", lead_priority: "WARM", status: "quoted", tags: ["Email quote"],
        first_response_at: new Date().toISOString(),
        quotes: options.map((o) => ({ brand: `${o.brand} ${o.model}`.trim(), price: o.price, qty: quote.qty })),
        raw: { quote, smsConsent: false },
      }).select("id").single();
      if (error) throw error;
      const links = [];
      for (let i = 0; i < options.length; i++) links.push(`${SITE}/quote/${lead.id}.${i}.${await sig(lead.id, i)}`);
      return res.json({ lead_id: lead.id, links });
    }

    // Owner: add or change the alignment offer on a quote already sent ({ lead_id, alignment: { price, regular } | null }).
    if (b.action === "setAlignment") {
      const admin = (b.password || b.accessToken || req.headers.authorization) ? (await requireAdmin(req)).ok : false;
      if (!admin && !(await checkStaffCode("alex", String(b.code || ""))).ok) return res.status(401).json({ error: "Unauthorized" });
      const { data: l } = await supabaseAdmin.from("leads").select("id, raw").eq("id", b.lead_id).maybeSingle();
      if (!l?.raw?.quote) return res.status(404).json({ error: "No quote on that lead." });
      const alignment = b.alignment && Number(b.alignment.price) > 0 ? { price: r2(b.alignment.price), regular: r2(b.alignment.regular || 0) || null } : null;
      const { error } = await supabaseAdmin.from("leads").update({ raw: { ...l.raw, quote: { ...l.raw.quote, alignment } } }).eq("id", l.id);
      if (error) throw error;
      return res.json({ ok: true, alignment });
    }

    const p = await parse(b.t);
    if (!p) return res.status(404).json({ error: "This quote link isn't valid." });
    const { data: lead } = await supabaseAdmin.from("leads").select("*").eq("id", p.id).maybeSingle();
    const q = lead?.raw?.quote, o = q?.options?.[p.i];
    if (!o) return res.status(404).json({ error: "This quote isn't available anymore. Call or text us." });
    // Ordered tires can't go on the same day; in-stock ones can.
    const today = laParts(new Date()).ymd;
    const slotDays = async () => (await openSlots()).filter((d) => o.availability === "in_stock" || d.date > today);
    const booked = lead.appointment_at && ["confirmed", "checked_in"].includes(lead.appt_status) ? { when: fmtWhen(lead.appointment_at), option: lead.raw?.chosen ?? null } : null;

    if (b.action === "get") {
      return res.json({
        quote: { alignment: q.alignment || null, size: q.size, vehicle: lead.vehicle, first: String(lead.name || "").split(/\s+/)[0] || null, others: q.options.length },
        option: o, breakdown: breakdown(q, o), booked, days: booked ? [] : await slotDays(),
      });
    }

    if (b.action === "book") {
      if (booked) return res.status(409).json({ error: `You're already booked for ${booked.when}. Call or text us to change it.` });
      const at = new Date(b.at);
      const ok = !Number.isNaN(at.getTime()) && (await slotDays()).some((d) => d.slots.some((s) => s.at === at.toISOString())) && (await isSlotOpen(at.toISOString()));
      if (!ok) return res.status(409).json({ code: "slot_taken", error: "That time was just taken, pick another.", days: await slotDays() });
      const bd = breakdown(q, o);
      const align = b.alignment && q.alignment ? q.alignment : null;
      const patch = {
        service: align ? `New tires + alignment ($${q.alignment.price})` : "New tires",
        appointment_at: at.toISOString(), appt_status: "confirmed", appt_token: newToken(), appt_booked_at: new Date().toISOString(),
        tire_type: `${o.brand} ${o.model}`.trim(), status: "won",
        raw: { ...lead.raw, chosen: p.i, quantity: bd.qty, price: o.price, availability: o.availability, quoteTotal: bd.total, alignment: align ? align.price : null },
      };
      const { data: upd, error } = await supabaseAdmin.from("leads").update(patch).eq("id", lead.id).select("*").single();
      if (error) throw error;
      await onNewLead(upd); // owner alert (ORDER NOW when needed) + confirmation email/text, same as a website booking
      return res.json({ ok: true, when: fmtWhen(at) });
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error("quote:", e);
    return res.status(500).json({ error: "Something went wrong. Call or text us at (562) 250-3737." });
  }
}
