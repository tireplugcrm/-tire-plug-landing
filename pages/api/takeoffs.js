/**
 * Upload side of the used tires (/takeoffs?k=<key>). Gated by the key in the link, so staff can use
 * it from any phone without a login.
 *
 * POST { k, action: "state" }                      -> { total, drafts }
 * POST { k, action: "sign", batch, n }             -> { full: { path, token }, thumb: { path, token } }
 * POST { k, action: "save", batch, qty, tread, photos: [{ p, t }], by } -> { ok, tag, size, brand, model, dot_year, error }
 *   Saves the group as a draft, then has the AI read it (can take ~30 s).
 */
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { shopDay } from "../../lib/invoices.js";
import { USED_BUCKET, keyOk, readTire } from "../../lib/used-tires.js";

export const maxDuration = 120;

const okBatch = (b) => typeof b === "string" && /^[a-z0-9]{8,32}$/.test(b);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Database not configured." });
  const { k, action, batch } = req.body || {};
  if (!(await keyOk(k))) return res.status(401).json({ error: "This link isn't valid anymore. Ask for a new one." });

  if (action === "state") {
    const [{ count: total }, { count: drafts }] = await Promise.all([
      supabaseAdmin.from("used_tires").select("id", { count: "exact", head: true }).neq("status", "hidden"),
      supabaseAdmin.from("used_tires").select("id", { count: "exact", head: true }).eq("status", "draft"),
    ]);
    return res.json({ total: total || 0, drafts: drafts || 0 });
  }

  if (!okBatch(batch)) return res.status(400).json({ error: "Bad upload group." });

  if (action === "sign") {
    const n = Math.max(0, Math.min(99, Number(req.body.n) || 0));
    const base = `${shopDay(0)}/${batch}/${n}-${Math.random().toString(36).slice(2, 8)}`;
    const store = supabaseAdmin.storage.from(USED_BUCKET);
    const [a, b] = await Promise.all([store.createSignedUploadUrl(`${base}.jpg`), store.createSignedUploadUrl(`${base}-t.jpg`)]);
    if (a.error || b.error) return res.status(500).json({ error: (a.error || b.error).message });
    return res.json({ full: { path: a.data.path, token: a.data.token }, thumb: { path: b.data.path, token: b.data.token } });
  }

  if (action === "save") {
    const qty = Number(req.body.qty);
    if (![1, 2, 3, 4].includes(qty)) return res.status(400).json({ error: "Pick how many tires." });
    const inBatch = (p) => typeof p === "string" && new RegExp(`^\\d{4}-\\d{2}-\\d{2}/${batch}/[\\w-]+\\.jpg$`).test(p);
    const photos = (Array.isArray(req.body.photos) ? req.body.photos : []).filter((x) => inBatch(x?.p) && inBatch(x?.t)).map((x) => ({ p: x.p, t: x.t }));
    if (!photos.length) return res.status(400).json({ error: "Add the photos first." });
    const tread = Number(req.body.tread);

    const { data: same } = await supabaseAdmin.from("used_tires").select("*").eq("batch", batch).maybeSingle();
    if (same) return res.json({ ok: true, tag: same.tag, size: same.size, brand: same.brand, model: same.model, dot_year: same.dot_year });
    const { data: row, error } = await supabaseAdmin.from("used_tires").insert({
      batch, qty, qty_start: qty, photos, tread_32: tread > 0 && tread <= 32 ? tread : null,
      uploaded_by: String(req.body.by || "").trim().slice(0, 60) || null,
    }).select("*").single();
    if (error) return res.status(500).json({ error: error.message });

    const r = await readTire(row);
    const out = r.row || row;
    return res.json({
      ok: true, tag: row.tag, size: out.size || null, brand: out.brand || null, model: out.model || null, dot_year: out.dot_year ?? null,
      is_tire: r.read?.is_tire !== false, mixed: !!r.read?.mixed, error: r.ok ? null : r.error,
    });
  }

  return res.status(400).json({ error: "Unknown action" });
}
