// Distributor catalogs for the phone AI (Mary): every vendor's tires (Turbo, Tire Network, US AutoForce,
// TireLot, Tire Outlet...) in the private vendor_tires table, loaded nightly by Jarvis through
// /api/agent "vendor-load". Mary's check_tires adds these as order-in tires for sizes and brands the
// shelf and data/next-day.json don't cover. Cost never leaves the server; callers hear our price.
//
// Owner's price rule (same as next-day tires, scripts/next-day-vendor.mjs): cost + $20, Falken cost + $25,
// commercial sizes cost + $35, rounded up to a whole dollar.
import { supabaseAdmin } from "./supabaseAdmin.js";
import { sizeKey, isLT } from "./tire-catalog.js";
import { isCommercialSize } from "./pricing-engine.js";

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const vendorPrice = (cost, brand, key) => Math.ceil(Number(cost) + (isCommercialSize(key) ? 35 : /falken/i.test(brand) ? 25 : 20));

// The cheapest vendor offer per brand + model in this size with at least `qty` in stock.
export async function vendorForSize(key, qty = 4) {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin.from("vendor_tires")
    .select("vendor, brand, model, load_speed, qty, cost, eta_days, lt").eq("size_key", key).gte("qty", qty).limit(500);
  if (error || !data) return [];
  const best = new Map();
  for (const r of data) {
    const price = vendorPrice(r.cost, r.brand, key);
    const id = `${norm(r.brand)}|${norm(r.model)}`;
    const cur = best.get(id);
    if (!cur || price < cur.price || (price === cur.price && r.eta_days < cur.eta_days)) best.set(id, { brand: r.brand, model: r.model, price, eta_days: r.eta_days, lt: r.lt });
  }
  return [...best.values()].sort((a, b) => a.price - b.price);
}

// Jarvis's nightly load for one vendor: replaces that vendor's rows.
// rows: [{ size, brand, model, load_speed?, qty, cost }] ; eta_days: how soon that vendor delivers.
export async function loadVendor(vendor, rows, eta_days = 1) {
  const clean = (rows || []).map((r) => {
    const key = sizeKey(String(r.size || "").replace(/^P(?=\d)/i, ""));
    return {
      vendor, size_key: key, lt: isLT(String(r.size || "")) || /^LT$/i.test(r.type || ""),
      brand: String(r.brand || "").trim(), model: String(r.model || "").trim(), load_speed: r.load_speed || null,
      qty: Number.isFinite(Number(r.qty)) ? Math.round(Number(r.qty)) : null, cost: Number(r.cost), eta_days: Number(eta_days) || 1,
    };
  }).filter((r) => /^\d{2,3}(\/\d{2}|X\d{1,2}\.\d{2})R\d{2}(\.5)?$/.test(r.size_key) && r.brand && r.model && r.cost > 0);
  if (!clean.length) return { ok: false, error: "No valid rows (need size, brand, model, cost)" };
  const { error: delErr } = await supabaseAdmin.from("vendor_tires").delete().eq("vendor", vendor);
  if (delErr) return { ok: false, error: delErr.message };
  for (let i = 0; i < clean.length; i += 1000) {
    const { error } = await supabaseAdmin.from("vendor_tires").insert(clean.slice(i, i + 1000));
    if (error) return { ok: false, error: error.message, loaded: i };
  }
  return { ok: true, vendor, loaded: clean.length, skipped: (rows || []).length - clean.length };
}

// What each vendor last loaded, for Jarvis's health check (a vendor not loaded in 2 days is stale).
export async function vendorStatus() {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin.from("vendor_tires").select("vendor, loaded_at").order("loaded_at", { ascending: false }).limit(5000);
  const m = new Map();
  for (const r of data || []) { const v = m.get(r.vendor) || { vendor: r.vendor, rows: 0, loaded_at: r.loaded_at }; v.rows++; m.set(r.vendor, v); }
  return [...m.values()];
}
