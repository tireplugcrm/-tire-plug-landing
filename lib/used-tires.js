/**
 * Used tires (takeoffs), server-only. See lib/used-tires-schema.sql.
 * Staff upload each single, double or set at /takeoffs; the AI reads size, brand, model and DOT from
 * the photos. Tread depth is never estimated from a photo: a person measures it, or a gauge is
 * readable in the picture. Nothing is public until the owner prices it and marks it live.
 */
import { supabaseAdmin } from "./supabaseAdmin.js";
import { SITE, setting } from "./invoices.js";

export const USED_BUCKET = "used-tires";
export const USED_PAGE = "/used-tires-los-angeles";
const MODEL = process.env.INVOICE_MODEL || "claude-opus-5-5";
const MAX_READ_PHOTOS = 12;

export async function keyOk(k) {
  const key = await setting("takeoff_upload_key");
  return !!key && typeof k === "string" && k === key;
}
export async function uploadLink() {
  return `${SITE}/takeoffs?k=${await setting("takeoff_upload_key")}`;
}

const url = (path) => supabaseAdmin.storage.from(USED_BUCKET).getPublicUrl(path).data.publicUrl;
/** Row with photos as { full, thumb } web addresses. */
export function withUrls(row) {
  return { ...row, photos: (row.photos || []).map((x) => ({ full: url(x.p), thumb: url(x.t || x.p) })) };
}

/** What the website shows: live groups with tires left. Never notes or the AI's read. */
export async function liveUsedTires() {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin.from("used_tires")
    .select("id, tag, qty, size, brand, model, load_speed, dot_year, tread_32, price_each, photos")
    .eq("status", "live").gt("qty", 0).order("size");
  if (error) return [];
  return (data || []).map(withUrls).map((r) => ({ ...r, price_each: Number(r.price_each), tread_32: r.tread_32 == null ? null : Number(r.tread_32) }));
}

/** The oldest readable DOT, from [{ week, year }] with 2-digit or 4-digit years. */
export function oldestDot(dots, now = new Date()) {
  const thisYear = now.getFullYear();
  const ok = (dots || []).map((d) => {
    const y = Number(d?.year), w = Number(d?.week);
    return { week: w, year: y < 100 ? 2000 + y : y };
  }).filter((d) => d.year >= 2000 && d.year <= thisYear && d.week >= 1 && d.week <= 53);
  ok.sort((a, b) => a.year - b.year || a.week - b.week);
  return ok[0] || null;
}

const PROMPT = (qty) => `These photos show one group of ${qty} used tire${qty === 1 ? "" : "s"} at a tire shop: tread, DOT code, size and brand/model on the sidewall. Read them and return ONLY this JSON (no markdown):
{
  "is_tire": true,
  "size": "<as molded, e.g. 225/65R17 or LT265/70R17, or null>",
  "brand": "<brand or null>",
  "model": "<tire model or null>",
  "load_speed": "<e.g. 102H or null>",
  "dots": [{ "week": 23, "year": 22 }],
  "tread_32": null,
  "cover_index": 0,
  "mixed": false,
  "notes": "<anything a person should check: damage, plugs or patches, cracking, uneven wear, hard-to-read text>"
}
Rules: the DOT date is the LAST 4 digits of the DOT code, WWYY (2322 = week 23 of 2022); list one entry per different tire you can read. tread_32 is a number ONLY if a tread depth gauge is clearly readable in a photo; never estimate it by eye. cover_index is the 0-based photo that best shows the tire to a buyer. Set mixed to true if the photos show tires of different sizes, brands or models. Never guess text you can't read: use null and say so in notes. If these aren't tires, set is_tire to false.`;

/** Read a group's photos with the AI, fill in anything still blank, put the best photo first. */
export async function readTire(row) {
  const fail = async (msg) => {
    await supabaseAdmin.from("used_tires").update({ read_error: msg, read_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: false, error: msg };
  };
  if (!process.env.ANTHROPIC_API_KEY) return fail("ANTHROPIC_API_KEY is not set.");
  const list = (row.photos || []).slice(0, MAX_READ_PHOTOS);
  if (!list.length) return fail("No photos.");
  try {
    const images = await Promise.all(list.map(async (x) => {
      const { data: file, error } = await supabaseAdmin.storage.from(USED_BUCKET).download(x.p);
      if (error || !file) throw new Error(`Could not open a photo: ${error?.message || "missing"}`);
      return Buffer.from(await file.arrayBuffer()).toString("base64");
    }));
    const content = images.flatMap((data, i) => [
      { type: "text", text: `Photo ${i}:` },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data } },
    ]);
    content.push({ type: "text", text: PROMPT(row.qty_start) });
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, messages: [{ role: "user", content }] }),
    });
    const j = await res.json();
    if (!res.ok) return fail(j.error?.message || `AI read failed (${res.status})`);
    const out = (j.content || []).map((b) => (b.type === "text" ? b.text : "")).join("").replace(/```json|```/g, "").trim();
    const read = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));

    const dot = oldestDot(read.dots);
    const patch = { read, read_error: null, read_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (!row.size && read.size) patch.size = String(read.size).toUpperCase().replace(/\s+/g, "");
    if (!row.brand && read.brand) patch.brand = read.brand;
    if (!row.model && read.model) patch.model = read.model;
    if (!row.load_speed && read.load_speed) patch.load_speed = read.load_speed;
    if (row.dot_year == null && dot) { patch.dot_year = dot.year; patch.dot_week = dot.week; }
    if (row.tread_32 == null && Number(read.tread_32) > 0) patch.tread_32 = Number(read.tread_32);
    const c = Number(read.cover_index);
    if (Number.isInteger(c) && c > 0 && c < list.length) patch.photos = [row.photos[c], ...row.photos.filter((_, i) => i !== c)];
    const { error } = await supabaseAdmin.from("used_tires").update(patch).eq("id", row.id);
    if (error) return fail(error.message);
    return { ok: true, read, row: { ...row, ...patch } };
  } catch (e) {
    return fail(`AI read failed: ${e.message}`);
  }
}
