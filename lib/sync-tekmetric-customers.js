/**
 * Tekmetric customers -> the customer list. The shop moved invoicing from TireBase to Tekmetric
 * in mid-2026, so recent customers (and emails / marketing consent) only live in Tekmetric.
 *
 * Tekmetric figures go in tm_* columns so the weekly TireBase sync (lib/sync-customers.js),
 * which rewrites last_visit / order_count / total_spent, never clobbers them. The
 * customers_merged view (lib/customers-tekmetric-schema.sql) combines both, and every reader
 * goes through it (lib/customers-data.js).
 *
 * Matching: a Tekmetric customer joins the existing row with the same phone (last 10 digits);
 * otherwise it gets its own row keyed "tm:<id>". Manual fields (email, sms_opt_in, notes,
 * is_commercial) are never written here.
 */
import { supabaseAdmin } from "./supabaseAdmin.js";
import { fetchCustomers, fetchRepairOrders } from "./tekmetric.mjs";
import { fetchAllCustomers } from "./customers-data.js";
import { digits10 } from "./phone.js";

const HISTORY_FROM = "2025-01-01";
// Repair order statuses that mean the work happened: 3 Complete, 5 Posted, 6 Accounts Receivable.
const DONE_STATUS = new Set([3, 5, 6]);

const ymd = (s) => (s ? String(s).slice(0, 10) : null);
const maxDate = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
const minDate = (a, b) => (!a ? b : !b ? a : a < b ? a : b);

function emailOf(c) {
  const e = Array.isArray(c.email) ? c.email[0] : c.email;
  const s = String((e && (e.email || e)) || "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s : null;
}
function phonesOf(c) {
  const list = Array.isArray(c.phone) ? c.phone : c.phone ? [c.phone] : [];
  const sorted = [...list].sort((a, b) => (b && b.primary ? 1 : 0) - (a && a.primary ? 1 : 0));
  return sorted.map((p) => digits10(p && (p.number || p))).filter((d) => d.length === 10);
}
function nameOf(c) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || null;
}
function isBusiness(c) {
  const t = c.customerType || {};
  return t.id === 2 || /business/i.test(t.name || t.code || "");
}
function roDate(ro) {
  return ymd(ro.postedDate || ro.completedDate || ro.updatedDate || ro.createdDate);
}
function roHasTires(ro) {
  return (ro.jobs || []).some((j) => (j.parts || []).some((p) => {
    const t = p.partType || {};
    return t.id === 2 || /tire/i.test(t.name || t.code || "") || (p.width && p.ratio && p.diameter);
  }));
}

// Shapes and counts only, no customer values: what the API returns, to check the mapping.
export async function probeTekmetric() {
  const customers = await fetchCustomers();
  const ros = await fetchRepairOrders({ from: HISTORY_FROM });
  const count = (arr, fn) => arr.reduce((n, x) => n + (fn(x) ? 1 : 0), 0);
  const statuses = {};
  ros.forEach((r) => { const s = r.repairOrderStatus || {}; const k = `${s.id}:${s.code || s.name}`; statuses[k] = (statuses[k] || 0) + 1; });
  const dates = ros.map(roDate).filter(Boolean).sort();
  return {
    customers: customers.length,
    customerKeys: Object.keys(customers[0] || {}),
    emailShape: customers[0] ? typeof customers[0].email + (Array.isArray(customers[0].email) ? "[]" : "") : null,
    phoneShape: customers[0] && customers[0].phone ? Object.keys((customers[0].phone || [])[0] || {}) : null,
    withEmail: count(customers, emailOf),
    withPhone: count(customers, (c) => phonesOf(c).length),
    okForMarketing: count(customers, (c) => c.okForMarketing === true),
    okForMarketingFalse: count(customers, (c) => c.okForMarketing === false),
    business: count(customers, isBusiness),
    repairOrders: ros.length,
    roKeys: Object.keys(ros[0] || {}),
    roStatuses: statuses,
    roFirst: dates[0] || null,
    roLast: dates[dates.length - 1] || null,
    roWithTires: count(ros, roHasTires),
    totalSalesSample: ros[0] ? typeof ros[0].totalSales : null,
  };
}

export async function syncTekmetricCustomers() {
  const [tmCustomers, ros, existing] = await Promise.all([
    fetchCustomers(),
    fetchRepairOrders({ from: HISTORY_FROM }),
    fetchAllCustomers("id,tb_customer_id,phone,tm_customer_id"),
  ]);

  // Visit stats per Tekmetric customer, from finished repair orders only.
  const stats = {};
  for (const ro of ros) {
    const sid = ro.repairOrderStatus && ro.repairOrderStatus.id;
    if (!ro.customerId || !DONE_STATUS.has(sid)) continue;
    const s = stats[ro.customerId] || (stats[ro.customerId] = { first: null, last: null, orders: 0, spent: 0, lastTire: null });
    const d = roDate(ro);
    s.first = minDate(s.first, d);
    s.last = maxDate(s.last, d);
    s.orders += 1;
    s.spent += (Number(ro.totalSales) || 0) / 100; // Tekmetric amounts are in cents
    if (roHasTires(ro)) s.lastTire = maxDate(s.lastTire, d);
  }

  // Existing rows by Tekmetric id, then by phone.
  const byTm = new Map(), byPhone = new Map();
  for (const r of existing) {
    if (r.tm_customer_id) byTm.set(String(r.tm_customer_id), r);
    const p = digits10(r.phone);
    if (p.length === 10 && !byPhone.has(p)) byPhone.set(p, r);
  }

  const now = new Date().toISOString();
  const updates = [], inserts = [];
  const claimed = new Set();
  for (const c of tmCustomers) {
    if (c.deletedDate) continue;
    const s = stats[c.id] || {};
    const phones = phonesOf(c);
    const fields = {
      tm_customer_id: String(c.id),
      tm_email: emailOf(c),
      tm_ok_marketing: c.okForMarketing === true,
      tm_business: isBusiness(c),
      tm_first_visit: s.first || null,
      tm_last_visit: s.last || null,
      tm_order_count: s.orders || 0,
      tm_total_spent: Math.round((s.spent || 0) * 100) / 100,
      tm_last_tire_date: s.lastTire || null,
      tm_synced_at: now,
    };
    let row = byTm.get(String(c.id));
    if (!row) row = phones.map((p) => byPhone.get(p)).find((r) => r && !r.tm_customer_id && !claimed.has(r.id));
    if (row) {
      claimed.add(row.id);
      updates.push({ id: row.id, ...fields });
    } else {
      if (!phones.length && !fields.tm_email) continue; // nobody we could ever reach
      inserts.push({ tb_customer_id: `tm:${c.id}`, name: nameOf(c) || "(no name)", phone: phones[0] || null, ...fields });
    }
  }

  // Updates touch only tm_* columns; inserts are Tekmetric-only customers.
  for (let i = 0; i < updates.length; i += 200) {
    const chunk = updates.slice(i, i + 200);
    const results = await Promise.all(chunk.map(({ id, ...f }) => supabaseAdmin.from("customers").update(f).eq("id", id)));
    const bad = results.find((r) => r.error);
    if (bad) throw new Error(bad.error.message);
  }
  for (let i = 0; i < inserts.length; i += 500) {
    const { error } = await supabaseAdmin.from("customers").upsert(inserts.slice(i, i + 500), { onConflict: "tb_customer_id" });
    if (error) throw new Error(error.message);
  }

  return {
    tekmetricCustomers: tmCustomers.length,
    repairOrders: ros.length,
    matched: updates.length,
    added: inserts.length,
    withEmail: [...updates, ...inserts].filter((r) => r.tm_email).length,
    okForMarketing: [...updates, ...inserts].filter((r) => r.tm_ok_marketing).length,
  };
}
