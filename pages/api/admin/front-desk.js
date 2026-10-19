/**
 * Front Desk screen (admin home). Owner/Google gated.
 *
 * POST { action: "board" } -> everything the screen shows (runs the watchdog first, at most every 2 min)
 * POST { action, id, ... } for one lead:
 *   "handled"      a person reached out (stops unanswered-lead alerts)
 *   "tires"        tires ordered for this appointment
 *   "arrived"      ordered tires arrived -> "your tires are here" email/text to the customer
 *   "check_in"     customer arrived -> a Shop Floor work order
 *   "done"         job finished -> marks the lead booked, sends thank-you + review ask
 *   "no_show"      didn't come -> "we missed you, pick a new time" text/email
 *   "cancel"       cancel the appointment
 *   "resend"       resend the confirmation
 *   "reschedule"   { at } move the appointment (sends a new confirmation)
 * POST { action: "settings", capacity }  cars per 30-min slot
 * POST { action: "samples", to? }       the 5 booking-sequence emails to you, marked [Sample]
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { runWatchdog, logEvent, sendConfirmation, sendNoShowFollowup, sendThankYou, sendSampleEmails, sendTiresArrived, OWNER_EMAILS, OWNER_PHONES, orderInfo } from "../../../lib/front-desk.js";
import { getCapacity, isSlotOpen, openSlots, laParts, laInstant, fmtWhen } from "../../../lib/booking.js";
import { smsConfigured } from "../../../lib/sms.js";

export const maxDuration = 60;
const LEAD_COLS = "id,created_at,name,phone,email,vehicle,tire_size,tire_type,service,service_timing,lead_priority,status,channel,source,appointment_at,appt_status,appt_booked_at,first_response_at,tires_ordered_at,tires_arrived_at,work_order_id,raw";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });
  const { action = "board", id } = req.body || {};

  try {
    if (action === "board") {
      const { data: lastRun } = await supabaseAdmin.from("app_settings").select("value").eq("key", "front_desk_last_run").maybeSingle();
      if (!lastRun?.value || Date.now() - new Date(lastRun.value).getTime() > 120e3) {
        try { await runWatchdog(); } catch (e) { console.error("watchdog:", e); }
      }
      const today = laParts().ymd;
      const dayStart = laInstant(today, 0), weekEnd = new Date(dayStart.getTime() + 8 * 864e5);
      const [unanswered, appts, events, capacity, run] = await Promise.all([
        supabaseAdmin.from("leads").select(LEAD_COLS).eq("status", "new").is("first_response_at", null).or("appt_status.is.null,appt_status.neq.canceled").gte("created_at", new Date(Date.now() - 14 * 864e5).toISOString()).order("created_at", { ascending: true }),
        supabaseAdmin.from("leads").select(LEAD_COLS).not("appointment_at", "is", null).gte("appointment_at", new Date(dayStart.getTime() - 864e5).toISOString()).lt("appointment_at", weekEnd.toISOString()).order("appointment_at"),
        supabaseAdmin.from("front_desk_events").select("*").order("created_at", { ascending: false }).limit(60),
        getCapacity(),
        supabaseAdmin.from("app_settings").select("value").eq("key", "front_desk_last_run").maybeSingle(),
      ]);
      if (unanswered.error) return res.status(500).json({ error: `${unanswered.error.message}. Run lib/frontdesk-schema.sql in Supabase first.` });
      const contactable = (l) => !!(l.email || (l.phone && l.raw?.smsConsent === true));
      const slim = (l) => { const { raw, ...rest } = l; const o = orderInfo(l); return { ...rest, contactable: contactable(l), quantity: o.quantity, price: o.price, availability: raw?.availability || null }; };
      return res.status(200).json({
        today,
        unanswered: (unanswered.data || []).map(slim),
        appointments: (appts.data || []).map(slim),
        events: events.data || [],
        capacity,
        lastRun: run.data?.value || null,
        alerts: { emails: OWNER_EMAILS, phones: OWNER_PHONES, emailOn: !!process.env.RESEND_API_KEY, smsOn: smsConfigured() },
      });
    }

    if (action === "settings") {
      const cap = Math.max(1, Math.min(10, Number(req.body.capacity) || 2));
      await supabaseAdmin.from("app_settings").upsert({ key: "booking_capacity", value: String(cap) }, { onConflict: "key" });
      return res.status(200).json({ ok: true, capacity: cap });
    }

    if (action === "samples") {
      const to = String(req.body.to || (auth.user.email !== "owner" ? auth.user.email : OWNER_EMAILS[0]) || "").trim();
      if (!/\S+@\S+\.\S+/.test(to)) return res.status(400).json({ error: "Enter an email address." });
      if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: "Email isn't set up (RESEND_API_KEY)." });
      const sent = await sendSampleEmails(to);
      return res.status(200).json({ ok: sent > 0, sent, to });
    }

    if (action === "slots") return res.status(200).json({ days: await openSlots({ ignoreLeadId: id }) });

    const { data: lead } = await supabaseAdmin.from("leads").select("*").eq("id", id).single();
    if (!lead) return res.status(404).json({ error: "Lead not found." });
    const now = new Date().toISOString();
    const by = auth.user.name || "Owner";
    const patch = (p) => supabaseAdmin.from("leads").update(p).eq("id", id);
    const handled = { first_response_at: lead.first_response_at || now };

    if (action === "handled") {
      await patch({ ...handled, status: lead.status === "new" ? "called" : lead.status });
      await logEvent(id, "handled", `${by} reached out to ${lead.name || "lead"}`);
    } else if (action === "tires") {
      await patch({ tires_ordered_at: now, ...handled });
      await logEvent(id, "tires", `${by}: tires ordered for ${lead.name || "customer"} (${lead.tire_size || "size n/a"})`);
    } else if (action === "arrived") {
      await patch({ tires_arrived_at: now, tires_ordered_at: lead.tires_ordered_at || now, ...handled });
      const sent = await sendTiresArrived(lead);
      await logEvent(id, "tires", `${by}: tires arrived for ${lead.name || "customer"}${sent.email || sent.text ? " — customer told" : ""}`);
    } else if (action === "check_in") {
      const { data: wo } = await supabaseAdmin.from("work_orders").insert({ customer_name: lead.name, phone: lead.phone, vehicle: lead.vehicle, service: lead.service, location: "Olympic", status: "waiting", note: `Online booking ${fmtWhen(lead.appointment_at)}${lead.tire_size ? ` · ${lead.tire_size}` : ""}` }).select("id").single();
      await patch({ appt_status: "checked_in", work_order_id: wo?.id || null, ...handled });
      await logEvent(id, "checked_in", `${lead.name || "Customer"} checked in — added to Shop Floor`);
    } else if (action === "done") {
      await patch({ appt_status: "done", status: "booked", booked_at: lead.booked_at || now, ...handled });
      if (lead.work_order_id) await supabaseAdmin.from("work_orders").update({ status: "done", done_at: now }).eq("id", lead.work_order_id);
      await sendThankYou(lead);
      await logEvent(id, "done", `${lead.name || "Customer"} done — thank-you + review request sent`);
    } else if (action === "no_show") {
      await patch({ appt_status: "no_show", ...handled });
      await sendNoShowFollowup(lead);
      await logEvent(id, "no_show", `${lead.name || "Customer"} no-show — sent a "pick a new time" message`);
    } else if (action === "cancel") {
      await patch({ appt_status: "canceled", ...handled });
      await logEvent(id, "canceled", `${by} canceled ${lead.name || "customer"}'s ${fmtWhen(lead.appointment_at)} appointment`);
    } else if (action === "resend") {
      await sendConfirmation(lead);
    } else if (action === "reschedule") {
      const at = req.body.at;
      if (!at || !(await isSlotOpen(at, id))) return res.status(409).json({ error: "That time is full. Pick another." });
      const { data: updated } = await supabaseAdmin.from("leads").update({ appointment_at: new Date(at).toISOString(), appt_status: "confirmed", appt_booked_at: now, ...handled }).eq("id", id).select().single();
      await logEvent(id, "rescheduled", `${by} moved ${lead.name || "customer"} to ${fmtWhen(at)}`);
      await sendConfirmation(updated, { rescheduled: true });
    } else {
      return res.status(400).json({ error: "Unknown action." });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("front-desk error:", e);
    return res.status(500).json({ error: "Server error." });
  }
}
