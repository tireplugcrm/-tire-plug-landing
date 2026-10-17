/**
 * Tekmetric inventory -> the website's in-stock tire list.
 *
 *   node scripts/inventory-snapshot.mjs "C:\Users\User\Downloads\The Tire Plug's Inventory.csv"
 *
 * Takes the CSV from Tekmetric (Inventory -> Download CSV) and writes
 * data/inventory-snapshot.json: the public fallback the /tires pages use only if Supabase can't be
 * read. Day to day, stock goes in through the admin Pricing tab (drop the same CSV there) or syncs
 * from the Tekmetric API on its own; see lib/pricing.js.
 * Re-run it after editing data/tire-models.json so model aliases are applied.
 *
 * WHAT GOES PUBLIC: brand, model, size, the tire's published specs (load/speed,
 * UTQG, warranty...) and a stock level ("in" or "low").
 * Never cost, never retail, never the exact count. The JSON ends up in the page
 * source, so anything written here is readable by anyone.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stockBuilder } from "../lib/tire-stock.mjs";
import { linesFromCsv } from "../lib/stock-csv.mjs";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const OUT = path.join(DATA, "inventory-snapshot.json");

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/inventory-snapshot.mjs "<Tekmetric inventory CSV>"');
  process.exit(1);
}

// Same rules as the live API (lib/tire-stock.mjs) and the admin upload (lib/stock-csv.mjs).
const stock = stockBuilder(JSON.parse(fs.readFileSync(path.join(DATA, "tire-models.json"), "utf8")));
for (const line of linesFromCsv(fs.readFileSync(file, "utf8"))) stock.add(line);
const { tires, skipped } = stock.finish();

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), source: "tekmetric-csv", tires }, null, 2) + "\n");
console.log(`${tires.length} in-stock tires across ${new Set(tires.map((t) => t.key)).size} sizes -> ${path.relative(process.cwd(), OUT)}`);
if (skipped) console.log(`${skipped} units skipped: no size or brand in Tekmetric`);
