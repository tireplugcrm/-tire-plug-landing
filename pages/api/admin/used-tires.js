/**
 * Admin -> Used tires: the staff list and the owner's pricing step (lib/used-tires.js).
 *
 * POST { action: "list" }                 -> { tires, link }
 * POST { action: "update", id, fields }   -> { ok, tire }  (size, brand, model, load_speed, dot_week, dot_year, tread_32, cost_each, price_each, discount_each, notes)
 * POST { action: "status", id, status }   -> { ok, tire }  ("live" needs a size, a price and tires left)
 * POST { action: "sold", id, n }          -> { ok, tire }  (n = 1 takes one off, -1 puts one back)
 * POST { action: "cover", id, index }     -> { ok, tire }
 * POST { action: "reread", id }           -> { ok, tire, error }
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { USED_PAGE, readTire, uploadLink, withUrls } from "../../../lib/used-tires.js";

export const maxDuration = 120;

const text = (v, n) => { const s = String(v ?? "").trim().slice(0, n); return s || null; };
const num = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const CLEAN = {
  size: (v) => { const s = text(v, 24); return s && s.toUpperCase().replace(/\s+/g, ""); },
  brand: (v) => text(v, 60), model: (v) => text(v, 80), load_speed: (v) => text(v, 12), notes: (v) => text(v, 500),
  dot_week: num, dot_year: num, tread_32: num, cost_each: num, price_each: num, discount_each: num,
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Database not configured." });
  const { action, id } = req.body || {};
  const table = () => supabaseAdmin.from("used_tires");
  const refresh = async () => { try { await res.revalidate(USED_PAGE); } catch (e) {} };
  const save = async (patch) => {
    const { data, error } = await table().update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: error.message });
    await refresh();
    return res.json({ ok: true, tire: withUrls(data) });
  };

  if (action === "list") {
    const { data, error } = await table().select("*").order("created_at", { ascending: false }).limit(1000);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ tires: (data || []).map(withUrls), link: await uploadLink() });
  }

  const { data: row } = await table().select("*").eq("id", id).maybeSingle();
  if (!row) return res.status(404).json({ error: "Not found." });

  if (action === "update") {
    const patch = {};
    for (const [key, clean] of Object.entries(CLEAN)) if (key in (req.body.fields || {})) patch[key] = clean(req.body.fields[key]);
    const next = { ...row, ...patch };
    if (Number(next.discount_each) > 0 && !(Number(next.discount_each) < Number(next.price_each)))
      return res.status(400).json({ error: "The discounted price has to be lower than retail." });
    return save(patch);
  }
  if (action === "status") {
    const { status } = req.body;
    if (!["draft", "live", "hidden"].includes(status)) return res.status(400).json({ error: "Bad status." });
    if (status === "live" && (!row.size || !(Number(row.price_each) > 0) || !(row.qty > 0)))
      return res.status(400).json({ error: "Add the size, a price and how many are left first." });
    return save({ status });
  }
  if (action === "sold") {
    const qty = Math.max(0, Math.min(row.qty_start, row.qty - (Number(req.body.n) === -1 ? -1 : 1)));
    const status = qty === 0 ? "sold" : row.status === "sold" ? "live" : row.status;
    return save({ qty, status, sold_at: qty === 0 ? new Date().toISOString() : null });
  }
  if (action === "cover") {
    const i = Number(req.body.index);
    if (!Number.isInteger(i) || !row.photos[i]) return res.status(400).json({ error: "Bad photo." });
    return save({ photos: [row.photos[i], ...row.photos.filter((_, n) => n !== i)] });
  }
  if (action === "reread") {
    const r = await readTire({ ...row, size: null, brand: null, model: null, load_speed: null, dot_year: null, dot_week: null });
    const { data } = await table().select("*").eq("id", id).single();
    await refresh();
    return res.json({ ok: r.ok, error: r.error || null, tire: withUrls(data) });
  }
  return res.status(400).json({ error: "Unknown action" });
}
