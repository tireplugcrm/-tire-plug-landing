// Tekmetric API client for the live tire stock (server side only: getStaticProps, scripts).
// Docs: https://api.tekmetric.com  (Inventory endpoint, beta)
//
// Env vars (Vercel → Settings → Environment Variables; never NEXT_PUBLIC_, these are secrets):
//   TEKMETRIC_CLIENT_ID, TEKMETRIC_CLIENT_SECRET  from Tekmetric once the API application is approved
//   TEKMETRIC_SHOP_ID                             our shop's id (GET /api/v1/shops lists it)
//   TEKMETRIC_ENV                                 "production" (shop.tekmetric.com) or "sandbox" (default)
//
// The API returns cost and retail for every part. toLine() passes cost on for the server-side
// stock sync (lib/pricing.js stores it in Supabase, owner-only); lib/tire-stock.mjs drops it from
// anything public. Retail, bin and other counts stay here.

const HOSTS = { production: "https://shop.tekmetric.com", sandbox: "https://sandbox.tekmetric.com" };
const TIRE_PART_TYPE = 2; // Inventory partTypeId: 1 Part, 2 Tire, 5 Battery
const PAGE_SIZE = 100; // the API's maximum

export function tekmetricConfigured() {
  return Boolean(process.env.TEKMETRIC_CLIENT_ID && process.env.TEKMETRIC_CLIENT_SECRET && process.env.TEKMETRIC_SHOP_ID);
}

function host() {
  return HOSTS[process.env.TEKMETRIC_ENV === "production" ? "production" : "sandbox"];
}

// Tekmetric tokens stay valid until revoked, so one per server instance is enough.
let token = null;

async function getToken() {
  if (token) return token;
  const basic = Buffer.from(`${process.env.TEKMETRIC_CLIENT_ID}:${process.env.TEKMETRIC_CLIENT_SECRET}`).toString("base64");
  const res = await call(`${host()}/api/v1/oauth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: "grant_type=client_credentials",
  });
  token = res.access_token;
  if (!token) throw new Error("Tekmetric: no access_token in token response");
  return token;
}

async function api(pathAndQuery) {
  try {
    return await call(`${host()}${pathAndQuery}`, { headers: { Authorization: `Bearer ${await getToken()}` } });
  } catch (e) {
    if (e.status === 401) token = null; // revoked or rotated: get a new one next time
    throw e;
  }
}

// fetch with a timeout and Tekmetric's recommended backoff on 429 (2s, 4s, 8s + jitter).
async function call(url, init, attempt = 1) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let res;
  try {
    res = await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429 && attempt <= 3) {
    await new Promise((r) => setTimeout(r, 2 ** attempt * 1000 + Math.random() * 1000));
    return call(url, init, attempt + 1);
  }
  if (!res.ok) {
    const err = new Error(`Tekmetric ${res.status} on ${new URL(url).pathname}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Our shops, to find TEKMETRIC_SHOP_ID: [{ id, name, ... }]
export async function listShops() {
  return api("/api/v1/shops");
}

// Every tire line in Tekmetric inventory, as lines for lib/tire-stock.mjs.
export async function fetchTireLines() {
  const shop = encodeURIComponent(process.env.TEKMETRIC_SHOP_ID);
  const lines = [];
  for (let page = 0; page < 100; page++) {
    const res = await api(`/api/v1/inventory?shop=${shop}&partTypeId=${TIRE_PART_TYPE}&size=${PAGE_SIZE}&page=${page}&sort=id`);
    for (const row of res.content || []) if (!row.deletedDate) lines.push(toLine(row));
    if (res.last || !(res.content || []).length) break;
  }
  return lines;
}

// One API row -> the neutral line shape. Retail, bin and counts other than "available" stay here.
// The model comes from Tekmetric's Tire Model field only: the part "name" is usually blank for
// tires, and when set it's a generated title ("Brand Model - 215/60/16"), not a model.
// "description" is the CSV's Additional Details (where used / takeoff tires are marked).
function toLine(r) {
  return {
    partType: "Tire",
    available: r.available,
    details: r.description,
    width: r.width, ratio: r.ratio, diameter: r.diameter,
    brand: r.brand, model: r.model, tireType: r.tireType, partNumber: r.partNumber,
    loadIndex: r.loadIndex, speedRating: r.speedRating, loadRange: r.loadRange,
    treadwear: r.treadwear, traction: r.traction, temperature: r.temperature,
    mileageWarranty: r.mileageWarranty, sideWallStyle: r.sideWallStyle, runFlat: r.runFlat,
    cost: r.cost,
  };
}
