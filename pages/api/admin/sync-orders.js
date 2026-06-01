/**
 * Order → Lead loop. Pulls recent TireBase orders, matches them to active CRM
 * leads by phone number, and auto-closes those leads as Booked/Won with the
 * real revenue. Run on demand (button) — TireBase has no webhooks.
 *
 * Env: TIREBASE_API_KEY, TIREBASE_BASE_URL
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { digits10 } from "../../../lib/phone.js";

function money(v) {
  const n = Number(String(v == null ? 0 : v).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}
function safeIso(d) {
  if (!d) return null;
  const x = new Date(d);
  return isNaN(x.getTime()) ? null : x.toISOString();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });

  const key = process.env.TIREBASE_API_KEY;
  const base = process.env.TIREBASE_BASE_URL || "https://api.tirebase.io/v1/external";
  if (!key) return res.status(500).json({ error: "TireBase isn't connected (missing key)." });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const store_id = (req.body && req.body.store_id) || 1;
  const end = new Date();
  const start = new Date(Date.now() - 30 * 86400000); // last 30 days
  const fmt = (d) => d.toISOString().slice(0, 10);

  // 1) Pull recent orders
  let rows;
  try {
    const url = `${base}/order/getAllOrderDetailsByInvoiceDate?date_1=${fmt(start)}&date_2=${fmt(end)}&store_id=${store_id}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    const d = await r.json();
    if (!r.ok) return res.status(502).json({ error: d.message || "TireBase request failed." });
    rows = d.data || [];
  } catch (e) {
    return res.status(502).json({ error: "Could not reach TireBase." });
  }

  // 2) Dedupe to invoices, then group total spend per phone number
  const invoices = {}; // invoice_number -> { phone, total, date }
  for (const row of rows) {
    const num = row.invoice_number;
    if (!num || invoices[num]) continue;
    invoices[num] = {
      phone: digits10(row.phone_number),
      total: money(row.total_invoice),
      date: safeIso(row.closing_date) || safeIso(row.date_of_admission),
    };
  }
  const byPhone = {};
  for (const num of Object.keys(invoices)) {
    const e = invoices[num];
    if (!e.phone) continue;
    const p = byPhone[e.phone] || (byPhone[e.phone] = { total: 0, count: 0, latest: null });
    p.total += e.total;
    p.count += 1;
    if (e.date && (!p.latest || e.date > p.latest)) p.latest = e.date;
  }

  // 3) Match active leads (not yet booked/dead) by phone, auto-close them
  const { data: leads } = await supabaseAdmin
    .from("leads").select("id, name, phone, status").in("status", ["new", "called"]);

  let closed = 0;
  const names = [];
  for (const lead of leads || []) {
    const p = digits10(lead.phone);
    if (!p || !byPhone[p]) continue;
    const m = byPhone[p];
    await supabaseAdmin.from("leads").update({
      status: "booked",
      booked_at: m.latest || new Date().toISOString(),
      revenue_amount: Math.round(m.total * 100) / 100,
    }).eq("id", lead.id);
    closed += 1;
    names.push(lead.name || "(lead)");
  }

  return res.status(200).json({ closed, scanned: (leads || []).length, names });
}
