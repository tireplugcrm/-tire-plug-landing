// What's physically on the racks, for the /tires pages. Availability only: brand, model,
// size and "in" / "low" stock. Never cost, price or exact counts (it all lands in page source).
//
// INVENTORY_SOURCE picks where it comes from:
//   "snapshot"  (default) data/inventory-snapshot.json, built from a Tekmetric CSV export by
//               scripts/inventory-snapshot.mjs and published by committing it.
//   "tekmetric" the Tekmetric API, once Tekmetric approves API access (not built yet; falls
//               back to the snapshot so the site never goes empty).
import snapshot from "../data/inventory-snapshot.json";
import nextDay from "../data/next-day.json";
import specSheets from "../data/tire-specs.json";
import modelInfo from "../data/tire-models.json";
import { brandLogo, logoOnDark } from "./tire-brands";
import { sizeIndex, sizeToSlug } from "./tire-catalog";

// Model names are typed loosely in Tekmetric ("Quattro Tempo Tour AW" / "QUATTRO TEMPO TOUR AW"),
// so the spec and model files are matched on a normalized name.
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const byNorm = (obj) => new Map(Object.entries(obj).map(([k, v]) => [k.split("|").map(norm).join("|"), v]));
const SHEETS = byNorm(specSheets.sheets);
const MODELS = byNorm(modelInfo.models);

// Card data for one stocked tire: Tekmetric's specs, overridden by a spec sheet when we have one.
function withDetails(t) {
  const sheet = SHEETS.get([norm(t.brand), norm(t.model), norm(t.key)].join("|")) || {};
  const model = MODELS.get([norm(t.brand), norm(t.model)].join("|")) || {};
  return {
    ...t,
    specs: { ...t.specs, ...sheet },
    category: model.category || null,
    about: model.about || null,
    features: model.features || [],
    // No photo for this model yet: a generic tire drawing, labeled as such on the card.
    img: model.img || "/images/tires/generic-tire.svg",
    imgGeneric: !model.img,
    logo: brandLogo(t.brand),
    logoDark: logoOnDark(t.brand),
  };
}

async function loadTires() {
  if (process.env.INVENTORY_SOURCE === "tekmetric") {
    console.warn("[inventory] INVENTORY_SOURCE=tekmetric is not connected yet; serving the snapshot");
  }
  return snapshot.tires;
}

export async function stockForSize(key) {
  return (await loadTires())
    .filter((t) => t.key === key)
    .map(withDetails)
    .sort((a, b) => (a.level === b.level ? a.brand.localeCompare(b.brand) : a.level === "in" ? -1 : 1));
}

// Tires our distributors deliver next day (data/next-day.json, built by scripts/next-day-prices.mjs).
// These carry our selling price only; distributor cost never reaches this file.
// A tire we already have on the shelf in that size is left out here: the in-stock card covers it.
export async function nextDayForSize(key) {
  const onShelf = new Set((await loadTires()).filter((t) => t.key === key).map((t) => `${norm(t.brand)}|${norm(t.model)}`));
  return nextDay.tires
    .filter((t) => t.key === key && !onShelf.has(`${norm(t.brand)}|${norm(t.model)}`))
    .map((t) => ({ ...withDetails({ ...t, level: "nextday", specs: t.specs || {} }) }))
    .sort((a, b) => a.price - b.price);
}
export const NEXT_DAY = { source: nextDay.source, priceCheckedAt: nextDay.priceCheckedAt };

// One entry per size we have on the shelf: { key, slug, rim, count }.
export async function stockSizes() {
  const map = new Map();
  for (const t of await loadTires()) {
    const cur = map.get(t.key) || { key: t.key, slug: sizeToSlug(t.key), rim: t.rim, count: 0 };
    cur.count += 1;
    map.set(t.key, cur);
  }
  return [...map.values()];
}

// Every size with a page: catalog sizes (priced, can order) plus sizes on the shelf.
// { key, slug, rim, count, from, stock }: from is null for shelf-only sizes, stock is 0 if none on hand.
// Only sizes a /tires/<size> page can render (e.g. no 19.5" commercial sizes).
const PAGE_SIZE_RE = /^(\d{3}\/\d{2}R\d{2}|\d{2}X\d{1,2}\.\d{2}R\d{2})$/;
export async function allSizes() {
  const map = new Map(sizeIndex().map((s) => [s.key, { ...s, stock: 0 }]));
  for (const s of await stockSizes()) {
    const cur = map.get(s.key) || { key: s.key, slug: s.slug, rim: s.rim, count: 0, from: null, stock: 0 };
    cur.stock = s.count;
    map.set(s.key, cur);
  }
  // sizes we can get next day get a page too
  for (const t of nextDay.tires) {
    if (map.has(t.key)) continue;
    map.set(t.key, { key: t.key, slug: sizeToSlug(t.key), rim: t.rim, count: 0, from: null, stock: 0 });
  }
  return [...map.values()]
    .filter((s) => PAGE_SIZE_RE.test(s.key))
    .sort((a, b) => a.rim - b.rim || a.key.localeCompare(b.key, "en", { numeric: true }));
}

export const STOCK_UPDATED_AT = snapshot.updatedAt;
