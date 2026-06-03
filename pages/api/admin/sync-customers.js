/**
 * Build/refresh customer profiles from TireBase order history. Owner/Google gated.
 * POST { months } -> { customers, synced }   (default 24 months lookback)
 *
 * Pulls orders month-by-month (parallel batches), aggregates per customer
 * (last visit, spend, orders, last tire purchase), flags likely commercial
 * accounts, and upserts — preserving manual fields (email, is_commercial,
 * sms_opt_in, notes). TireBase has no emails, so profiles carry phones only.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { fetchOrderLines } from "../../../lib/tirebase.js";
import { digits10 } from "../../../lib/phone.js";

export const maxDuration = 60;

function money(v) { const n = Number(String(v == null ? 0 : v).replace(/[^0-9.-]/g, "")); return isNaN(n) ? 0 : n; }
function qtyNum(v) { const n = Number(String(v == null ? 0 : v).replace(/[^0-9.-]/g, "")); return isNaN(n) ? 0 : n; }
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function toYmd(s) { const m = String(s || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null; }
function isTire(desc) {
  const d = (desc || "").toLowerCase();
  if (d.includes("tpms") || d.includes("alignment") || d.includes("oil") || d.includes("brake") || d.includes("labor")) return false;
  return /\d{3}\s*\/\s*\d{2}/.test(d) || /\b\d{7}\b/.test(d) || d.includes("tire");
}
const COMMERCIAL_RE = /\b(llc|inc|incorporated|corp|auto|autos|automotive|fleet|trucking|truck|towing|tow|motors|services|service|rental|rentals|transport|logistics|garage|dealer|wholesale|enterprise|company)\b/i;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });
  if (!process.env.TIREBASE_API_KEY) return res.status(500).json({ error: "TireBase isn't connected." });

  const months = Math.min(60, Math.max(1, Number(req.body.months) || 24));
  const store_id = req.body.store_id || 1;

  // Monthly windows, newest first.
  const now = new Date();
  const windows = [];
  for (let i = 0; i < months; i++) {
    const first = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const last = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    windows.push({ from: ymd(first), to: ymd(last) });
  }

  // Fetch in parallel batches of 6.
  const rows = [];
  try {
    for (let i = 0; i < windows.length; i += 6) {
      const batch = windows.slice(i, i + 6);
      const results = await Promise.all(batch.map((w) => fetchOrderLines({ from: w.from, to: w.to, store_id }).catch(() => [])));
      results.forEach((r) => rows.push(...r));
    }
  } catch (e) {
    return res.status(502).json({ error: "Could not reach TireBase." });
  }

  // Aggregate per customer.
  const cust = {};
  for (const row of rows) {
    const cid = row.customer_id ? String(row.customer_id) : null;
    const phone = digits10(row.phone_number);
    const key = cid || (phone ? `p:${phone}` : null);
    if (!key) continue;
    const date = toYmd(row.closing_date) || toYmd(row.date_of_admission);
    const c = cust[key] || (cust[key] = { name: null, nameDate: "", phone: row.phone_number || null, invoices: {}, total: 0, first: null, last: null, lastTire: null, tireQty: 0 });
    if (date && date >= c.nameDate && row.customer_vendor_name) { c.name = row.customer_vendor_name; c.nameDate = date; }
    if (row.phone_number) c.phone = row.phone_number;
    const inv = row.invoice_number;
    if (inv && !(inv in c.invoices)) { c.invoices[inv] = true; c.total += money(row.total_invoice); }
    if (date) { if (!c.first || date < c.first) c.first = date; if (!c.last || date > c.last) c.last = date; }
    if (isTire(row.description)) { c.tireQty += qtyNum(row.quantity); if (date && (!c.lastTire || date > c.lastTire)) c.lastTire = date; }
  }

  const upserts = Object.entries(cust).map(([key, c]) => {
    const orderCount = Object.keys(c.invoices).length;
    const suggested = (c.name && COMMERCIAL_RE.test(c.name)) || orderCount >= 5;
    return {
      tb_customer_id: key, name: c.name || "(no name)", phone: c.phone || null,
      first_visit: c.first, last_visit: c.last, order_count: orderCount,
      total_spent: Math.round(c.total * 100) / 100, last_tire_date: c.lastTire, tire_count: c.tireQty,
      commercial_suggested: !!suggested, synced_at: new Date().toISOString(),
    };
  });

  // Upsert in chunks (preserves manual columns we don't include).
  let synced = 0;
  for (let i = 0; i < upserts.length; i += 500) {
    const chunk = upserts.slice(i, i + 500);
    const { error } = await supabaseAdmin.from("customers").upsert(chunk, { onConflict: "tb_customer_id" });
    if (error) return res.status(500).json({ error: error.message });
    synced += chunk.length;
  }

  return res.status(200).json({ customers: upserts.length, synced, months });
}
