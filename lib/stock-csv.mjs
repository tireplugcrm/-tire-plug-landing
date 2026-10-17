/**
 * Tekmetric inventory CSV (Inventory -> Download CSV) -> lines for lib/tire-stock.mjs.
 * Shared by scripts/inventory-snapshot.mjs and the admin stock upload (/api/admin/pricing).
 * Lines carry cost; lib/tire-stock.mjs keeps it out of anything public.
 */

const NEED = ["Brand", "Part Type", "Available", "Tire Model", "Width", "Ratio", "Diameter"];

export function linesFromCsv(text) {
  const rows = parseCsv(String(text).replace(/^﻿/, ""));
  const head = (rows.shift() || []).map((h) => h.trim());
  for (const need of NEED) {
    if (!head.includes(need)) throw new Error(`Not a Tekmetric inventory CSV: no "${need}" column`);
  }
  const col = (r, name) => (r[head.indexOf(name)] ?? "").trim();
  return rows.map((r) => ({
    partType: col(r, "Part Type"), available: col(r, "Available"), details: col(r, "Additional Details"),
    width: col(r, "Width"), ratio: col(r, "Ratio"), diameter: col(r, "Diameter"),
    brand: col(r, "Brand"), model: col(r, "Tire Model"), tireType: col(r, "Tire Type"), partNumber: col(r, "Part Number"),
    loadIndex: col(r, "Load Index"), speedRating: col(r, "Speed Rating"), loadRange: col(r, "Load Range"),
    treadwear: col(r, "Treadwear"), traction: col(r, "Traction"), temperature: col(r, "Temperature"),
    mileageWarranty: col(r, "Mileage Warranty"), sideWallStyle: col(r, "Side Wall Style"), runFlat: col(r, "Run Flat"),
    cost: col(r, "Cost"),
  }));
}

// Minimal RFC 4180 parser: quoted fields, doubled quotes, commas and newlines inside quotes.
export function parseCsv(text) {
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
