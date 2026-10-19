// The fleet / business price list (/fleet): for every size we can price, the cheapest tire we have
// in it, grouped by vehicle type. Prices are only ever the same public prices the /tires pages show:
// in-stock prices from site_prices (Supabase, only once the owner turned them on), next-day prices
// (data/next-day.json) and the RBP / Kumho catalog. Never costs. SERVER ONLY.
import nextDay from "../data/next-day.json";
import { allTires, INSTALL_FROM } from "./tire-catalog";
import { publicStock, publicPrices, priceOnPage } from "./pricing.js";
import { pricingContext } from "./pricing-context.js";

const dims = (key) => {
  const m = String(key).match(/^(\d{3})\/(\d{2})R(\d{2})$/);
  return m ? { width: +m[1], ratio: +m[2], rim: +m[3] } : null;
};

// Which kind of vehicle a size is mostly for. Flotation sizes (33X12.50R20) are truck sizes.
function groupOf(key, lt) {
  const d = dims(key);
  if (!d || lt || (d.ratio >= 70 && d.rim >= 15) || (d.ratio >= 65 && d.rim >= 16 && d.width >= 245)) return "trucks";
  if ((d.ratio >= 60 && d.rim >= 17) || (d.ratio >= 55 && d.rim >= 18)) return "suvs";
  return "cars";
}

export const GROUPS = [
  { id: "trucks", title: "Work trucks, vans & pickups", blurb: "LT and light-truck sizes for pickups, cargo vans and box trucks." },
  { id: "suvs", title: "SUVs & crossovers", blurb: "Sizes for company SUVs and crossovers." },
  { id: "cars", title: "Cars, hybrids & rideshare", blurb: "Sedan, compact and hybrid sizes for sales cars, rideshare and delivery cars." },
];

export async function fleetCatalog() {
  const ctx = pricingContext();
  const [stock, prices] = await Promise.all([publicStock(ctx), publicPrices(ctx)]);
  const options = [];
  for (const t of stock) {
    const p = priceOnPage(t, prices);
    if (p?.price) options.push({ key: t.key, lt: !!t.lt, brand: t.brand, model: t.model, price: p.price, when: "today" });
  }
  for (const t of nextDay.tires) options.push({ key: t.key, lt: !!t.lt, brand: t.brand, model: t.model, price: t.price, when: "nextday" });
  for (const t of allTires()) options.push({ key: t.key, lt: !!t.lt, brand: t.brand, model: t.model, price: t.price, when: "order", special: t.special || null });

  const bySize = new Map();
  for (const o of options) {
    const cur = bySize.get(o.key) || { key: o.key, lt: false, options: 0, today: false, best: null };
    cur.options += 1;
    cur.lt = cur.lt || o.lt;
    cur.today = cur.today || o.when === "today";
    if (!cur.best || o.price < cur.best.price) cur.best = o;
    bySize.set(o.key, cur);
  }
  const rows = [...bySize.values()].map((s) => ({
    key: s.key, group: groupOf(s.key, s.lt), options: s.options, today: s.today,
    brand: s.best.brand, model: s.best.model, price: s.best.price, when: s.best.when, special: s.best.special || null,
  })).sort((a, b) => (dims(a.key)?.rim || 99) - (dims(b.key)?.rim || 99) || a.key.localeCompare(b.key, "en", { numeric: true }));

  return {
    groups: GROUPS.map((g) => ({ ...g, rows: rows.filter((r) => r.group === g.id) })).filter((g) => g.rows.length),
    sizes: rows.length,
    install: INSTALL_FROM,
    stockLive: prices.live,
    updated: new Date().toISOString().slice(0, 10),
  };
}
