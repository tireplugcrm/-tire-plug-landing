/**
 * Staff to-do lists: the admin "Belen's to-do" tab (admin login: read, tick, edit) and the
 * phone page /belen (her 4-digit code, lib/staff-code.js: read and tick only).
 *
 * The list's words live in Supabase (app_settings key `todo_<who>` / `know_<who>`, body `list`), not in this public repo,
 * so vendor names and shop notes stay private. Ticks are shared: everyone signed in to the
 * admin sees the same boxes checked.
 *
 * POST actions:
 *   { action: "get",  who }                 -> { text, done, skipped, added, updated_at, updated_by }
 *   { action: "skip", who, item, skipped }  -> the same, after scratching / unscratching one item (won't happen today)
 *                                              (added: { line words: "YYYY-MM-DD" first seen })
 *   { action: "save", who, text }           -> the same, after replacing the words
 *   { action: "tick", who, item, checked }  -> the same, after ticking / unticking one item
 *   { action: "reset", who }                -> the same, with every box unticked (start a new day)
 *   body `list`: "todo" (default) | "know" | "daily" | "weekly" | "monthly" (the last three reset by themselves)
 *
 * Ticks are keyed by the item's words, so editing the list keeps the ticks on unchanged items.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { checkStaffCode } from "../../../lib/staff-code.js";
import { shopDay } from "../../../lib/invoices.js";
import { logActivity } from "../../../lib/staff-activity.js";
import { ticksForDay } from "../../../lib/todo-days.js";

const WHO = /^[a-z]{2,20}$/;

// Lists per person: "todo" (today's checklist), "know" (important things to know, no boxes), and
// "daily" / "weekly" / "monthly" duty checklists whose ticks clear on their own when the period turns over
// (shop time: a new day, a new Mon-Sun week, a new month).
const LISTS = ["todo", "know", "daily", "weekly", "monthly", "plan"]; // plan = "How your bonus works" (field reps)
const DAILY_TODO = new Set(["belen"]); // whose "todo" checks clear every morning (see lib/todo-days.js)
function periodOf(list, who) {
  const day = shopDay(0);
  if (list === "todo" && DAILY_TODO.has(who)) return day;
  if (list === "daily") return day;
  if (list === "monthly") return day.slice(0, 7);
  if (list === "weekly") {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // back to Monday
    return `w${d.toISOString().slice(0, 10)}`;
  }
  return null;
}

// Each line's words (no "- " / "1." marker), the same key TodoTab uses. Headings have none.
const lineKey = (l) => l.trim().replace(/^[-*]\s+(\[[ xX]\]\s+)?/, "").replace(/^\d+[.)]\s+/, "").trim();
const lineKeys = (text) => String(text || "").split(/\r?\n/).filter((l) => l.trim() && !/^\s*#/.test(l)).map(lineKey).filter(Boolean);

// The day (LA) each line first appeared with these exact words; lines from before dates were
// tracked get the day the list was last saved. A reworded line counts as new that day.
function datesFor(text, prev, fallback) {
  const out = {};
  for (const k of lineKeys(text)) out[k] = prev[k] || fallback;
  return out;
}

async function load(who, list) {
  const { data } = await supabaseAdmin.from("app_settings").select("value, updated_at").eq("key", `${list}_${who}`).maybeSingle();
  let v = {};
  try { v = data?.value ? JSON.parse(data.value) : {}; } catch { v = { text: String(data.value || "") }; }
  const updated_at = data?.updated_at || null;
  const fallback = updated_at ? shopDay(0, new Date(updated_at)) : shopDay(0);
  const added = datesFor(v.text, v.added && typeof v.added === "object" ? v.added : {}, fallback);
  const period = periodOf(list, who);
  const daily = list === "todo" && DAILY_TODO.has(who);
  const ticks = daily ? ticksForDay({ text: v.text, done: v.done, skipped: v.skipped, lastDay: v.period || fallback, today: period }) : null;
  const done = daily ? ticks.done : Array.isArray(v.done) && (!period || v.period === period) ? v.done : []; // new period: boxes start empty
  const skipped = daily ? ticks.skipped : Array.isArray(v.skipped) && (!period || v.period === period) ? v.skipped : [];
  return { text: v.text || "", done, skipped, period, added, updated_at, updated_by: v.updated_by || null };
}

async function store(who, list, v, user) {
  const added = datesFor(v.text, v.added || {}, shopDay(0));
  v = { ...v, added };
  const value = JSON.stringify({ text: v.text, done: v.done, skipped: v.skipped || [], added, period: periodOf(list, who), updated_by: user?.name || user?.email || null });
  const updated_at = new Date().toISOString();
  const { error } = await supabaseAdmin.from("app_settings").upsert({ key: `${list}_${who}`, value, updated_at }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return { ...v, updated_at, updated_by: user?.name || user?.email || null };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });
  const { action, who = "belen", list = "todo" } = req.body || {};
  if (!WHO.test(who) || !LISTS.includes(list)) return res.status(400).json({ error: "Bad list name." });

  // Admin login, or the person's own 4-digit code (that one can only read and tick).
  let auth = (req.body?.password || req.body?.accessToken || req.headers.authorization) ? await requireAdmin(req) : { ok: false };
  if (!auth.ok) {
    if (req.body?.code == null) return res.status(401).json({ error: "Unauthorized" });
    const c = await checkStaffCode(who, String(req.body.code));
    if (!c.ok) return res.status(401).json({ error: c.error });
    // Staff codes read and tick; the owner's own page (/alex, who = "alex") can also edit.
    if (who !== "alex" && !["get", "tick", "skip"].includes(action)) return res.status(403).json({ error: "Only the owner can change the list." });
    auth = { ok: true, viaCode: true, user: { name: who.charAt(0).toUpperCase() + who.slice(1) } };
  }

  try {
    const cur = await load(who, list);
    if (action === "get") return res.status(200).json(cur);
    if (action === "save") {
      const text = String(req.body.text || "").slice(0, 20000);
      return res.status(200).json(await store(who, list, { text, done: cur.done, skipped: cur.skipped, added: cur.added }, auth.user));
    }
    if (action === "tick") {
      const item = String(req.body.item || "").slice(0, 500);
      if (!item) return res.status(400).json({ error: "Missing item." });
      const done = new Set(cur.done);
      if (req.body.checked) done.add(item); else done.delete(item);
      const skipped = cur.skipped.filter((x) => !(req.body.checked && x === item)); // checking it un-scratches it
      if (auth.viaCode) await logActivity(who, req.body.checked ? "tick" : "untick", item);
      return res.status(200).json(await store(who, list, { text: cur.text, done: [...done], skipped, added: cur.added }, auth.user));
    }
    if (action === "skip") {
      const item = String(req.body.item || "").slice(0, 500);
      if (!item) return res.status(400).json({ error: "Missing item." });
      const skipped = new Set(cur.skipped);
      if (req.body.skipped) skipped.add(item); else skipped.delete(item);
      const done = cur.done.filter((x) => !(req.body.skipped && x === item)); // scratching it un-checks it
      if (auth.viaCode) await logActivity(who, req.body.skipped ? "skip" : "unskip", item);
      return res.status(200).json(await store(who, list, { text: cur.text, done, skipped: [...skipped], added: cur.added }, auth.user));
    }
    if (action === "reset") return res.status(200).json(await store(who, list, { text: cur.text, done: [], skipped: [], added: cur.added }, auth.user));
    return res.status(400).json({ error: "Unknown action." });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Failed" });
  }
}
