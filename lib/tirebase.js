/**
 * Shared TireBase helpers (server-only). Pulls a day's orders and aggregates
 * revenue (per invoice — TireBase repeats invoice tax on every line, so we
 * never sum line totals), payments, service counts, invoices, and staff.
 */
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

// Normalize a line description into a stable match key (lowercase, alphanumeric only).
// "215/55R17- Arroyo Grand Sport AS" -> "21555r17arroyograndsportas"
export function normalizeDesc(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Raw order line items for a date range (for the finance P&L / cost matching).
export async function fetchOrderLines({ from, to, store_id = 1 }) {
  const key = process.env.TIREBASE_API_KEY;
  const base = process.env.TIREBASE_BASE_URL || "https://api.tirebase.io/v1/external";
  if (!key) throw new Error("TireBase isn't connected yet (missing API key).");
  const url = `${base}/order/getAllOrderDetailsByInvoiceDate?date_1=${from}&date_2=${to}&store_id=${store_id}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || "TireBase request failed.");
  return d.data || [];
}

export async function fetchDayScoreboard({ date, store_id = 1 } = {}) {
  const key = process.env.TIREBASE_API_KEY;
  const base = process.env.TIREBASE_BASE_URL || "https://api.tirebase.io/v1/external";
  if (!key) throw new Error("TireBase isn't connected yet (missing API key).");
  const day = date || new Date().toISOString().slice(0, 10);

  const url = `${base}/order/getAllOrderDetailsByInvoiceDate?date_1=${day}&date_2=${day}&store_id=${store_id}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || "TireBase request failed.");
  const rows = d.data || [];

  const invoiceTotal = {};
  const invoiceMethod = {};
  const invoiceStaff = {};
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
  const staff = Object.entries(staffMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);

  return {
    date: day,
    store: "The Tire Plug",
    revenue: Math.round(revenue * 100) / 100,
    invoices: Object.keys(invoiceTotal).length,
    payments,
    services,
    goals: GOALS,
    staff,
  };
}
