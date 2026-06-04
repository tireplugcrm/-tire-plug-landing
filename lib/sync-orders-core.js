/**
 * Scan recent finalized TireBase orders, match them to active CRM leads by phone,
 * and mark those leads won (booked + revenue). Used by the manual button and the
 * daily cron — so even a lead that went cold flips to Won when its order finalizes.
 */
import { supabaseAdmin } from "./supabaseAdmin.js";
import { fetchOrderLines } from "./tirebase.js";
import { digits10 } from "./phone.js";

function money(v) { const n = Number(String(v == null ? 0 : v).replace(/[^0-9.-]/g, "")); return isNaN(n) ? 0 : n; }
function safeIso(d) { if (!d) return null; const x = new Date(d); return isNaN(x.getTime()) ? null : x.toISOString(); }

export async function convertFinalizedOrders({ store_id = 1, days = 30 } = {}) {
  const end = new Date();
  const start = new Date(Date.now() - days * 86400000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const rows = await fetchOrderLines({ from: fmt(start), to: fmt(end), store_id });

  // Dedupe to invoices, then total spend per phone.
  const invoices = {};
  for (const row of rows) {
    const num = row.invoice_number;
    if (!num || invoices[num]) continue;
    invoices[num] = { phone: digits10(row.phone_number), total: money(row.total_invoice), date: safeIso(row.closing_date) || safeIso(row.date_of_admission) };
  }
  const byPhone = {};
  for (const num of Object.keys(invoices)) {
    const e = invoices[num];
    if (!e.phone) continue;
    const p = byPhone[e.phone] || (byPhone[e.phone] = { total: 0, count: 0, latest: null });
    p.total += e.total; p.count += 1;
    if (e.date && (!p.latest || e.date > p.latest)) p.latest = e.date;
  }

  // Match active leads (not yet booked/dead) by phone → mark won.
  const { data: leads } = await supabaseAdmin.from("leads").select("id, name, phone, status").in("status", ["new", "called"]);
  let closed = 0; const names = [];
  for (const lead of leads || []) {
    const p = digits10(lead.phone);
    if (!p || !byPhone[p]) continue;
    const m = byPhone[p];
    await supabaseAdmin.from("leads").update({
      status: "booked", booked_at: m.latest || new Date().toISOString(), revenue_amount: Math.round(m.total * 100) / 100,
    }).eq("id", lead.id);
    closed += 1; names.push(lead.name || "(lead)");
  }
  return { closed, scanned: (leads || []).length, names };
}
