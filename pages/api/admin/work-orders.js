/**
 * Shop Floor / Work Orders board. Owner/Google gated. Schema: lib/workorders-schema.sql + -v2.sql.
 * POST actions (each returns the board: { orders, staff, todayDone }):
 *   { action: "list" }
 *   { action: "create", order }              -> add a job (status waiting)
 *   { action: "update", id, patch }          -> edit job fields (tech, bay, job types, parts, promised time…)
 *   { action: "setStatus", id, status, hold_reason } -> waiting | in_bay | on_hold | done (stamps times, logs it)
 *   { action: "assign", id, assigned_staff_id }
 *   { action: "archive", id }                -> picked up, off the board
 *   { action: "remove", id, reason }         -> off the board without a pickup (mistake, duplicate, left);
 *                                               not counted as completed, kept in the history
 *   { action: "clearCompleted" }             -> every completed job on the board marked picked up
 *   { action: "tvLink" }                     -> { url } for the shop TVs (owner only)
 *   { action: "showAppointments", on }       -> switch the Appointments column on/off (admin + TVs)
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { JOB_TYPE_KEYS, PARTS_KEYS, REMOVE_KEYS, fixTireTypes } from "../../../lib/shop-floor.js";
import { loadBoard, setJobStatus } from "../../../lib/shop-floor-db.js";

const text = (v, max = 200) => (v == null || v === "" ? null : String(v).trim().slice(0, max) || null);
const when = (v) => (v && !Number.isNaN(new Date(v).getTime()) ? new Date(v).toISOString() : null);

// Only the fields the board may set, cleaned.
function clean(o) {
  const out = {};
  if ("customer_name" in o) out.customer_name = text(o.customer_name, 80);
  if ("phone" in o) out.phone = text(o.phone, 30);
  if ("vehicle" in o) out.vehicle = text(o.vehicle, 80);
  if ("service" in o) out.service = text(o.service, 200);
  if ("note" in o) out.note = text(o.note, 500);
  if ("location" in o) out.location = text(o.location, 40);
  if ("bay" in o) out.bay = text(o.bay, 20);
  if ("tire_size" in o) out.tire_size = text(o.tire_size, 40);
  if ("tire_brand" in o) out.tire_brand = text(o.tire_brand, 60);
  if ("tire_model" in o) out.tire_model = text(o.tire_model, 80);
  if ("tire_img" in o) out.tire_img = /^\/images\/[\w./-]+$/.test(o.tire_img || "") ? o.tire_img : null;
  if ("tire_qty" in o) out.tire_qty = Number.isInteger(+o.tire_qty) && +o.tire_qty > 0 && +o.tire_qty <= 8 ? +o.tire_qty : null;
  if ("assigned_staff_id" in o) out.assigned_staff_id = o.assigned_staff_id || null;
  if ("job_types" in o) out.job_types = (Array.isArray(o.job_types) ? o.job_types : []).filter((k) => JOB_TYPE_KEYS.includes(k));
  if ("parts_status" in o) out.parts_status = PARTS_KEYS.includes(o.parts_status) ? o.parts_status : "na";
  if ("promised_at" in o) out.promised_at = when(o.promised_at);
  if ("rush" in o) out.rush = !!o.rush;
  if ("waiter" in o) out.waiter = !!o.waiter;
  // A shelf tire is a new tire: never "used tires" with a shelf tire on it.
  return "job_types" in out && "tire_brand" in out ? fixTireTypes(out) : out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { action, id } = req.body || {};
  const by = auth.user?.name || null;
  const now = new Date().toISOString();
  const fail = (error) => res.status(500).json({ error: error.message });
  const log = (from_status, to_status, note) =>
    supabaseAdmin.from("work_order_events").insert({ work_order_id: id, from_status, to_status, note: note || null, by_name: by });

  try {
    if (action === "tvLink") {
      if (!auth.user?.isOwner) return res.status(403).json({ error: "Only the owner can get the TV link." });
      const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "shop_tv_key").maybeSingle();
      if (!data?.value) return res.status(400).json({ error: "Run lib/workorders-schema-v2.sql in Supabase first." });
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const proto = req.headers["x-forwarded-proto"] || (String(host).startsWith("localhost") ? "http" : "https");
      return res.status(200).json({ url: `${proto}://${host}/shop-tv?key=${data.value}` });
    }

    if (action === "showAppointments") {
      const { error } = await supabaseAdmin.from("app_settings").upsert({ key: "shop_show_appointments", value: req.body.on ? "1" : "0" }, { onConflict: "key" });
      if (error) return fail(error);
    } else if (action === "create") {
      const o = clean(req.body.order || {});
      if (!o.customer_name && !o.vehicle) return res.status(400).json({ error: "Add a customer name or vehicle." });
      const { data: row, error } = await supabaseAdmin.from("work_orders")
        .insert({ location: "Olympic", ...o, status: "waiting", updated_at: now }).select("id").single();
      if (error) return fail(error);
      await supabaseAdmin.from("work_order_events").insert({ work_order_id: row.id, from_status: null, to_status: "waiting", by_name: by });
    } else if (action === "update" || action === "assign") {
      const patch = clean(action === "assign" ? { assigned_staff_id: req.body.assigned_staff_id } : req.body.patch || {});
      const { error } = await supabaseAdmin.from("work_orders").update({ ...patch, updated_at: now }).eq("id", id);
      if (error) return fail(error);
    } else if (action === "setStatus") {
      const r = await setJobStatus(id, req.body.status, { holdReason: req.body.hold_reason, by });
      if (r.error) return res.status(400).json({ error: r.error });
    } else if (action === "archive") {
      const { error } = await supabaseAdmin.from("work_orders").update({ archived: true, picked_up_at: now, updated_at: now }).eq("id", id);
      if (error) return fail(error);
      await log("done", "picked_up");
    } else if (action === "remove") {
      const reason = REMOVE_KEYS.includes(req.body.reason) ? req.body.reason : "other";
      const { data: cur } = await supabaseAdmin.from("work_orders").select("status").eq("id", id).maybeSingle();
      if (!cur) return res.status(404).json({ error: "That job isn't on the board." });
      // done_at cleared so a removed job never counts as completed in today's numbers.
      const { error } = await supabaseAdmin.from("work_orders").update({ archived: true, done_at: null, updated_at: now }).eq("id", id);
      if (error) return fail(error);
      await log(cur.status, "removed", reason);
    } else if (action === "clearCompleted") {
      const { data: done, error } = await supabaseAdmin.from("work_orders").update({ archived: true, picked_up_at: now, updated_at: now })
        .eq("archived", false).eq("status", "done").select("id");
      if (error) return fail(error);
      if (done?.length) await supabaseAdmin.from("work_order_events").insert(done.map((d) => ({ work_order_id: d.id, from_status: "done", to_status: "picked_up", note: "cleared all completed", by_name: by })));
    }

    return res.status(200).json(await loadBoard());
  } catch (e) {
    return res.status(500).json({ error: "Server error." });
  }
}
