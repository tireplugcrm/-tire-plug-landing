/**
 * Admin → Invoices: the daily invoice check-in (lib/invoices.js), password / Google gated.
 *
 * POST { action: "list" }                    -> { days: [{ day, status, answered_by, am_texted_at, pm_texted_at, uploads: [...] }], link, textTo }
 *   Last 30 shop days; each upload has a 1-hour view URL, the AI's read, and duplicate: { reason, id, day, by }
 *   when it repeats an earlier upload (re-scanned on every load).
 * POST { action: "entered", id, undo }       -> { ok }  (tires are in Tekmetric)
 * POST { action: "reread", id }              -> { ok, read, error }
 * POST { action: "settings", textTo }        -> { ok }  (owner only; phones that get the texts)
 * POST { action: "text-now", slot }          -> { sent, failed, body }  (sends the "am" or "pm" text right away)
 * POST { action: "tekmetric-files", file }   -> { lines, counts, uploadIds, updateFile, newFile }  (lib/tekmetric-bulk.js)
 *   file: base64 of Tekmetric's Bulk Editor export. Uses every upload not marked entered (last 60 days),
 *   skipping double uploads. The two files come back base64 (null when empty).
 * POST { action: "mark-entered", ids }       -> { ok, count }  (after both files are uploaded in Tekmetric)
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { INVOICE_BUCKET, findDuplicate, readUpload, recentUploads, setting, shopDay, uploadLink } from "../../../lib/invoices.js";
import { buildTekmetricFiles } from "../../../lib/tekmetric-bulk.js";
import { sendInvoiceText } from "../cron/invoice-texts.js";
import { digits10 } from "../../../lib/phone.js";

export const maxDuration = 60;
// The Bulk Editor export is ~120 KB for 630 parts; leave room as the inventory grows.
export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Database not configured." });
  const { action, id } = req.body || {};

  if (action === "list") {
    const days = Array.from({ length: 30 }, (_, i) => shopDay(i));
    const [{ data: rows }, { data: ups }] = await Promise.all([
      supabaseAdmin.from("invoice_days").select("*").gte("day", days[29]),
      supabaseAdmin.from("invoice_uploads").select("*").gte("day", days[29]).order("created_at"),
    ]);
    const urls = new Map();
    if (ups?.length) {
      const { data: signed } = await supabaseAdmin.storage.from(INVOICE_BUCKET).createSignedUrls(ups.map((u) => u.path), 3600);
      for (const s of signed || []) if (s.signedUrl) urls.set(s.path, s.signedUrl);
    }
    const byDay = new Map((rows || []).map((r) => [r.day, r]));
    // Re-scan every upload for doubles each time, against the last 4 months.
    const pool = await recentUploads();
    const dupOf = (u) => { const x = findDuplicate(u, pool); return x ? { reason: x.reason, id: x.of.id, day: x.of.day, by: x.of.uploaded_by || null } : null; };
    return res.json({
      link: await uploadLink(),
      textTo: await setting("invoice_text_to"),
      ownerPhoneFallback: !!process.env.ADMIN_ALERT_PHONE,
      isOwner: auth.user.isOwner,
      days: days.map((day) => ({
        day, ...(byDay.get(day) || {}),
        uploads: (ups || []).filter((u) => u.day === day).map((u) => ({ ...u, url: urls.get(u.path) || null, duplicate: dupOf(u) })),
      })),
    });
  }

  if (action === "entered") {
    const patch = req.body.undo ? { entered_at: null, entered_by: null } : { entered_at: new Date().toISOString(), entered_by: auth.user.name };
    const { error } = await supabaseAdmin.from("invoice_uploads").update(patch).eq("id", id);
    return error ? res.status(500).json({ error: error.message }) : res.json({ ok: true });
  }

  if (action === "reread") {
    const { data: row } = await supabaseAdmin.from("invoice_uploads").select("*").eq("id", id).maybeSingle();
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(await readUpload(row));
  }

  if (action === "settings") {
    if (!auth.user.isOwner) return res.status(403).json({ error: "Only the owner can change who gets the texts." });
    const phones = String(req.body.textTo || "").split(/[,\n]/).map((p) => digits10(p)).filter((p) => p.length === 10);
    const { error } = await supabaseAdmin.from("app_settings").upsert({ key: "invoice_text_to", value: [...new Set(phones)].join(","), updated_at: new Date().toISOString() });
    return error ? res.status(500).json({ error: error.message }) : res.json({ ok: true });
  }

  if (action === "text-now") {
    return res.json(await sendInvoiceText(req.body.slot === "pm" ? "pm" : "am", { force: true }));
  }

  if (action === "tekmetric-files") {
    if (!req.body.file) return res.status(400).json({ error: "Drop in the file from Tekmetric's Bulk Editor > Download." });
    const { data: open } = await supabaseAdmin.from("invoice_uploads").select("*").is("entered_at", null).not("read", "is", null)
      .gte("day", shopDay(60)).order("created_at");
    const pool = await recentUploads();
    const uploads = (open || []).filter((u) => !findDuplicate(u, pool));
    if (!uploads.length) return res.status(400).json({ error: "Every invoice is already marked entered. Nothing to add." });
    try {
      const r = await buildTekmetricFiles({ bulkEdit: Buffer.from(req.body.file, "base64"), uploads });
      return res.json({
        lines: r.lines, counts: r.counts, uploadIds: uploads.map((u) => u.id),
        updateFile: r.updateFile ? r.updateFile.toString("base64") : null,
        newFile: r.newFile ? r.newFile.toString("base64") : null,
      });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }

  if (action === "mark-entered") {
    const ids = (req.body.ids || []).filter((x) => typeof x === "string").slice(0, 500);
    if (!ids.length) return res.status(400).json({ error: "No invoices given." });
    const { data, error } = await supabaseAdmin.from("invoice_uploads").update({ entered_at: new Date().toISOString(), entered_by: auth.user.name })
      .in("id", ids).is("entered_at", null).select("id");
    return error ? res.status(500).json({ error: error.message }) : res.json({ ok: true, count: data?.length || 0 });
  }

  return res.status(400).json({ error: "Unknown action" });
}
