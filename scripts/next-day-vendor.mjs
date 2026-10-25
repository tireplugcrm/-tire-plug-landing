/**
 * A distributor's stock -> the website's "Next-day order" tires, at cost + markup.
 *
 *   node scripts/next-day-vendor.mjs "<private vendor file>.psv" --vendor=Turbo
 *
 * The vendor file stays OFF the repo (it holds our cost). Pipe-separated, one tire per line:
 *   size|type|brand|model|code|load|speed|qty|cost      (type is P or LT)
 *
 * Rule (owner's): drop-shipped tires are cost + $22.50, Falken cost + $25, rounded up to a whole
 * dollar like the shelf prices (lib/pricing-engine.js). The vendor file is already narrowed to the
 * lines and sizes we sell. A tire also on the price-matched list keeps the lower price.
 * Every tire on the site needs a photo: a model with no photo in data/tire-models.json is held back
 * (and listed) until one is added.
 *
 * WHAT GOES IN data/next-day.json: brand, model, size, load/speed, our selling price and which list
 * it came from (`from`, so a re-run replaces only that vendor; lib/inventory.js drops it before a page
 * sees it). Never cost, never the vendor's stock count or part number.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allTires } from "../lib/tire-catalog.js";

const MARKUP = { default: 22.5, falken: 25 };
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const OUT = path.join(DATA, "next-day.json");

const file = process.argv[2];
const vendor = (process.argv.find((a) => a.startsWith("--vendor=")) || "=").split("=")[1];
if (!file || !vendor) {
  console.error('Usage: node scripts/next-day-vendor.mjs "<private vendor file>.psv" --vendor=Turbo');
  process.exit(1);
}

// Same model names as the in-stock tires, so specs and photos line up.
const models = JSON.parse(fs.readFileSync(path.join(DATA, "tire-models.json"), "utf8")).models;
const canon = new Map();
const hasPhoto = new Set();
for (const [id, m] of Object.entries(models)) {
  const [brand, model] = id.split("|");
  for (const name of [model, ...(m.aliases || [])]) canon.set(`${norm(brand)}|${norm(name)}`, model);
  if (m.img) hasPhoto.add(`${norm(brand)}|${norm(model)}`);
}

// A tire with a catalog price (RBP / Kumho promos, the RBP page, the homepage slide) already shows on
// its size page at that price; listing it again next-day would show a second price.
const inCatalog = new Set(allTires().map((t) => [norm(t.brand), norm(t.model), t.key, t.lt ? "lt" : "p"].join("|")));

const [, ...lines] = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
const fresh = [], noPhoto = new Map();
let catalogged = 0;
for (const line of lines) {
  const [size, type, brand, model, , load, speed, , cost] = line.split("|");
  const m = size.match(/^(\d{3})\/(\d{2})R(\d{2})$/);
  if (!m || !(Number(cost) > 0)) continue;
  const name = canon.get(`${norm(brand)}|${norm(model)}`) || model;
  if (inCatalog.has([norm(brand), norm(name), size, type === "LT" ? "lt" : "p"].join("|"))) { catalogged++; continue; }
  if (!hasPhoto.has(`${norm(brand)}|${norm(name)}`)) { noPhoto.set(`${brand} ${name}`, (noPhoto.get(`${brand} ${name}`) || 0) + 1); continue; }
  const markup = MARKUP[norm(brand)] ?? MARKUP.default;
  fresh.push({
    brand,
    model: name,
    key: size, rim: Number(m[3]), lt: type === "LT",
    price: Math.ceil(Number(cost) + markup),
    ...(load ? { specs: { loadIndex: load, ...(speed ? { speed } : {}) } } : {}),
    from: vendor,
  });
}

// Keep the other lists (the price-matched Tire Outlet tires), replace this vendor's.
const prev = JSON.parse(fs.readFileSync(OUT, "utf8"));
const id = (t) => [norm(t.brand), norm(t.model), t.key, t.lt ? "lt" : "p"].join("|");
const kept = prev.tires.filter((t) => (t.from || "Tire Outlet") !== vendor && !inCatalog.has(id(t)));
const byId = new Map();
for (const t of [...kept, ...fresh]) {
  const cur = byId.get(id(t));
  if (!cur || t.price < cur.price) byId.set(id(t), t);
}
const tires = [...byId.values()]
  .sort((a, b) => a.rim - b.rim || a.key.localeCompare(b.key, "en", { numeric: true }) || a.price - b.price);

fs.writeFileSync(OUT, JSON.stringify({ ...prev, updatedAt: new Date().toISOString(), tires }, null, 2) + "\n");
console.log(`${fresh.length} ${vendor} tires priced; ${tires.length} next-day tires in all -> ${path.relative(process.cwd(), OUT)}`);
if (catalogged) console.log(`${catalogged} left to the catalog price (RBP / Kumho page and slide)`);
if (noPhoto.size) {
  console.log(`
Held back, no photo yet (add one to data/tire-models.json, then re-run):`);
  for (const [m, n] of noPhoto) console.log(`  ${m}: ${n} tires`);
}
