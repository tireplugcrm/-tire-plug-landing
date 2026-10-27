/**
 * Public side of the daily invoice check-in (/invoices?k=<key>, the link in the 10 AM / 4:30 PM text).
 * Gated by the key in the link (app_settings.invoice_upload_key), not a login, so staff can use it
 * from any phone. Never returns costs.
 *
 * POST { k, action: "state" }                                  -> { today, days: [{ day, status, uploads }] }  (last 7 days)
 * POST { k, action: "sign", day, name, mime }                  -> { path, token }  (signed upload, straight to storage)
 * POST { k, action: "uploaded", day, path, name, mime, size, by } -> { ok, vendor, invoice_no, tire_count, is_invoice, error, duplicate }
 *   Saves the row, marks the day answered, then has the AI read it (so it can take ~20 s).
 *   duplicate: { reason, day, by } when the same invoice was uploaded before (lib/invoices.js findDuplicate).
 * POST { k, action: "none", day, by }                          -> { ok }  ("No deliveries", only if nothing was uploaded)
 */
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { INVOICE_BUCKET, findDuplicate, keyOk, readUpload, recentUploads, shopDay } from "../../lib/invoices.js";

export const maxDuration = 60;

const okDay = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= shopDay(0) && d >= shopDay(14);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Database not configured." });
  const { k, action, day } = req.body || {};
  if (!(await keyOk(k))) return res.status(401).json({ error: "This link isn't valid anymore. Ask for the newest text." });
  const by = String(req.body.by || "").trim().slice(0, 60) || null;

  if (action === "state") {
    const days = Array.from({ length: 7 }, (_, i) => shopDay(i));
    const [{ data: rows }, { data: ups }] = await Promise.all([
      supabaseAdmin.from("invoice_days").select("day, status").in("day", days),
      supabaseAdmin.from("invoice_uploads").select("day").in("day", days),
    ]);
    const st = new Map((rows || []).map((r) => [r.day, r.status]));
    const count = {};
    for (const u of ups || []) count[u.day] = (count[u.day] || 0) + 1;
    return res.json({ today: days[0], days: days.map((d) => ({ day: d, status: st.get(d) || null, uploads: count[d] || 0 })) });
  }

  if (!okDay(day)) return res.status(400).json({ error: "Pick a day from the last two weeks." });

  if (action === "sign") {
    const mime = String(req.body.mime || "");
    if (!/^image\//.test(mime) && mime !== "application/pdf") return res.status(400).json({ error: "Upload a photo or a PDF." });
    const ext = mime === "application/pdf" ? "pdf" : (mime.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = `${day}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data, error } = await supabaseAdmin.storage.from(INVOICE_BUCKET).createSignedUploadUrl(path);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ path: data.path, token: data.token });
  }

  if (action === "uploaded") {
    const path = String(req.body.path || "");
    if (!path.startsWith(`${day}/`)) return res.status(400).json({ error: "Bad file path." });
    const { data: row, error } = await supabaseAdmin.from("invoice_uploads").insert({
      day, path, file_name: String(req.body.name || "").slice(0, 200) || null, mime: req.body.mime || null,
      size: Number(req.body.size) || null, uploaded_by: by,
    }).select("*").single();
    if (error) return res.status(500).json({ error: error.message });
    await supabaseAdmin.from("invoice_days").upsert({ day, status: "uploaded", answered_by: by, answered_at: new Date().toISOString() });
    const r = await readUpload(row);
    const read = r.read || {};
    const dup = r.ok ? findDuplicate({ ...row, read }, await recentUploads()) : null;
    return res.json({
      ok: true, is_invoice: read.is_invoice !== false, vendor: read.vendor || null, invoice_no: read.invoice_no || null, tire_count: read.tire_count ?? null, error: r.ok ? null : r.error,
      duplicate: dup ? { reason: dup.reason, day: dup.of.day, by: dup.of.uploaded_by || null } : null,
    });
  }

  if (action === "none") {
    const { count } = await supabaseAdmin.from("invoice_uploads").select("id", { count: "exact", head: true }).eq("day", day);
    if (count) return res.status(400).json({ error: "Invoices were already uploaded for this day." });
    await supabaseAdmin.from("invoice_days").upsert({ day, status: "none", answered_by: by, answered_at: new Date().toISOString() });
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: "Unknown action" });
}
