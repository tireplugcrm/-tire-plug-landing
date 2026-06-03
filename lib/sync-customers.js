/**
 * Core customer-sync logic: build/refresh customer profiles from TireBase order
 * history. Used by both the manual admin endpoint and the weekly cron.
 * Upserts by tb_customer_id, preserving manual fields (email, is_commercial,
 * sms_opt_in, notes) — only computed columns are written.
 */
import { supabaseAdmin } from "./supabaseAdmin.js";
import { fetchOrderLines } from "./tirebase.js";
import { digits10 } from "./phone.js";

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

export async function syncCustomers({ months = 24, store_id = 1 } = {}) {
  months = Math.min(60, Math.max(1, Number(months) || 24));
  const now = new Date();
  const windows = [];
  for (let i = 0; i < months; i++) {
    const first = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const last = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    windows.push({ from: ymd(first), to: ymd(last) });
  }

  const rows = [];
  for (let i = 0; i < windows.length; i += 6) {
    const batch = windows.slice(i, i + 6);
    const results = await Promise.all(batch.map((w) => fetchOrderLines({ from: w.from, to: w.to, store_id }).catch(() => [])));
    results.forEach((r) => rows.push(...r));
  }

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

  let synced = 0;
  for (let i = 0; i < upserts.length; i += 500) {
    const chunk = upserts.slice(i, i + 500);
    const { error } = await supabaseAdmin.from("customers").upsert(chunk, { onConflict: "tb_customer_id" });
    if (error) throw new Error(error.message);
    synced += chunk.length;
  }

  return { customers: upserts.length, synced, months };
}
