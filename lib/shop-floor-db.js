// Server-only: reads the Shop Floor board for the admin and the TV display.
import { supabaseAdmin } from "./supabaseAdmin.js";
import { laParts, laInstant } from "./booking.js";
import { STAGE_KEYS, HOLD_KEYS } from "./shop-floor.js";

// Active jobs, the techs, today's finished jobs (for turnaround numbers), and today's
// booked appointments that haven't arrived yet (checking one in puts it on the board).
export async function loadBoard() {
  const dayStart = laInstant(laParts().ymd, 0);
  const dayEnd = new Date(dayStart.getTime() + 864e5);

  const [{ data: orders, error }, { data: staff }, { data: todayDone }, { data: appts }, { data: apptSetting }] = await Promise.all([
    supabaseAdmin.from("work_orders").select("*").eq("archived", false).order("created_at", { ascending: true }),
    supabaseAdmin.from("staff").select("id, name, role").eq("active", true).order("name"),
    supabaseAdmin.from("work_orders").select("id, created_at, started_at, done_at").gte("done_at", dayStart.toISOString()),
    supabaseAdmin.from("leads").select("id, name, phone, vehicle, tire_size, tire_type, service, raw, appointment_at, appt_status")
      .gte("appointment_at", dayStart.toISOString()).lt("appointment_at", dayEnd.toISOString())
      .or("appt_status.is.null,appt_status.eq.confirmed").order("appointment_at"),
    supabaseAdmin.from("app_settings").select("value").eq("key", "shop_show_appointments").maybeSingle(),
  ]);
  if (error) throw error;
  const appointments = (appts || []).map((l) => ({
    id: l.id, name: l.name, phone: l.phone, vehicle: l.vehicle, tire_size: l.tire_size, service: l.service,
    tire_qty: Number(l.raw?.quantity) || null, tire_name: l.tire_type || null, appointment_at: l.appointment_at,
  }));
  // The Appointments column is on unless someone switched it off on the Shop Floor.
  return { orders: orders || [], staff: staff || [], todayDone: todayDone || [], appointments, showAppointments: apptSetting?.value !== "0" };
}

// Move a job to another stage, stamp the times, and log who did it (admin board and bay TVs).
// Returns { error } (a message) or {}.
export async function setJobStatus(id, status, { holdReason, by } = {}) {
  if (!STAGE_KEYS.includes(status)) return { error: "Bad status." };
  const now = new Date().toISOString();
  const { data: cur, error: e1 } = await supabaseAdmin.from("work_orders").select("status, started_at, archived").eq("id", id).single();
  if (e1 || !cur || cur.archived) return { error: "That job isn't on the board." };
  const patch = { status, updated_at: now, hold_reason: null, hold_since: null };
  if (status === "in_bay" && !cur.started_at) patch.started_at = now;
  if (status === "done") patch.done_at = now;
  if (status === "waiting") patch.done_at = null;
  if (status === "on_hold") {
    patch.hold_reason = HOLD_KEYS.includes(holdReason) ? holdReason : "other";
    patch.hold_since = now;
  }
  const { error } = await supabaseAdmin.from("work_orders").update(patch).eq("id", id);
  if (error) return { error: error.message };
  await supabaseAdmin.from("work_order_events").insert({ work_order_id: id, from_status: cur.status, to_status: status, note: patch.hold_reason, by_name: by || null });
  return {};
}
