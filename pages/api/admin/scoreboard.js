/**
 * Live company scoreboard — pulls real TireBase order data for a day and
 * aggregates revenue, payments, service counts, staff, invoices.
 * Powers the Daily-Goals dashboard. Password/Google gated.
 *
 * Env: TIREBASE_API_KEY, TIREBASE_BASE_URL
 */
import { requireAdmin } from "../../../lib/adminAuth.js";

const GOALS = { tires: 75, alignments: 15, tpms: 4, brakes: 1, oil: 2 };

function money(v) {
  const n = Number(String(v == null ? 0 : v).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}
function qty(v) {
  const n = Number(String(v == null ? 0 : v).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}
function categorize(desc) {
  const d = (desc || "").toLowerCase();
  if (d.includes("tpms")) return "tpms";
  if (d.includes("alignment")) return "alignment";
  if (d.includes("oil")) return "oil";
  if (d.includes("brake")) return "brake";
  if (/\d{3}\s*\/\s*\d{2}/.test(d) || /p?\d{3}\/\d{2}\s*r?\d{2}/.test(d) || /\b\d{7}\b/.test(d) || d.includes("tire"))
    return "tire";
  return "other";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });

  const key = process.env.TIREBASE_API_KEY;
  const base = process.env.TIREBASE_BASE_URL || "https://api.tirebase.io/v1/external";
  if (!key) return res.status(500).json({ error: "TireBase isn't connected yet (missing API key)." });

  const { date, store_id = 1 } = req.body || {};
  const day = date || new Date().toISOString().slice(0, 10);

  let rows;
  try {
    const url = `${base}/order/getAllOrderDetailsByInvoiceDate?date_1=${day}&date_2=${day}&store_id=${store_id}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    const d = await r.json();
    if (!r.ok) return res.status(502).json({ error: d.message || "TireBase request failed." });
    rows = d.data || [];
  } catch (e) {
    return res.status(502).json({ error: "Could not reach TireBase." });
  }

  // Revenue + payments are per INVOICE (TireBase repeats invoice tax on every
  // line, so summing line totals over-counts). Service counts are per line.
  const invoiceTotal = {};   // invoice_number -> total_invoice (set once)
  const invoiceMethod = {};  // invoice_number -> payment method
  const invoiceStaff = {};   // invoice_number -> salesperson
  const services = { tires: 0, alignments: 0, tpms: 0, brakes: 0, oil: 0 };

  rows.forEach((row, i) => {
    const inv = row.invoice_number || `#${i}`;
    invoiceTotal[inv] = money(row.total_invoice);
    if (!invoiceMethod[inv]) invoiceMethod[inv] = (row.account_category || "Other").trim() || "Other";
    const sp = (row.sales_person_name || row.technician || "").trim();
    if (sp && !invoiceStaff[inv]) invoiceStaff[inv] = sp;

    const q = qty(row.quantity);
    const cat = categorize(row.description);
    if (cat === "tire") services.tires += q;
    else if (cat === "alignment") services.alignments += q;
    else if (cat === "tpms") services.tpms += q;
    else if (cat === "brake") services.brakes += q;
    else if (cat === "oil") services.oil += q;
  });

  let revenue = 0;
  const payments = {};
  const staffMap = {};
  for (const inv of Object.keys(invoiceTotal)) {
    const t = invoiceTotal[inv];
    revenue += t;
    const method = invoiceMethod[inv] || "Other";
    payments[method] = (payments[method] || 0) + t;
    const sp = invoiceStaff[inv];
    if (sp) staffMap[sp] = (staffMap[sp] || 0) + t;
  }
  const invoices = new Set(Object.keys(invoiceTotal));
  const staff = Object.entries(staffMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);

  return res.status(200).json({
    date: day,
    store: "The Tire Plug",
    revenue: Math.round(revenue * 100) / 100,
    invoices: invoices.size,
    payments,
    services,
    goals: GOALS,
    staff,
  });
}
