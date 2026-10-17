/**
 * Customer's own appointment page (/appointment/<token>) — public, the token is the guard.
 * POST { token, action: "get" }                    -> { name, service, vehicle, at, when, status }
 * POST { token, action: "cancel" }                 -> { ok }
 * POST { token, action: "reschedule", at }         -> { ok, at, when }   (409 slot_taken with fresh days)
 * Unknown token, or an appointment that's past/finished: 404 { error }.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { isSlotOpen, openSlots, fmtWhen } from "../../../lib/booking.js";
import { alertOwner, logEvent, sendConfirmation } from "../../../lib/front-desk.js";

const EXPIRED = "This link has expired. Call or text us at 562-500-4625.";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Booking is temporarily unavailable. Please call 562-500-4625." });
  const { token, action, at } = req.body || {};
  if (!token || String(token).length < 16) return res.status(404).json({ error: EXPIRED });

  const { data: lead } = await supabaseAdmin.from("leads").select("*").eq("appt_token", token).maybeSingle();
  const live = lead && lead.appointment_at && lead.appt_status === "confirmed" && new Date(lead.appointment_at).getTime() > Date.now() - 3600e3;
  if (!live) return res.status(404).json({ error: EXPIRED });

  try {
    if (action === "get") {
      return res.status(200).json({ name: (lead.name || "").split(" ")[0], service: lead.service, vehicle: lead.vehicle, at: lead.appointment_at, when: fmtWhen(lead.appointment_at), status: lead.appt_status });
    }
    if (action === "cancel") {
      await supabaseAdmin.from("leads").update({ appt_status: "canceled" }).eq("id", lead.id);
      await logEvent(lead.id, "canceled", `${lead.name || "Customer"} canceled ${fmtWhen(lead.appointment_at)} online`);
      await alertOwner(`❌ Canceled: ${fmtWhen(lead.appointment_at)}`, `${lead.name || "A customer"} canceled their ${fmtWhen(lead.appointment_at)} appointment (${lead.service || "service"}). ${lead.phone || ""}`.trim());
      return res.status(200).json({ ok: true });
    }
    if (action === "reschedule") {
      if (!at || !(await isSlotOpen(at, lead.id))) {
        return res.status(409).json({ success: false, code: "slot_taken", error: "That time was just taken, pick another.", days: await openSlots({ ignoreLeadId: lead.id }) });
      }
      const old = lead.appointment_at;
      const iso = new Date(at).toISOString();
      const { data: updated } = await supabaseAdmin.from("leads").update({ appointment_at: iso, appt_booked_at: new Date().toISOString() }).eq("id", lead.id).select().single();
      await logEvent(lead.id, "rescheduled", `${lead.name || "Customer"} moved ${fmtWhen(old)} → ${fmtWhen(iso)}`);
      await sendConfirmation(updated, { rescheduled: true });
      await alertOwner(`🔁 Rescheduled: ${lead.name || "customer"}`, `${lead.name || "A customer"} moved their appointment from ${fmtWhen(old)} to ${fmtWhen(iso)} (${lead.service || "service"}).`);
      return res.status(200).json({ ok: true, at: iso, when: fmtWhen(iso) });
    }
    return res.status(400).json({ error: "Unknown action." });
  } catch (e) {
    console.error("manage error:", e);
    return res.status(500).json({ error: "Something went wrong. Please call 562-500-4625." });
  }
}
