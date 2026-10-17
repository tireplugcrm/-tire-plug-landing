/**
 * Tekmetric inventory lines -> the website's in-stock tire list.
 *
 * Shared by scripts/inventory-snapshot.mjs (the CSV export) and lib/tekmetric.mjs (the live API),
 * so both apply the same rules: brand spellings, model aliases and remaps from
 * data/tire-models.json, used tires left out, and a stock level instead of a count.
 *
 * WHAT GOES PUBLIC: brand, model, size, the tire's published specs (load/speed, UTQG,
 * warranty...) and a stock level ("in" or "low"). Never cost, never retail, never the exact
 * count: the result ends up in the page source, so anything returned here is readable by anyone.
 *
 * Each line passed to add() is a plain object, whatever the source:
 *   { partType, available, details, width, ratio, diameter, brand, model, tireType, partNumber,
 *     loadIndex, speedRating, loadRange, treadwear, traction, temperature, mileageWarranty,
 *     sideWallStyle, runFlat, cost }
 *
 * finish() returns public tires only. finish({ withPrivate: true }) also returns `available` and the
 * unit-weighted `cost` per tire, for the server-side stock sync (lib/pricing.js) that stores them in
 * Supabase. Never pass that result to a page.
 */

const LOW_AT = 3; // 1-3 available shows "Low stock"

// Tekmetric has the same brand typed several ways.
const BRANDS = {
  "ground speed": "Groundspeed", "groundspeed tires": "Groundspeed",
  "rolling big power - rbp": "RBP", "rbp tires": "RBP",
  "evolux": "Evoluxx", "bfgoodrich": "BFGoodrich", "royal black": "Royal Black",
  "american roadstar": "American Roadstar", "gt radial": "GT Radial", "venom power": "Venom Power",
};

export const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const str = (v) => (v === null || v === undefined ? "" : String(v).trim());

// modelsFile: the parsed data/tire-models.json ({ models, remap })
export function stockBuilder(modelsFile) {
  // Tekmetric has the same tire line typed several ways ("LX-Twenty", "LX-TWENTY", "LX-20").
  const canon = new Map();
  for (const [id, m] of Object.entries(modelsFile.models)) {
    const [brand, model] = id.split("|");
    for (const name of [model, ...(m.aliases || [])]) canon.set(`${norm(brand)}|${norm(name)}`, model);
  }
  // Single sizes Tekmetric files under the wrong model: "Brand|Model as typed|SIZE" -> real model.
  const remap = new Map(Object.entries(modelsFile.remap || {}).map(([k, v]) => [k.split("|").map(norm).join("|"), v]));

  const byTire = new Map();
  let skipped = 0;

  function add(line) {
    if (!/^tires?$/i.test(str(line.partType))) return;
    const available = Number(line.available) || 0;
    if (available <= 0) return;
    const details = str(line.details).toLowerCase();
    if (/used|takeoff/.test(details)) return; // used tires aren't listed as new stock
    const size = sizeOf(line.width, line.ratio, line.diameter);
    const brandRaw = str(line.brand);
    if (!size || !brandRaw) { skipped += available; return; }

    const brand = BRANDS[brandRaw.toLowerCase()] || brandRaw;
    const typed = str(line.model);
    const named = canon.get(`${norm(brand)}|${norm(typed)}`) || typed;
    const fixed = remap.get(`${norm(brand)}|${norm(typed)}|${norm(size.key)}`) || remap.get(`${norm(brand)}|${norm(named)}|${norm(size.key)}`);
    const model = fixed ? canon.get(`${norm(brand)}|${norm(fixed)}`) || fixed : named;
    const lt = /\bLT\b/i.test(str(line.tireType)) || /\blt\b/.test(details) || size.lt;
    const id = `${brand}|${model.toLowerCase()}|${size.key}|${lt}`;
    const cur = byTire.get(id) || { brand, model, key: size.key, rim: size.rim, lt, available: 0, costUnits: 0, costTotal: 0, specs: {} };
    cur.available += available;
    const cost = Number(String(line.cost ?? "").replace(/[$,]/g, ""));
    if (cost > 0) { cur.costUnits += available; cur.costTotal += available * cost; }
    // Same tire on several Tekmetric lines: keep the first value found for each spec.
    for (const [k, v] of Object.entries(specsOf(line))) if (v && !cur.specs[k]) cur.specs[k] = v;
    byTire.set(id, cur);
  }

  function finish({ withPrivate = false } = {}) {
    const tires = [...byTire.values()]
      .map(({ available, costUnits, costTotal, ...t }) => ({
        ...t, level: available > LOW_AT ? "in" : "low",
        ...(withPrivate ? { available, cost: costUnits ? Math.round((costTotal / costUnits) * 100) / 100 : null } : {}),
      }))
      .sort((a, b) => a.rim - b.rim || a.key.localeCompare(b.key, "en", { numeric: true }) || a.brand.localeCompare(b.brand));
    return { tires, skipped };
  }

  return { add, finish };
}

// The public spec fields Tekmetric has for a line (most lines only have a few).
// Load Index sometimes holds the speed too ("111T", "94 V").
function specsOf(line) {
  const [, load, speedIn] = str(line.loadIndex).match(/^(\d{2,3}(?:\/\d{2,3})?)\s*([A-Z])?$/i) || [];
  const utqg = [str(line.treadwear), str(line.traction), str(line.temperature)];
  const warranty = Number(str(line.mileageWarranty).replace(/[^\d]/g, ""));
  const range = str(line.loadRange).toUpperCase();
  return {
    partNumber: str(line.partNumber),
    loadIndex: load || "",
    speed: (str(line.speedRating) || speedIn || "").toUpperCase(),
    loadRange: /^(XL|SL|[A-F])$/.test(range) ? range : "",
    utqg: utqg.every(Boolean) ? utqg.join(" ") : "",
    sidewall: str(line.sideWallStyle).toUpperCase(),
    warranty: warranty >= 10000 ? warranty : 0,
    runFlat: line.runFlat === true || /^(yes|true)$/i.test(str(line.runFlat)),
  };
}

// Tekmetric splits the size into Width / Ratio / Diameter. Flotation sizes come
// through as Width "35X" (or "35"), Ratio 12.5. Returns the site's search key.
export function sizeOf(width, ratio, diameter) {
  const w = Number(str(width).replace(/x$/i, ""));
  const r = Number(ratio);
  const d = Number(diameter);
  if (!w || !r || !d || d !== Math.floor(d)) return null;
  if (w < 100) return { key: `${w}X${r.toFixed(2)}R${d}`, rim: d, lt: true };
  return { key: `${w}/${r}R${d}`, rim: d, lt: false };
}
