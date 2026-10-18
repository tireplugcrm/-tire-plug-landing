/**
 * Update a lead or subscriber (status, owner notes). Password gated.
 * table must be "leads" or "subscribers".
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { logEvent } from "../../../lib/front-desk.js";

const ALLOWED = {
  leads: { status: ["new", "called", "booked", "dead"], owner_notes: true, quotes: true, revenue: true, road_hazard: true, services: true, email: true, phone: true },
  subscribers: { status: ["active", "unsubscribed"], owner_notes: false },
  email_replies: { read: true },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  const { table, id, status, owner_notes, read, quotes, revenue_amount, road_hazard_per_tire, services, email, phone } = req.body || {};
  if (!supabaseAdmin || !id || !ALLOWED[table]) {
    return res.status(400).json({ error: "Missing config, id, or invalid table." });
  }

  const rules = ALLOWED[table];
  const patch = {};
  if (status !== undefined && rules.status && rules.status.includes(status)) {
    patch.status = status;
    // Stamp the booked time the first time a lead is marked booked.
    if (table === "leads" && status === "booked") patch.booked_at = new Date().toISOString();
  }
  if (owner_notes !== undefined && rules.owner_notes) patch.owner_notes = owner_notes;
  if (read !== undefined && rules.read) patch.read = !!read;
  if (quotes !== undefined && rules.quotes) {
    patch.quotes = quotes;
    // Saving a real quote starts the funnel clock (New -> Quoted -> Follow-up -> Cold).
    if (Array.isArray(quotes) && quotes.some((qq) => qq && (qq.brand || qq.price))) patch.quoted_at = new Date().toISOString();
  }
  if (revenue_amount !== undefined && rules.revenue) {
    patch.revenue_amount = revenue_amount === null || revenue_amount === "" ? null : Number(revenue_amount);
  }
  if (road_hazard_per_tire !== undefined && rules.road_hazard) {
    patch.road_hazard_per_tire = road_hazard_per_tire === null || road_hazard_per_tire === "" ? null : Number(road_hazard_per_tire);
  }
  if (services !== undefined && rules.services) patch.services = services;
  // Contact fixes (a mistyped email or phone). Empty clears it.
  if (email !== undefined && rules.email) {
    const e = String(email || "").trim().toLowerCase();
    if (e && !EMAIL_RE.test(e)) return res.status(400).json({ error: "That email doesn't look right." });
    patch.email = e || null;
  }
  if (phone !== undefined && rules.phone) {
    let d = String(phone || "").replace(/\D/g, "");
    if (d.length === 11 && d[0] === "1") d = d.slice(1);
    if (d && d.length !== 10) return res.status(400).json({ error: "Phone needs 10 digits." });
    patch.phone = d || null;
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: "Nothing valid to update." });
  }

  // Old contact info, for the Front Desk log.
  let before = null;
  if ("email" in patch || "phone" in patch) {
    ({ data: before } = await supabaseAdmin.from(table).select("email, phone").eq("id", id).single());
  }

  const { error } = await supabaseAdmin.from(table).update(patch).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });

  if (before) {
    const by = auth.user.name || "Owner";
    for (const f of ["email", "phone"]) {
      if (f in patch && (before[f] || null) !== patch[f]) {
        await logEvent(id, "contact", `${by} changed ${f} from ${before[f] || "(none)"} to ${patch[f] || "(none)"}`);
      }
    }
  }

  // Any status change off "new" means someone handled it (stops Front Desk alerts).
  if (table === "leads" && status && status !== "new") {
    await supabaseAdmin.from("leads").update({ first_response_at: new Date().toISOString() }).eq("id", id).is("first_response_at", null);
  }

  // Marking a lead "Called" starts the funnel clock (-> Quoted -> Follow-up -> Cold),
  // but only if it hasn't already entered the funnel.
  if (table === "leads" && status === "called") {
    await supabaseAdmin.from("leads").update({ quoted_at: new Date().toISOString() }).eq("id", id).is("quoted_at", null);
  }

  return res.status(200).json({ success: true });
}
