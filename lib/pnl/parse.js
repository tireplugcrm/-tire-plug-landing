/**
 * Parse TireBase "Sales Journal" + "Sales Detail" report lines into unified invoices.
 *
 * The two reports use DIFFERENT invoice numbers, so we join them by customer name
 * (corroborated by total). The Journal gives the sales rep, payment method, and the
 * authoritative subtotal/tax; the Detail gives the line items (tires, labor, alignment,
 * TPMS) we need for costing and commission.
 */

const money = (s) => Number(String(s == null ? "" : s).replace(/[^0-9.]/g, "")) || 0;
const normName = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// "[Part] 2756518 - 125/122S - LIONHART KILIMA AT" -> "2756518 - 125/122S - LIONHART KILIMA AT"
const stripTag = (d) => String(d || "").replace(/^\s*\[(Part|Labor)\]\s*/i, "").trim();

const CUST_TYPES = ["Individual", "Business", "Commercial", "Wholesale", "Fleet", "Corporate"];

// ---------------------------------------------------------------- Sales Journal
export function parseSalesJournal(lines) {
  const invoices = [];
  let last = null;
  for (const line of lines) {
    const m = line.match(/^(A-\d+)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(.+)$/);
    if (m) {
      const rest = m[4];
      const mm = rest.match(/^(.+?)\s+\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})$/);
      if (!mm) continue;
      const tokens = mm[1].trim().split(/\s+/);
      let cust_type = "Individual";
      if (CUST_TYPES.some((t) => t.toLowerCase() === tokens[tokens.length - 1].toLowerCase())) cust_type = tokens.pop();
      const customer = tokens.join(" ");
      last = {
        inv_no: m[1], rep: m[2].trim(), date: m[3], customer, cust_type,
        subtotal: money(mm[2]), tax: money(mm[3]), fet: money(mm[4]), total: money(mm[5]),
        payment_method: null,
      };
      invoices.push(last);
      continue;
    }
    const pm = line.match(/^PM\s+([A-Za-z ]+):\s*\$\s*([\d,]+\.\d{2})/);
    if (pm && last) last.payment_method = pm[1].trim();
  }
  return invoices;
}

// ---------------------------------------------------------------- Sales Detail
const ITEM_RE = /^(Tires|Services)\s+(.+?)\s+\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})$/;
const SUMMARY_RE = /^(Parts|Labor|\(\+\) Taxes|Total|SubTotal)\b/i;
const NOISE_RE = /^(No\.|Unit|Price|Gross|Type|Description|Cost|Fet|Qty|THE TIRE PLUG|SALES DETAIL|DATE:|Los Angeles|2220 |\(562\))/i;

export function parseSalesDetail(lines) {
  const invoices = [];
  let cur = null;
  let lastItem = null;
  for (const raw of lines) {
    const line = raw.trim();
    const h = line.match(/^#(\d+)\s*-\s*(.+?)\s*\(([^)]+)\)/);
    if (h) {
      cur = { detail_no: `#${h[1]}`, customer: h[2].trim(), cust_type: h[3].trim(), lines: [], total: 0 };
      invoices.push(cur);
      lastItem = null;
      continue;
    }
    if (!cur) continue;
    const it = line.match(ITEM_RE);
    if (it) {
      const desc = stripTag(it[2]);
      const item = classifyLine(it[1], desc, {
        cost: money(it[3]), unit_price: money(it[4]), gross_profit: money(it[5]),
        fet: money(it[6]), qty: money(it[7]), total: money(it[8]),
      });
      cur.lines.push(item);
      lastItem = item;
      continue;
    }
    const sm = line.match(/^Total\s+\$\s*([\d,]+\.\d{2})$/i);
    if (sm) { cur.total = money(sm[1]); lastItem = null; continue; }
    if (SUMMARY_RE.test(line)) { lastItem = null; continue; }
    if (/^\d+$/.test(line)) continue;          // the "No." row index on its own line
    if (NOISE_RE.test(line)) continue;          // column headers / page header
    // Otherwise: a wrapped description tail (e.g. "AT") — append to the last item.
    if (lastItem) {
      lastItem.description = `${lastItem.description} ${line}`.trim();
      reclassify(lastItem);
    }
  }
  return invoices;
}

function classifyLine(type, description, nums) {
  const item = { type, description, ...nums };
  reclassify(item);
  return item;
}
function reclassify(item) {
  // Classify by description — the report types oil filters / TPMS as "Tires" too.
  const d = item.description.toLowerCase();
  item.isTPMS = /tpms|sensor/.test(d);
  item.isOil = !item.isTPMS && /oil/.test(d);
  item.isAlignment = !item.isTPMS && !item.isOil && /alignment/.test(d);
  item.isTire = item.type === "Tires" && !item.isTPMS && !item.isOil && !item.isAlignment;
  item.isLabor = item.type === "Services" && !item.isAlignment && !item.isOil && !item.isTPMS;
}

// ---------------------------------------------------------------- Join the two
// Returns unified invoices: journal fields + detail line items.
export function matchDay(journalInvoices, detailInvoices) {
  const byName = {};
  for (const d of detailInvoices) {
    const k = normName(d.customer);
    (byName[k] = byName[k] || []).push(d);
  }
  const out = [];
  for (const j of journalInvoices) {
    const candidates = byName[normName(j.customer)] || [];
    let det = null;
    if (candidates.length === 1) det = candidates[0];
    else if (candidates.length > 1) {
      // disambiguate same-name invoices by closest total
      det = candidates.reduce((best, c) => (Math.abs(c.total - j.total) < Math.abs((best?.total ?? 1e9) - j.total) ? c : best), null);
    }
    if (det) det._used = true;
    out.push({
      ...j,
      detail_no: det ? det.detail_no : null,
      lines: det ? det.lines : [],
      matched: !!det,
    });
  }
  return out;
}

// Pull the report date from a header line "DATE: 06/01/2026 - 06/01/2026" -> "2026-06-01".
export function reportDate(lines) {
  for (const l of lines) {
    const m = l.match(/DATE:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    if (m) return `${m[3]}-${m[1]}-${m[2]}`;
  }
  return null;
}

export { normName, money };
