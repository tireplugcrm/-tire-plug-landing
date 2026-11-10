/**
 * The owner's calendar (lib/alex-calendar.js). Admin login, or his 4-digit code (/alex).
 *
 * POST { action: "state", from, to }       -> { entries, people, feed }   (ISO instants; default: this week + 5 weeks)
 * POST { action: "addMeeting", title, starts_at, minutes, with_name, place, notes, text } -> state
 *      text: true texts the person from the shop line (the button press is the OK)
 * POST { action: "removeMeeting", id, from, to } -> state   (no text goes out)
 * POST { action: "people", people: [{name, phone}] } -> state
 */
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../lib/adminAuth.js";
import { checkStaffCode } from "../../lib/staff-code.js";
import { entries, people, savePeople, addMeeting, feedUrl } from "../../lib/alex-calendar.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Database not configured." });
  const b = req.body || {};
  let auth = (b.password || b.accessToken || req.headers.authorization) ? await requireAdmin(req) : { ok: false };
  if (!auth.ok) {
    const c = await checkStaffCode("alex", String(b.code || ""));
    if (!c.ok) return res.status(401).json({ error: c.error });
    auth = { ok: true, user: { name: "Alex" } };
  }

  const from = b.from && !Number.isNaN(Date.parse(b.from)) ? new Date(b.from) : new Date(Date.now() - 7 * 864e5);
  const to = b.to && !Number.isNaN(Date.parse(b.to)) ? new Date(b.to) : new Date(Date.now() + 35 * 864e5);
  const state = async (extra = {}) => res.json({ entries: await entries(from, to), people: await people(), feed: await feedUrl(), ...extra });

  try {
    if (b.action === "state") return await state();
    if (b.action === "addMeeting") {
      const row = await addMeeting(b, auth.user?.name);
      return await state({ added: { texted: !!row.texted_at, text_error: row.text_error || null } });
    }
    if (b.action === "removeMeeting") {
      const { error } = await supabaseAdmin.from("owner_events").delete().eq("id", b.id);
      if (error) throw new Error(error.message);
      return await state();
    }
    if (b.action === "people") { await savePeople(b.people); return await state(); }
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Failed" });
  }
}
