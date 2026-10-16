/**
 * Tekmetric inventory -> the website's in-stock tire list.
 *
 *   node scripts/inventory-snapshot.mjs "C:\Users\User\Downloads\The Tire Plug's Inventory.csv"
 *
 * Takes the CSV from Tekmetric (Inventory -> Download CSV) and writes
 * data/inventory-snapshot.json, which lib/inventory.js serves to the /tires pages
 * until the Tekmetric API is connected. Commit and push the JSON to publish it.
 *
 * WHAT GOES PUBLIC: brand, model, size and a stock level ("in" or "low").
 * Never cost, never retail, never the exact count. The JSON ends up in the page
 * source, so anything written here is readable by anyone.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "inventory-snapshot.json");
const LOW_AT = 3; // 1-3 available shows "Low stock"

// Tekmetric has the same brand typed several ways.
const BRANDS = {
  "ground speed": "Groundspeed", "groundspeed tires": "Groundspeed",
  "rolling big power - rbp": "RBP", "rbp tires": "RBP",
  "evolux": "Evoluxx", "bfgoodrich": "BFGoodrich", "royal black": "Royal Black",
  "american roadstar": "American Roadstar", "gt radial": "GT Radial", "venom power": "Venom Power",
};

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/inventory-snapshot.mjs "<Tekmetric inventory CSV>"');
  process.exit(1);
}

const rows = parseCsv(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const head = rows.shift().map((h) => h.trim());
const col = (r, name) => (r[head.indexOf(name)] ?? "").trim();
for (const need of ["Brand", "Part Type", "Available", "Tire Model", "Width", "Ratio", "Diameter"]) {
  if (!head.includes(need)) throw new Error(`Not a Tekmetric inventory CSV: no "${need}" column`);
}

const byTire = new Map();
let skipped = 0;
for (const r of rows) {
  if (col(r, "Part Type") !== "Tire") continue;
  const available = Number(col(r, "Available")) || 0;
  if (available <= 0) continue;
  const details = col(r, "Additional Details").toLowerCase();
  if (/used|takeoff/.test(details)) continue; // used tires aren't listed as new stock
  const size = sizeOf(col(r, "Width"), col(r, "Ratio"), col(r, "Diameter"));
  const brandRaw = col(r, "Brand");
  if (!size || !brandRaw) { skipped += available; continue; }

  const brand = BRANDS[brandRaw.toLowerCase()] || brandRaw;
  const model = col(r, "Tire Model");
  const lt = /\bLT\b/i.test(col(r, "Tire Type")) || /\blt\b/.test(details) || size.lt;
  const id = `${brand}|${model.toLowerCase()}|${size.key}|${lt}`;
  const cur = byTire.get(id) || { brand, model, key: size.key, rim: size.rim, lt, available: 0 };
  cur.available += available;
  byTire.set(id, cur);
}

const tires = [...byTire.values()]
  .map(({ available, ...t }) => ({ ...t, level: available > LOW_AT ? "in" : "low" }))
  .sort((a, b) => a.rim - b.rim || a.key.localeCompare(b.key, "en", { numeric: true }) || a.brand.localeCompare(b.brand));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), source: "tekmetric-csv", tires }, null, 2) + "\n");
console.log(`${tires.length} in-stock tires across ${new Set(tires.map((t) => t.key)).size} sizes -> ${path.relative(process.cwd(), OUT)}`);
if (skipped) console.log(`${skipped} units skipped: no size or brand in Tekmetric`);

// Tekmetric splits the size into Width / Ratio / Diameter. Flotation sizes come
// through as Width "35X" (or "35"), Ratio 12.5. Returns the site's search key.
function sizeOf(width, ratio, diameter) {
  const w = Number(String(width).replace(/x$/i, ""));
  const r = Number(ratio);
  const d = Number(diameter);
  if (!w || !r || !d || d !== Math.floor(d)) return null;
  if (w < 100) return { key: `${w}X${r.toFixed(2)}R${d}`, rim: d, lt: true };
  return { key: `${w}/${r}R${d}`, rim: d, lt: false };
}

// Minimal RFC 4180 parser: quoted fields, doubled quotes, commas and newlines inside quotes.
function parseCsv(text) {
  const out = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) out.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); out.push(row); }
  return out;
}
