/**
 * TireBase WRITE helpers (server-only) — used by the CRM "Push to TireBase" button.
 * Looks up (or creates) a customer by phone, then creates a Quote order whose lines
 * use TireBase's three generic catalog products at our custom prices. The human-readable
 * breakdown of what each generic line means is carried in the order `notes`.
 *
 * Generic product bridge (TireBase needs a numeric product_id, not free text):
 *   GEN0001 (79143) = tire line   ·   4WAL (77827) = wheel alignment   ·   GL (2) = labor / other
 * Override any of these via env if TireBase ever renumbers them.
 */
const BASE = process.env.TIREBASE_BASE_URL || "https://api.tirebase.io/v1/external";

const PID_TIRE = Number(process.env.TIREBASE_PID_TIRE || 79143);   // GEN0001
const PID_ALIGN = Number(process.env.TIREBASE_PID_ALIGN || 77827); // 4WAL
const PID_LABOR = Number(process.env.TIREBASE_PID_LABOR || 2);     // GL
const QUOTE_STATUS_ID = Number(process.env.TIREBASE_QUOTE_STATUS_ID || 5); // "Quote"
const STORE_ID = Number(process.env.TIREBASE_STORE_ID || 1);

function key() {
  const k = process.env.TIREBASE_API_KEY;
  if (!k) throw new Error("TireBase isn't connected (missing API key).");
  return k;
}
async function tb(path, { method = "GET", body } = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || `TireBase ${method} ${path} failed (${r.status}).`);
  return d;
}

const digits = (s) => String(s || "").replace(/\D/g, "");
const last10 = (s) => digits(s).slice(-10);

// Local timestamp formatted the way TireBase expects: "YYYY-MM-DD HH:MM:SS".
function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const time = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  return { date, datetime: `${date} ${time}` };
}

// Find a customer by phone; returns customer_id (string/number) or null.
export async function findCustomerByPhone(phone) {
  const want = last10(phone);
  if (!want) return null;
  const d = await tb(`/customer/getCustomerByPhone?phone=${encodeURIComponent(want)}`);
  const list = Array.isArray(d.data) ? d.data : d.data ? [d.data] : [];
  if (!list.length) return null;
  const exact = list.find((c) => last10(c.phone_number_1) === want || last10(c.phone_number_2) === want);
  return (exact || list[0]).customer_id || null;
}

// Create a minimal Individual customer from a CRM lead; returns the new customer_id.
export async function createCustomer({ name, phone, email, isCommercial }) {
  const parts = String(name || "").trim().split(/\s+/);
  const first = parts[0] || "Customer";
  const last = parts.slice(1).join(" ") || "(CRM)";
  const { datetime } = stamp();
  const d = await tb(`/customer/create`, {
    method: "POST",
    body: {
      first_name: first,
      last_name: last,
      business_name: isCommercial ? (name || "") : "",
      contact_person: isCommercial ? (name || "") : "",
      billing_address_1: "",
      city: "",
      zip_code: "",
      phone_number_1: last10(phone),
      email: email || "",
      customer_type_id: isCommercial ? 2 : 1, // 1 = Individual, 2 = Business
      store_id: STORE_ID,
      default_store_id: STORE_ID,
      current_datetime: datetime,
    },
  });
  // create returns the new id in data (shape can be int or object)
  const id = typeof d.data === "object" ? d.data?.customer_id || d.data?.id : d.data;
  if (!id) throw new Error("Created customer but TireBase returned no id.");
  return id;
}

// Turn a CRM quote into TireBase order lines + a readable notes string.
// quote = { quotes:[{brand,price,qty,warranty}], road_hazard_per_tire, services:{alignment,oilChange,tpmsSet,tpmsEach} }
export function buildOrderLines(quote) {
  const lines = [];
  const notes = [];
  const num = (v) => Number(String(v == null ? "" : v).replace(/[^0-9.]/g, "")) || 0;

  const tires = (quote.quotes || []).filter((r) => r && (r.brand || r.price) && num(r.price) > 0);
  let totalTireQty = 0;
  for (const t of tires) {
    const qtyN = Math.max(1, Math.round(num(t.qty) || 1));
    totalTireQty += qtyN;
    lines.push({ product_id: PID_TIRE, quantity: qtyN, price: num(t.price) });
    notes.push(`Tire: ${t.brand || "tire"} — $${num(t.price)} ea × ${qtyN}${t.warranty ? ` (${t.warranty})` : ""}`);
  }

  const s = quote.services || {};
  if (num(s.alignment) > 0) { lines.push({ product_id: PID_ALIGN, quantity: 1, price: num(s.alignment) }); notes.push(`Wheel alignment — $${num(s.alignment)}`); }
  if (num(s.oilChange) > 0) { lines.push({ product_id: PID_LABOR, quantity: 1, price: num(s.oilChange) }); notes.push(`Oil change — $${num(s.oilChange)}`); }
  if (num(s.tpmsSet) > 0) { lines.push({ product_id: PID_LABOR, quantity: 1, price: num(s.tpmsSet) }); notes.push(`TPMS sensors (set of 4) — $${num(s.tpmsSet)}`); }
  else if (num(s.tpmsEach) > 0) { const q = totalTireQty || 4; lines.push({ product_id: PID_LABOR, quantity: q, price: num(s.tpmsEach) }); notes.push(`TPMS sensors — $${num(s.tpmsEach)} ea × ${q}`); }

  const rh = num(quote.road_hazard_per_tire);
  if (rh > 0 && totalTireQty > 0) { lines.push({ product_id: PID_LABOR, quantity: totalTireQty, price: rh }); notes.push(`Road hazard warranty — $${rh}/tire × ${totalTireQty}`); }

  return { lines, notesText: notes.join("\n") };
}

// Create a Quote order in TireBase. Returns the new order_id.
export async function createQuoteOrder({ customer_id, lines, notes }) {
  if (!lines.length) throw new Error("Quote has no priced lines to push.");
  const { date, datetime } = stamp();
  const d = await tb(`/order/createOrder`, {
    method: "POST",
    body: {
      store_id: STORE_ID,
      customer_id: Number(customer_id),
      order_status_id: QUOTE_STATUS_ID,
      date_admission: datetime,
      current_datetime: datetime,
      current_date: date,
      notes: notes || "Quote created from The Tire Plug CRM.",
      order_details: lines,
    },
  });
  const orderId = typeof d.data === "object" ? d.data?.order_id || d.data?.id : d.data;
  if (!orderId) throw new Error("createOrder returned no order id.");
  return orderId;
}
