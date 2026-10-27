/**
 * Daily invoice check-in (server-only). See lib/invoices-schema.sql.
 * The shop gets a text at 10:00 AM and 4:30 PM with a link to /invoices?k=<key>; staff snap the
 * day's delivery invoices (or tap "No deliveries"). Files go to the private "invoices" bucket and
 * the AI reads each one (vendor, invoice #, tires, costs) so nothing has to be retyped or
 * passed through Drive. Entering the tires in Tekmetric is still a person (or Claude) step.
 */
import { supabaseAdmin } from "./supabaseAdmin.js";

export const INVOICE_BUCKET = "invoices";
export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://tireplugla.com").replace(/\/$/, "");
const MODEL = process.env.INVOICE_MODEL || "claude-opus-5-5";

/** Shop (LA) date as YYYY-MM-DD, `back` days ago. */
export function shopDay(back = 0, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(now.getTime() - back * 864e5));
}

/** Shop (LA) clock: { hour, minute, weekday (0 = Sunday) }. */
export function shopClock(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "numeric", weekday: "short", hourCycle: "h23" })
    .formatToParts(now).map((x) => [x.type, x.value]));
  return { hour: Number(p.hour), minute: Number(p.minute), weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}

export async function setting(key) {
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value || "";
}

/** The texted link's secret must match. */
export async function keyOk(k) {
  const key = await setting("invoice_upload_key");
  return !!key && typeof k === "string" && k === key;
}

export async function uploadLink() {
  return `${SITE}/invoices?k=${await setting("invoice_upload_key")}`;
}

const PROMPT = `This is a photo or PDF from a tire shop's delivery paperwork. Read it and return ONLY this JSON (no markdown):
{
  "is_invoice": true,
  "vendor": "<supplier name, e.g. Tire Network, Turbo Wholesale Tires, US AutoForce>",
  "invoice_no": "<invoice or order number>",
  "invoice_date": "<YYYY-MM-DD or null>",
  "page": "<e.g. 1 of 2, or null>",
  "items": [{ "qty": 4, "size": "<tire size as printed, e.g. 235/45R18 or 33X12.50R20>", "brand": "<brand>", "model": "<tire model>", "part_no": "<vendor part number or null>", "unit_cost": 0.00 }],
  "tire_count": 0,
  "total": 0.00,
  "notes": "<anything a person should check: returns, credits, back-orders, items that aren't tires, hard-to-read lines>"
}
Rules: one entry per invoice line. unit_cost is the price per tire before tax, null if it isn't shown. Leave out fees and non-tire lines from items but mention them in notes. tire_count is the sum of qty over items. If it isn't an invoice, packing slip or delivery receipt, set "is_invoice": false and explain in notes. Never guess numbers you can't read: use null and say so in notes.`;

// ---- Double-upload check --------------------------------------------------------------
// An invoice is a duplicate of an EARLIER upload when:
//   1) the invoice # matches (ignoring dashes, spaces, leading zeros) and the item #s + quantities
//      match, or both photos are the same page number (another page of one invoice is not a dup), or
//   2) no invoice # match, but the vendor, invoice date and every item # + quantity are identical.
const normNo = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^0+/, "");
const normVendor = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "").slice(0, 8);
export function itemSignature(read) {
  return (read?.items || [])
    .map((it) => `${normNo(it.part_no) || normNo(it.size)}x${Number(it.qty) || 0}`)
    .sort().join("|");
}

/** The earlier upload this one duplicates, as { of, reason }, or null. `others` = other upload rows with their reads. */
export function findDuplicate(row, others) {
  const r = row.read;
  if (!r || r.is_invoice === false) return null;
  const no = normNo(r.invoice_no), sig = itemSignature(r), page = normNo(r.page);
  const earlier = others
    .filter((o) => o.id !== row.id && o.read && o.read.is_invoice !== false && new Date(o.created_at) < new Date(row.created_at))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  for (const o of earlier) {
    const oNo = normNo(o.read.invoice_no), oSig = itemSignature(o.read), oPage = normNo(o.read.page);
    if (no && no === oNo && ((sig && sig === oSig) || (page && page === oPage)))
      return { of: o, reason: `Same invoice #${r.invoice_no}${sig === oSig ? ", same items and quantities" : `, same page ${r.page}`}` };
  }
  for (const o of earlier) {
    if (sig && sig === itemSignature(o.read) && r.invoice_date && r.invoice_date === o.read.invoice_date && normVendor(r.vendor) === normVendor(o.read.vendor) && normNo(o.read.invoice_no) !== no)
      return { of: o, reason: `Same vendor, date ${r.invoice_date}, items and quantities (invoice # read as ${o.read.invoice_no || "blank"} vs ${r.invoice_no || "blank"})` };
  }
  return null;
}

/** Uploads from the last 4 months, for duplicate checks. */
export async function recentUploads() {
  const { data } = await supabaseAdmin.from("invoice_uploads").select("id, day, created_at, uploaded_by, read, entered_at")
    .gte("created_at", new Date(Date.now() - 120 * 864e5).toISOString()).not("read", "is", null).limit(2000);
  return data || [];
}

/** Read one uploaded invoice with the AI and store the result on the row. */
export async function readUpload(row) {
  const fail = async (msg) => {
    await supabaseAdmin.from("invoice_uploads").update({ read_error: msg, read_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: false, error: msg };
  };
  if (!process.env.ANTHROPIC_API_KEY) return fail("ANTHROPIC_API_KEY is not set.");
  const { data: file, error } = await supabaseAdmin.storage.from(INVOICE_BUCKET).download(row.path);
  if (error || !file) return fail(`Could not open the file: ${error?.message || "missing"}`);
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mime = row.mime || file.type || "";
  const source = mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : /^image\/(jpeg|png|gif|webp)$/.test(mime)
      ? { type: "image", source: { type: "base64", media_type: mime, data } }
      : null;
  if (!source) return fail(`Can't read ${mime || "this file type"}; upload a photo or PDF.`);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: "user", content: [source, { type: "text", text: PROMPT }] }] }),
    });
    const j = await res.json();
    if (!res.ok) return fail(j.error?.message || `AI read failed (${res.status})`);
    const out = (j.content || []).map((b) => (b.type === "text" ? b.text : "")).join("").replace(/```json|```/g, "").trim();
    const read = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
    await supabaseAdmin.from("invoice_uploads").update({ read, read_error: null, read_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: true, read };
  } catch (e) {
    return fail(`AI read failed: ${e.message}`);
  }
}
