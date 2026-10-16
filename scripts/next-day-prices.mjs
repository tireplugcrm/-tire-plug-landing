/**
 * Distributor specials -> the website's "Next-day order" tires, price-matched.
 *
 *   node scripts/next-day-prices.mjs "<private pricing file>.json" [--min-margin=0.10]
 *
 * The pricing file stays OFF the repo (it holds our cost). Shape:
 *   { "source": "Tire Outlet", "priceCheckedAt": "2026-10-16",
 *     "rows": [{ "brand", "model", "size", "note", "cost", "amazon": 123.45|null, "walmart": 119|null }] }
 *
 * Rule (owner's): our price beats the lower of Amazon and Walmart by at least $5 a tire,
 * rounded down to a whole dollar. Labor is not included (install & balance stays as listed).
 * A tire is held back, and listed for review, when:
 *   - neither Amazon nor Walmart has it (nothing to match), or
 *   - the matched price would leave less than --min-margin over cost (default 10%).
 *
 * WHAT GOES PUBLIC (data/next-day.json): brand, model, size and our selling price.
 * Never cost, never the competitor prices.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
// Same size keys as the in-stock tires (scripts/inventory-snapshot.mjs).
function sizeOf(width, ratio, diameter) {
  const w = Number(width), r = Number(ratio), d = Number(diameter);
  if (!w || !r || !d) return null;
  return { key: `${w}/${r}R${d}`, rim: d };
}

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const OUT = path.join(DATA, "next-day.json");
const BEAT_BY = 5;

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/next-day-prices.mjs "<private pricing file>.json" [--min-margin=0.10]');
  process.exit(1);
}
const minMargin = Number((process.argv.find((a) => a.startsWith("--min-margin=")) || "=0.10").split("=")[1]);
const input = JSON.parse(fs.readFileSync(file, "utf8"));

// Same model names as the in-stock tires, so specs and photos line up.
const models = JSON.parse(fs.readFileSync(path.join(DATA, "tire-models.json"), "utf8")).models;
const canon = new Map();
for (const [id, m] of Object.entries(models)) {
  const [brand, model] = id.split("|");
  for (const name of [model, ...(m.aliases || [])]) canon.set(`${norm(brand)}|${norm(name)}`, model);
}

const tires = [], held = [];
for (const r of input.rows) {
  const lt = /^LT/i.test(r.size) || /ply|LT/i.test(r.note || "");
  const m = r.size.replace(/^(LT|P)/i, "").match(/^(\d{2,3})\/(\d{2})Z?R(\d{2})/i);
  const size = m && sizeOf(m[1], m[2], m[3]);
  const label = `${r.brand} ${r.model} ${r.size}`;
  if (!size) { held.push([label, "size not understood"]); continue; }
  const quotes = [["Amazon", r.amazon], ["Walmart", r.walmart]].filter(([, p]) => typeof p === "number" && p > 0);
  if (!quotes.length) { held.push([label, "no Amazon or Walmart price to match"]); continue; }
  const [store, low] = quotes.reduce((a, b) => (b[1] < a[1] ? b : a));
  const price = Math.floor(low - BEAT_BY);
  const margin = (price - r.cost) / price;
  if (margin < minMargin) {
    held.push([label, `matched price $${price} vs cost $${r.cost} (${(margin * 100).toFixed(0)}% margin, below ${(minMargin * 100).toFixed(0)}%)`]);
    continue;
  }
  const both = quotes.length === 2;
  tires.push({
    brand: r.brand,
    model: canon.get(`${norm(r.brand)}|${norm(r.model)}`) || r.model,
    key: size.key, rim: size.rim, lt,
    price,
    priceNote: both ? "Beats Amazon & Walmart by $5+" : `Beats ${store} by $5+`,
    _review: { cost: r.cost, low, store, margin }, // stripped before writing
  });
}

const publicTires = tires
  .map(({ _review, ...t }) => t)
  .sort((a, b) => a.rim - b.rim || a.key.localeCompare(b.key, "en", { numeric: true }) || a.price - b.price);
fs.writeFileSync(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), source: input.source, priceCheckedAt: input.priceCheckedAt, tires: publicTires }, null, 2) + "\n");

// Private review, printed only
console.log(`${publicTires.length} next-day tires priced -> ${path.relative(process.cwd(), OUT)}`);
for (const t of tires) console.log(`  ${t.brand} ${t.model} ${t.key}: $${t.price} (${t._review.store} $${t._review.low}, cost $${t._review.cost}, ${(t._review.margin * 100).toFixed(0)}% margin)`);
if (held.length) {
  console.log(`\n${held.length} held back for review:`);
  for (const [label, why] of held) console.log(`  ${label}: ${why}`);
}
