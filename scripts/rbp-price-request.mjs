/**
 * Builds the RBP Repulsor A/T Plateau price request workbook.
 *
 * A script rather than a hand-made spreadsheet so it can be re-run when RBP
 * adds a size or a distributor comes back with changes — and so the size
 * data has one home instead of being retyped into a new sheet every quarter.
 *
 *   node scripts/rbp-price-request.mjs
 *
 * Sizes, part numbers, load indices and load ranges are transcribed from
 * rbptires.com/tire/repulsor-at-plateau. Verify against the distributor's own
 * catalogue before ordering — a part number typed wrong is a wrong tire on a
 * truck.
 */

import ExcelJS from "exceljs";

/** [size, type, loadIndex, speed, loadRange, partNumber] grouped by rim. */
const SIZES = [
  // 15"
  ["235/75R15",     "P-metric",  "109",     "T", "",         "RBPSMPAT1575010"],
  ["255/70R15",     "P-metric",  "108",     "S", "",         "RBPSMPAT1570010"],
  ["265/70R15",     "P-metric",  "112",     "S", "",         "RBPSMPAT1570020"],
  ["31x10.50R15LT", "Flotation", "109",     "S", "6PR/LRC",  "RBPSMPAT15105010"],
  ["LT235/75R15",   "LT",        "116/113", "R", "10PR/LRE", "RBPSMPAT1575020"],
  // 16"
  ["245/70R16",     "P-metric",  "106",     "S", "",         "RBPSMPAT1670020"],
  ["245/75R16",     "P-metric",  "115",     "T", "",         "RBPSMPAT1675010"],
  ["255/70R16",     "P-metric",  "115",     "T", "",         "RBPSMPAT1670030"],
  ["265/70R16",     "P-metric",  "112",     "T", "",         "RBPSMPAT1670040"],
  ["265/75R16",     "P-metric",  "116",     "T", "",         "RBPSMPAT1675020"],
  ["LT215/85R16",   "LT",        "115/112", "R", "10PR/LRE", "RBPSMPAT1685010"],
  ["LT225/75R16",   "LT",        "115/112", "S", "10PR/LRE", "RBPSMPAT1675030"],
  ["LT235/85R16",   "LT",        "120/116", "S", "10PR/LRE", "RBPSMPAT1685020"],
  ["LT245/75R16",   "LT",        "120/116", "S", "10PR/LRE", "RBPSMPAT1675040"],
  ["LT265/70R16",   "LT",        "117/114", "S", "8PR/LRD",  "RBPSMPAT1670050"],
  ["LT265/75R16",   "LT",        "123/120", "S", "10PR/LRE", "RBPSMPAT1675050"],
  ["LT285/75R16",   "LT",        "126/123", "R", "10PR/LRE", "RBPSMPAT1675060"],
  ["LT315/75R16",   "LT",        "127/124", "R", "10PR/LRE", "RBPSMPAT1675070"],
  // 17"
  ["235/75R17",     "P-metric",  "109",     "T", "",         "RBPSMPAT1775010"],
  ["245/65R17",     "P-metric",  "111",     "T", "",         "RBPSMPAT1765030"],
  ["245/70R17",     "P-metric",  "114",     "T", "",         "RBPSMPAT1770010"],
  ["255/65R17",     "P-metric",  "114",     "T", "",         "RBPSMPAT1765040"],
  ["255/70R17",     "P-metric",  "112",     "T", "",         "RBPSMPAT1770020"],
  ["265/65R17",     "P-metric",  "116",     "T", "",         "RBPSMPAT1765050"],
  ["265/70R17",     "P-metric",  "115",     "T", "",         "RBPSMPAT1770030"],
  ["285/70R17",     "P-metric",  "117",     "T", "",         "RBPSMPAT1770040"],
  ["LT235/70R17",   "LT",        "120/117", "R", "10PR/LRE", "RBPSMPAT1770050"],
  ["LT235/80R17",   "LT",        "120/117", "R", "10PR/LRE", "RBPSMPAT1780010"],
  ["LT245/70R17",   "LT",        "119/116", "S", "10PR/LRE", "RBPSMPAT1770060"],
  ["LT245/75R17",   "LT",        "121/118", "S", "10PR/LRE", "RBPSMPAT1775020"],
  ["LT255/75R17",   "LT",        "111/108", "S", "6PR/LRC",  "RBPSMPAT1775030"],
  ["LT255/80R17",   "LT",        "123/120", "S", "10PR/LRE", "RBPSMPAT1780020"],
  ["LT265/70R17",   "LT",        "123/120", "S", "10PR/LRE", "RBPSMPAT1770070"],
  ["LT285/70R17",   "LT",        "126/123", "S", "10PR/LRE", "RBPSMPAT1770080"],
  // 18"
  ["245/60R18",     "P-metric",  "105",     "H", "",         "RBPSMPAT1860010"],
  ["255/70R18",     "P-metric",  "113",     "T", "",         "RBPSMPAT1870010"],
  ["265/60R18",     "P-metric",  "114",     "T", "",         "RBPSMPAT1860020"],
  ["265/65R18",     "P-metric",  "114",     "T", "",         "RBPSMPAT1865010"],
  ["265/70R18",     "P-metric",  "116",     "T", "",         "RBPSMPAT1870020"],
  ["275/65R18",     "P-metric",  "116",     "T", "",         "RBPSMPAT1865020"],
  ["LT265/65R18",   "LT",        "122/119", "R", "10PR/LRE", "RBPSMPAT1865030"],
  ["LT265/70R18",   "LT",        "124/121", "S", "10PR/LRE", "RBPSMPAT1870030"],
  ["LT275/65R18",   "LT",        "123/120", "S", "10PR/LRE", "RBPSMPAT1865040"],
  ["LT275/70R18",   "LT",        "125/122", "S", "10PR/LRE", "RBPSMPAT1870040"],
  ["LT285/65R18",   "LT",        "125/122", "S", "10PR/LRE", "RBPSMPAT1865050"],
  ["LT295/70R18",   "LT",        "129/126", "R", "10PR/LRE", "RBPSMPAT1870050"],
  ["LT305/65R18",   "LT",        "128/125", "R", "12PR/LRF", "RBPSMPAT1865060"],
  ["LT325/65R18",   "LT",        "121/118", "T", "8PR/LRD",  "RBPSMPAT1865070"],
  // 20"
  ["265/50R20",     "P-metric",  "111",     "H", "",         "RBPSMPAT2050010"],
  ["275/55R20",     "P-metric",  "117",     "T", "",         "RBPSMPAT2055010"],
  ["275/60R20",     "P-metric",  "115",     "T", "",         "RBPSMPAT2060010"],
  ["285/55R20",     "P-metric",  "114",     "T", "",         "RBPSMPAT2055020"],
  ["35x12.50R20LT", "Flotation", "125",     "R", "12PR/LRF", "RBPSMPAT20125010"],
  ["LT265/60R20",   "LT",        "121/118", "S", "10PR/LRE", "RBPSMPAT2060020"],
  ["LT275/65R20",   "LT",        "126/123", "S", "10PR/LRE", "RBPSMPAT2065010"],
  ["LT285/60R20",   "LT",        "125/122", "R", "10PR/LRE", "RBPSMPAT2060030"],
  // 22" and 24"
  ["285/45R22",     "P-metric",  "114",     "T", "",         "RBPSMPAT2245010"],
  ["305/35R24",     "P-metric",  "112",     "H", "",         "RBPSMPAT2435010"],
];

/** Rim diameter out of the size string, for grouping and sorting. */
function rimOf(size) {
  const m = size.match(/R(\d{2}(?:\.\d)?)/);
  return m ? Number(m[1]) : 0;
}

const INK = "FF0B0D0F";
const ACCENT = "FF0071C5";
const FILLED = "FFF4F6F8";   // columns we have filled in
const BLANK = "FFFFF8E1";    // columns the distributor fills — visibly theirs

const wb = new ExcelJS.Workbook();
wb.creator = "The Tire Plug";
wb.created = new Date();

/* ------------------------------------------------------------------ *
 * Sheet 1 — the request itself
 * ------------------------------------------------------------------ */
const ws = wb.addWorksheet("RBP Repulsor A-T", {
  views: [{ state: "frozen", ySplit: 6 }],
  pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
});

ws.columns = [
  { key: "priority", width: 9 },
  { key: "rim", width: 6 },
  { key: "size", width: 17 },
  { key: "type", width: 11 },
  { key: "load", width: 10 },
  { key: "speed", width: 7 },
  { key: "range", width: 11 },
  { key: "part", width: 20 },
  { key: "cost", width: 12 },
  { key: "cost4", width: 13 },
  { key: "map", width: 12 },
  { key: "stock", width: 10 },
  { key: "lead", width: 12 },
  { key: "valid", width: 15 },
];

ws.mergeCells("A1:N1");
ws.getCell("A1").value = "THE TIRE PLUG — RBP REPULSOR A/T PLATEAU PRICE REQUEST";
ws.getCell("A1").font = { bold: true, size: 14, color: { argb: INK } };
ws.getRow(1).height = 22;

ws.mergeCells("A2:N2");
ws.getCell("A2").value =
  "W Olympic Blvd, Los Angeles CA  ·  (562) 500-4625  ·  tireplugla.com";
ws.getCell("A2").font = { size: 10, color: { argb: "FF5B6770" } };

ws.mergeCells("A3:N3");
ws.getCell("A3").value =
  "Please complete the shaded columns (I–N). We are building a public RBP " +
  "catalogue with published pricing, so we need cost held firm and four " +
  "weeks' written notice of any change. See accompanying letter.";
ws.getCell("A3").font = { size: 10, italic: true, color: { argb: "FF5B6770" } };
ws.getRow(3).height = 28;
ws.getCell("A3").alignment = { wrapText: true, vertical: "top" };

ws.mergeCells("A4:N4");
ws.getCell("A4").value =
  "Priority: mark A for sizes to quote first. Blank rows may be left unquoted.";
ws.getCell("A4").font = { size: 10, color: { argb: ACCENT } };

// Row 6 is the header; row 5 stays empty as a gutter.
const head = ws.getRow(6);
head.values = [
  "Priority", "Rim", "Size", "Type", "Load idx", "Speed", "Load range",
  "RBP part #",
  "Your cost ea", "Cost ea @ 4+", "MAP / min adv", "In stock", "Lead time",
  "Price valid to",
];
head.height = 30;
head.eachCell((cell, col) => {
  cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    // The distributor's columns are a different colour in the header too, so
    // it is obvious at a glance which half of the sheet is theirs.
    fgColor: { argb: col >= 9 ? ACCENT : INK },
  };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
});

const sorted = [...SIZES].sort(
  (a, b) => rimOf(a[0]) - rimOf(b[0]) || a[0].localeCompare(b[0]),
);

let lastRim = null;
for (const [size, type, load, speed, range, part] of sorted) {
  const rim = rimOf(size);
  const row = ws.addRow({
    priority: "",
    rim: `${rim}"`,
    size,
    type,
    load,
    speed,
    range: range || "—",
    part,
    cost: "",
    cost4: "",
    map: "",
    stock: "",
    lead: "",
    valid: "",
  });

  row.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.border = {
      top: { style: "hair", color: { argb: "FFD8DEE4" } },
      bottom: { style: "hair", color: { argb: "FFD8DEE4" } },
      left: { style: "hair", color: { argb: "FFD8DEE4" } },
      right: { style: "hair", color: { argb: "FFD8DEE4" } },
    };
    cell.font = { size: 10 };
    if (col >= 9) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLANK } };
    } else if (col === 1) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLANK } };
    } else {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILLED } };
    }
  });

  // A heavier line where the rim size changes, so the eye finds its group.
  if (lastRim !== null && rim !== lastRim) {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        ...cell.border,
        top: { style: "thin", color: { argb: "FF8A959D" } },
      };
    });
  }
  lastRim = rim;

  // Money columns formatted as money even while empty, so what is wanted is
  // unambiguous and a typed "129" does not come back as text.
  ["I", "J", "K"].forEach((c) => {
    ws.getCell(`${c}${row.number}`).numFmt = '"$"#,##0.00';
  });
  ws.getCell(`N${row.number}`).numFmt = "mm/dd/yyyy";
  ws.getCell(`C${row.number}`).font = { size: 10, bold: true };
}

ws.autoFilter = { from: "A6", to: `N${5 + sorted.length}` };

/* ------------------------------------------------------------------ *
 * Sheet 2 — the terms, because a sheet gets separated from its letter
 * ------------------------------------------------------------------ */
const terms = wb.addWorksheet("Terms requested");
terms.columns = [{ width: 4 }, { width: 96 }];

const lines = [
  ["h", "WHAT WE ARE ASKING FOR"],
  ["p", ""],
  ["n", "Firm pricing. Cost per size held for a defined period, not quoted per order."],
  ["n", "Four weeks' written notice before any increase takes effect, so we can " +
        "either honour published prices through the notice period or update them " +
        "before a customer is affected."],
  ["n", "Written confirmation of the period each quoted price is valid through " +
        "(column N)."],
  ["n", "Stock position and lead time per size, so the website only offers what " +
        "can actually be delivered."],
  ["p", ""],
  ["h", "WHY IT MATTERS ON OUR SIDE"],
  ["p", ""],
  ["p", "We are publishing RBP pricing openly on tireplugla.com and taking " +
        "bookings with a deposit against a named price. Once a customer has paid " +
        "a deposit against a published number, that is the price we owe them. A " +
        "cost change without notice is absorbed by us or broken faith with the " +
        "customer, and neither builds the brand."],
  ["p", ""],
  ["h", "WHAT WE COMMIT TO IN RETURN"],
  ["p", ""],
  ["n", "RBP shown as a lead brand, by name, on our public catalogue rather than " +
        "buried in a list."],
  ["n", "Consolidated ordering through one distributor rather than shopped per job."],
  ["n", "Warranty registration handled at our counter, so RBP's coverage is " +
        "actually claimable and the brand gets credit for it."],
  ["n", "Forecast visibility as the catalogue produces booked, deposit-backed " +
        "orders."],
];

let r = 2;
for (const [kind, text] of lines) {
  const cell = terms.getCell(`B${r}`);
  if (kind === "h") {
    cell.value = text;
    cell.font = { bold: true, size: 11, color: { argb: ACCENT } };
  } else if (kind === "n") {
    terms.getCell(`A${r}`).value = "•";
    terms.getCell(`A${r}`).alignment = { horizontal: "right", vertical: "top" };
    cell.value = text;
    cell.font = { size: 11 };
    cell.alignment = { wrapText: true, vertical: "top" };
    terms.getRow(r).height = Math.max(16, Math.ceil(text.length / 90) * 15);
  } else {
    cell.value = text;
    cell.font = { size: 11 };
    cell.alignment = { wrapText: true, vertical: "top" };
    if (text) terms.getRow(r).height = Math.ceil(text.length / 90) * 15;
  }
  r += 1;
}

const out = "RBP-Repulsor-AT-price-request.xlsx";
await wb.xlsx.writeFile(out);
console.log(`${out} — ${sorted.length} sizes`);
