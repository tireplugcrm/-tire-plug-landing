/**
 * Turbo's RBP list -> the RBP catalog on the website (lib/rbp-catalog-data.js), prices only.
 *
 *   node scripts/rbp-catalog-turbo.mjs "<private turbo rbp file>.psv" "<Tekmetric inventory export>.csv"
 *
 * The Turbo file stays OFF the repo (it holds our cost). Pipe-separated with a header line:
 *   code|desc|stock|buy|fet        (desc as Turbo prints it, stock "0" means Turbo is out)
 * The Tekmetric export gives the shelf cost of the RBP tires we already have.
 *
 * Rule (owner's, Oct 27): a size on our shelf is shelf cost + $20; any other size is Turbo's price
 * + FET + $20, rounded up to a whole dollar. A size Turbo is out of and we don't stock is left off.
 * Lines listed: Repulsor A/T Plateau, R/T, X/T, M/T3 and the original M/T (not Guarantor H/T or
 * the Conveyor trailer tires). Re-run after an RBP delivery so shelf prices follow the new cost, and after a Turbo pull.
 *
 * WHAT GOES IN lib/rbp-catalog-data.js: model, size, load/speed, ply and our selling price. Never
 * cost, Turbo's stock or part numbers.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stockBuilder, norm } from "../lib/tire-stock.mjs";
import { linesFromCsv } from "../lib/stock-csv.mjs";

const MARKUP = 20;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "lib", "rbp-catalog-data.js");

// A line matches on Turbo's description, or on the part number where two lines share a name: the
// original Repulsor M/T (RBPMT…) and the newer M/T3 (RBPSTMT3…) are different tires.
const LINES = [
  { re: /A\/T PLATEAU|;AT PLATEAU|AT PLATEAU/, model: "Repulsor A/T Plateau", note: "All-terrain", tag: "at" },
  { re: /X\/T/, model: "Repulsor X/T", note: "Extreme-terrain", tag: "xt" },
  { re: /M\/T 3|M\/T3/, model: "Repulsor M/T3", note: "Mud-terrain", tag: "mt3" },
  { code: /^RBPMT/, re: /M\/T/, model: "Repulsor M/T (original)", note: "Mud-terrain, original tread", tag: "mt" },
  { re: /R\/T|;RT\b/, model: "Repulsor R/T", note: "Rugged-terrain", tag: "rt" },
];
// Leftovers Turbo prices far above the other lines in the same size (owner: leave them off).
const SKIP = new Set(["RBPMT1670010", "RBPMT22135010", "RBPMT20125010"]);
// Which line a Tekmetric model name is ("Repulsor A/T", "Repulsor MT", "Repulsor R/T"). Our shelf
// "Repulsor MT" is the M/T3 (RBPSTMT3…).
const tagOfModel = (m) => { const n = norm(m); return /xt/.test(n) ? "xt" : /original/.test(n) ? "mt" : /mt/.test(n) ? "mt3" : /rt/.test(n) ? "rt" : /at|plateau/.test(n) ? "at" : null; };

// "LT285/65R18", "P285/45R22", "33x12.50R20LT", "285/40R24" -> { size, key, rim, lt } (null for ST / C sizes)
function parseSize(tok) {
  const s = tok.toUpperCase().replace(/^P(?=\d)/, "");
  const m = s.match(/^(LT)?(\d{2,3})(?:\/(\d{2})|X([\d.]+))R(\d{2})(LT)?$/);
  if (!m) return null;
  const lt = !!(m[1] || m[6]);
  const key = m[3] ? `${m[2]}/${m[3]}R${m[5]}` : `${m[2]}X${Number(m[4]).toFixed(2)}R${m[5]}`;
  const size = m[3] ? `${m[1] ? "LT" : ""}${key}` : `${key}${lt ? "LT" : ""}`;
  return { size, key, rim: Number(m[5]), lt };
}

// Load/speed and ply from the end of Turbo's description: "... 126/123 S 10 E", "... 114 T SL", "... 112 V XL".
function parseRating(desc) {
  const tail = desc.match(/(\d{2,3}(?:\/\d{2,3})?) ([A-Z])(?: (SL|XL|(\d{1,2}) ([A-Z])))?$/);
  if (tail) return { loadSpeed: `${tail[1]}${tail[2]}`, ply: tail[5] ? `${tail[5]}/${tail[4]}` : tail[3] === "XL" ? "XL" : "" };
  const any = desc.match(/\b(\d{2,3}(?:\/\d{2,3})?)([A-Z])\b/);
  return { loadSpeed: any ? `${any[1]}${any[2]}` : "", ply: /\bXL\b/.test(desc) ? "XL" : "" };
}

const [turboFile, csvFile] = process.argv.slice(2);
if (!turboFile || !csvFile) { console.error("usage: node scripts/rbp-catalog-turbo.mjs <turbo-rbp.psv> <tekmetric.csv>"); process.exit(1); }

// Shelf cost of RBP tires we have: line|key|lt -> average cost.
const models = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "tire-models.json"), "utf8"));
const b = stockBuilder(models);
for (const l of linesFromCsv(fs.readFileSync(csvFile, "utf8"))) b.add(l);
const shelf = new Map();
for (const t of b.finish({ withPrivate: true }).tires) {
  if (t.brand !== "RBP" || !t.cost) continue;
  const tag = tagOfModel(t.model);
  if (tag) shelf.set(`${tag}|${t.key}|${!!t.lt}`, t.cost);
}

const best = new Map(); // tag|size -> entry
const skipped = [];
for (const row of fs.readFileSync(turboFile, "utf8").trim().split(/\r?\n/).slice(1)) {
  const [code, desc, stock, buy, fet] = row.split("|");
  if (SKIP.has(code)) continue;
  const line = LINES.find((L) => (L.code ? L.code.test(code) : true) && L.re.test(desc));
  const sz = parseSize(desc.split(" ")[0]);
  if (!line || !sz) { skipped.push(`${code} ${desc.slice(0, 40)}`); continue; }
  const shelfCost = shelf.get(`${line.tag}|${sz.key}|${sz.lt}`);
  if (shelfCost == null && stock === "0") continue; // Turbo is out and we don't have it
  const price = Math.ceil((shelfCost != null ? shelfCost : Number(buy) + Number(fet || 0)) + MARKUP);
  const id = `${line.tag}|${sz.size}`;
  const cur = best.get(id);
  if (!cur || price < cur.price) best.set(id, { line, ...sz, ...parseRating(desc), price, onShelf: shelfCost != null });
}

// Group by rim, then line, P-metric before LT, smallest size first (same layout as before).
const rims = new Map();
for (const e of best.values()) {
  if (!rims.has(e.rim)) rims.set(e.rim, new Map());
  const g = rims.get(e.rim);
  if (!g.has(e.line.model)) g.set(e.line.model, { model: e.line.model, note: e.line.note, sizes: [] });
  g.get(e.line.model).sizes.push(e);
}
const order = LINES.map((L) => L.model);
const catalog = [...rims.entries()].sort((a, b) => a[0] - b[0]).map(([rim, g]) => ({
  rim,
  groups: [...g.values()].sort((a, b) => order.indexOf(a.model) - order.indexOf(b.model)).map((grp) => ({
    model: grp.model, note: grp.note,
    sizes: grp.sizes.sort((a, b) => a.lt - b.lt || a.key.localeCompare(b.key, "en", { numeric: true }))
      .map((e) => [e.size, e.loadSpeed, e.ply, e.price]),
  })),
}));

const count = catalog.reduce((n, c) => n + c.groups.reduce((m, g) => m + g.sizes.length, 0), 0);
const onShelf = [...best.values()].filter((e) => e.onShelf).length;
const stamp = new Date().toISOString().slice(0, 10);
fs.writeFileSync(OUT, `// Generated by scripts/rbp-catalog-turbo.mjs on ${stamp} from Turbo's RBP list and our shelf costs.\n// Don't edit by hand: re-run the script. Prices per tire, tire only: shelf cost + $${MARKUP} for sizes we stock,\n// Turbo + FET + $${MARKUP} for the rest. Each size: [size, load/speed, ply, price]\nexport default ${JSON.stringify(catalog, null, 1).replace(/\n\s+(?=[\]"\d])/g, " ").replace(/\[ /g, "[")};\n`);
console.log(`${count} sizes (${onShelf} priced from our shelf) across ${catalog.length} rims -> ${path.relative(ROOT, OUT)}`);
for (const L of LINES) console.log(`  ${L.model}: ${[...best.values()].filter((e) => e.line === L).length}`);
if (skipped.length) console.log(`skipped (not a listed line or size): ${skipped.length}\n  ${skipped.join("\n  ")}`);
