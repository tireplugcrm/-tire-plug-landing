/**
 * The catalog pricing sheet.
 *
 *   node scripts/rbp-catalog-pricing.mjs
 *
 * The distributor sheet asks THEM for cost. This one is for Alex: put your
 * cost and your retail against each size, and it shows both numbers that
 * matter — what goes on the website, and what the shop keeps.
 *
 * Every formula here mirrors otd_breakdown() in the TireLaunch schema, which
 * is the authority on money. In particular:
 *
 *   TAX IS ON THE TIRES ONLY. Not the subtotal. Installation and alignment
 *   are labour and labour is not taxable in California, so a sheet that taxes
 *   the whole ticket over-charges by about $16 on a $1,400 set and puts a
 *   wrong number on a public website.
 *
 *   THE TIRE FEE IS NEVER TAXED AND IS NEVER REVENUE. $2.00 collected, $1.75
 *   remitted, $0.25 kept.
 *
 * Live Excel formulas, not baked values — change a cost or the shop settings
 * and every out-the-door price moves with it.
 */

import ExcelJS from "exceljs";

/** [size, type, loadIndex, speed, loadRange, part] — same source as the RFQ. */
const SIZES = [
  ["235/75R15","P-metric","109","T","","RBPSMPAT1575010"],
  ["255/70R15","P-metric","108","S","","RBPSMPAT1570010"],
  ["265/70R15","P-metric","112","S","","RBPSMPAT1570020"],
  ["31x10.50R15LT","Flotation","109","S","6PR/LRC","RBPSMPAT15105010"],
  ["LT235/75R15","LT","116/113","R","10PR/LRE","RBPSMPAT1575020"],
  ["245/70R16","P-metric","106","S","","RBPSMPAT1670020"],
  ["245/75R16","P-metric","115","T","","RBPSMPAT1675010"],
  ["255/70R16","P-metric","115","T","","RBPSMPAT1670030"],
  ["265/70R16","P-metric","112","T","","RBPSMPAT1670040"],
  ["265/75R16","P-metric","116","T","","RBPSMPAT1675020"],
  ["LT215/85R16","LT","115/112","R","10PR/LRE","RBPSMPAT1685010"],
  ["LT225/75R16","LT","115/112","S","10PR/LRE","RBPSMPAT1675030"],
  ["LT235/85R16","LT","120/116","S","10PR/LRE","RBPSMPAT1685020"],
  ["LT245/75R16","LT","120/116","S","10PR/LRE","RBPSMPAT1675040"],
  ["LT265/70R16","LT","117/114","S","8PR/LRD","RBPSMPAT1670050"],
  ["LT265/75R16","LT","123/120","S","10PR/LRE","RBPSMPAT1675050"],
  ["LT285/75R16","LT","126/123","R","10PR/LRE","RBPSMPAT1675060"],
  ["LT315/75R16","LT","127/124","R","10PR/LRE","RBPSMPAT1675070"],
  ["235/75R17","P-metric","109","T","","RBPSMPAT1775010"],
  ["245/65R17","P-metric","111","T","","RBPSMPAT1765030"],
  ["245/70R17","P-metric","114","T","","RBPSMPAT1770010"],
  ["255/65R17","P-metric","114","T","","RBPSMPAT1765040"],
  ["255/70R17","P-metric","112","T","","RBPSMPAT1770020"],
  ["265/65R17","P-metric","116","T","","RBPSMPAT1765050"],
  ["265/70R17","P-metric","115","T","","RBPSMPAT1770030"],
  ["285/70R17","P-metric","117","T","","RBPSMPAT1770040"],
  ["LT235/70R17","LT","120/117","R","10PR/LRE","RBPSMPAT1770050"],
  ["LT235/80R17","LT","120/117","R","10PR/LRE","RBPSMPAT1780010"],
  ["LT245/70R17","LT","119/116","S","10PR/LRE","RBPSMPAT1770060"],
  ["LT245/75R17","LT","121/118","S","10PR/LRE","RBPSMPAT1775020"],
  ["LT255/75R17","LT","111/108","S","6PR/LRC","RBPSMPAT1775030"],
  ["LT255/80R17","LT","123/120","S","10PR/LRE","RBPSMPAT1780020"],
  ["LT265/70R17","LT","123/120","S","10PR/LRE","RBPSMPAT1770070"],
  ["LT285/70R17","LT","126/123","S","10PR/LRE","RBPSMPAT1770080"],
  ["245/60R18","P-metric","105","H","","RBPSMPAT1860010"],
  ["255/70R18","P-metric","113","T","","RBPSMPAT1870010"],
  ["265/60R18","P-metric","114","T","","RBPSMPAT1860020"],
  ["265/65R18","P-metric","114","T","","RBPSMPAT1865010"],
  ["265/70R18","P-metric","116","T","","RBPSMPAT1870020"],
  ["275/65R18","P-metric","116","T","","RBPSMPAT1865020"],
  ["LT265/65R18","LT","122/119","R","10PR/LRE","RBPSMPAT1865030"],
  ["LT265/70R18","LT","124/121","S","10PR/LRE","RBPSMPAT1870030"],
  ["LT275/65R18","LT","123/120","S","10PR/LRE","RBPSMPAT1865040"],
  ["LT275/70R18","LT","125/122","S","10PR/LRE","RBPSMPAT1870040"],
  ["LT285/65R18","LT","125/122","S","10PR/LRE","RBPSMPAT1865050"],
  ["LT295/70R18","LT","129/126","R","10PR/LRE","RBPSMPAT1870050"],
  ["LT305/65R18","LT","128/125","R","12PR/LRF","RBPSMPAT1865060"],
  ["LT325/65R18","LT","121/118","T","8PR/LRD","RBPSMPAT1865070"],
  ["265/50R20","P-metric","111","H","","RBPSMPAT2050010"],
  ["275/55R20","P-metric","117","T","","RBPSMPAT2055010"],
  ["275/60R20","P-metric","115","T","","RBPSMPAT2060010"],
  ["285/55R20","P-metric","114","T","","RBPSMPAT2055020"],
  ["35x12.50R20LT","Flotation","125","R","12PR/LRF","RBPSMPAT20125010"],
  ["LT265/60R20","LT","121/118","S","10PR/LRE","RBPSMPAT2060020"],
  ["LT275/65R20","LT","126/123","S","10PR/LRE","RBPSMPAT2065010"],
  ["LT285/60R20","LT","125/122","R","10PR/LRE","RBPSMPAT2060030"],
  ["285/45R22","P-metric","114","T","","RBPSMPAT2245010"],
  ["305/35R24","P-metric","112","H","","RBPSMPAT2435010"],
];

const rimOf = (s) => { const m = s.match(/R(\d{2}(?:\.\d)?)/); return m ? Number(m[1]) : 0; };

const INK = "FF0A0A0A";
const AMBER = "FFFFB300";
const CONCRETE = "FFEFEDE7";
const YOURS = "FFFFF8E1";   // cells Alex fills
const CALC = "FFF3F7FB";    // cells the sheet computes

const wb = new ExcelJS.Workbook();
wb.creator = "The Tire Plug";

/* ------------------------------------------------------------------ *
 * Settings — one place, referenced by every formula below.
 * ------------------------------------------------------------------ */
const cfg = wb.addWorksheet("Shop settings");
cfg.columns = [{ width: 34 }, { width: 14 }, { width: 62 }];

const settings = [
  ["Tires per set", 4, "The catalog quotes a set. Two tires get quoted at the counter."],
  ["Install & balance, per tire", 25.00, "Labour. NEVER taxed in California."],
  ["Alignment, bundled per set", 60.00, "Your 4+ tier. Labour, so also never taxed. Pure profit — no cost of goods."],
  ["Sales tax rate %", 10.000, "Olympic. Per address — Culver City is 10.25%, county 9.5%."],
  ["Tire fee charged, per tire", 2.00, "Never taxed, never revenue."],
  ["Tire fee remitted, per tire", 1.75, "Owed to CDTFA. You keep the difference."],
  ["Default markup on cost", 1.45, "Only used to suggest a retail price. Override any row."],
];

cfg.getCell("A1").value = "SHOP SETTINGS";
cfg.getCell("A1").font = { bold: true, size: 14, color: { argb: INK } };
cfg.getCell("A2").value = "Change a number here and every price on the Catalog sheet moves with it.";
cfg.getCell("A2").font = { size: 10, italic: true, color: { argb: "FF6E7681" } };

cfg.getRow(4).values = ["Setting", "Value", "Why it matters"];
cfg.getRow(4).eachCell((c) => {
  c.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
});

settings.forEach(([label, value, why], i) => {
  const r = cfg.getRow(5 + i);
  r.values = [label, value, why];
  r.getCell(1).font = { bold: true, size: 10 };
  r.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: YOURS } };
  r.getCell(2).numFmt = label.includes("%") ? "0.000" : (label.includes("markup") ? "0.00" : '"$"#,##0.00');
  r.getCell(2).font = { bold: true, size: 11 };
  r.getCell(3).font = { size: 9, color: { argb: "FF6E7681" } };
  r.getCell(3).alignment = { wrapText: true, vertical: "top" };
});

// Named cells, so the catalog formulas read like sentences.
const QTY = "'Shop settings'!$B$5";
const INSTALL = "'Shop settings'!$B$6";
const ALIGN = "'Shop settings'!$B$7";
const TAXPC = "'Shop settings'!$B$8";
const FEE = "'Shop settings'!$B$9";
const REMIT = "'Shop settings'!$B$10";
const MARKUP = "'Shop settings'!$B$11";

/* ------------------------------------------------------------------ *
 * Catalog — fill cost, get the website number and the margin
 * ------------------------------------------------------------------ */
const ws = wb.addWorksheet("Catalog", {
  views: [{ state: "frozen", ySplit: 6, xSplit: 2 }],
  pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
});

ws.columns = [
  { key: "rim", width: 6 },
  { key: "size", width: 16 },
  { key: "type", width: 10 },
  { key: "load", width: 9 },
  { key: "range", width: 10 },
  { key: "cost", width: 11 },
  { key: "retail", width: 11 },
  { key: "tires", width: 11 },
  { key: "install", width: 10 },
  { key: "align", width: 10 },
  { key: "tax", width: 10 },
  { key: "fee", width: 8 },
  { key: "otd", width: 13 },
  { key: "profit", width: 12 },
  { key: "margin", width: 9 },
  { key: "part", width: 19 },
];

ws.mergeCells("A1:P1");
ws.getCell("A1").value = "THE TIRE PLUG — RBP REPULSOR A/T CATALOG PRICING";
ws.getCell("A1").font = { bold: true, size: 14, color: { argb: INK } };

ws.mergeCells("A2:P2");
ws.getCell("A2").value =
  "Fill the cream column (F, your cost each). Everything else calculates. " +
  "Column G suggests a retail price from your markup — type over it whenever " +
  "you want a different number on a given size.";
ws.getCell("A2").font = { size: 10, italic: true, color: { argb: "FF6E7681" } };

ws.mergeCells("A3:P3");
ws.getCell("A3").value =
  "TAX IS ON THE TIRES ONLY. Install and alignment are labour and labour is " +
  "not taxable in California. Taxing the whole ticket would over-charge about " +
  "$16 on a $1,400 set — and it would be a wrong number on a public website.";
ws.getCell("A3").font = { size: 10, bold: true, color: { argb: "FFB25E00" } };
ws.getRow(3).height = 26;
ws.getCell("A3").alignment = { wrapText: true, vertical: "top" };

ws.mergeCells("A4:P4");
ws.getCell("A4").value = "OUT THE DOOR is per SET OF 4, fitted, aligned, taxed, fee paid. That is the number that goes on the website.";
ws.getCell("A4").font = { size: 10, bold: true, color: { argb: INK } };

const head = ws.getRow(6);
head.values = [
  "Rim", "Size", "Type", "Load", "Range",
  "Your cost ea", "Retail ea",
  "Tires", "Install", "Align", "Tax", "Fee",
  "OUT THE DOOR", "Profit / set", "Margin", "RBP part #",
];
head.height = 30;
head.eachCell((cell, col) => {
  const yours = col === 6 || col === 7;
  const money = col === 13;
  cell.font = {
    bold: true, size: 9,
    color: { argb: money ? "FF0A0A0A" : "FFFFFFFF" },
  };
  cell.fill = {
    type: "pattern", pattern: "solid",
    fgColor: { argb: money ? AMBER : yours ? "FFB25E00" : INK },
  };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
});

const sorted = [...SIZES].sort((a, b) => rimOf(a[0]) - rimOf(b[0]) || a[0].localeCompare(b[0]));

sorted.forEach(([size, type, load, speed, range, part], i) => {
  const n = 7 + i;
  const row = ws.getRow(n);

  row.getCell(1).value = `${rimOf(size)}"`;
  row.getCell(2).value = size;
  row.getCell(3).value = type;
  row.getCell(4).value = `${load}${speed}`;
  row.getCell(5).value = range || "—";
  row.getCell(6).value = null;                                   // Alex fills
  row.getCell(7).value = { formula: `IF(F${n}="","",ROUND(F${n}*${MARKUP},0))` };

  // Everything below mirrors otd_breakdown().
  row.getCell(8).value  = { formula: `IF(G${n}="","",G${n}*${QTY})` };
  row.getCell(9).value  = { formula: `IF(G${n}="","",${INSTALL}*${QTY})` };
  row.getCell(10).value = { formula: `IF(G${n}="","",${ALIGN})` };
  // Tax on the tires alone — H, never the subtotal.
  row.getCell(11).value = { formula: `IF(G${n}="","",ROUND(H${n}*${TAXPC}/100,2))` };
  row.getCell(12).value = { formula: `IF(G${n}="","",${FEE}*${QTY})` };
  row.getCell(13).value = { formula: `IF(G${n}="","",H${n}+I${n}+J${n}+K${n}+L${n})` };
  // Profit: revenue less what the tires cost and less the fee owed to the
  // state. Tax was never the shop's money; labour carries no COGS.
  row.getCell(14).value = { formula: `IF(F${n}="","",H${n}+I${n}+J${n}-(F${n}*${QTY})-(${REMIT}*${QTY}))` };
  row.getCell(15).value = { formula: `IF(OR(F${n}="",H${n}+I${n}+J${n}=0),"",N${n}/(H${n}+I${n}+J${n}))` };
  row.getCell(16).value = part;

  row.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.font = { size: 10 };
    cell.border = {
      top: { style: "hair", color: { argb: "FFD9D5CC" } },
      bottom: { style: "hair", color: { argb: "FFD9D5CC" } },
      left: { style: "hair", color: { argb: "FFD9D5CC" } },
      right: { style: "hair", color: { argb: "FFD9D5CC" } },
    };
    if (col === 6 || col === 7) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YOURS } };
    } else if (col === 13) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER } };
      cell.font = { size: 11, bold: true };
    } else if (col >= 8 && col <= 15) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CALC } };
    } else {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CONCRETE } };
    }
  });

  row.getCell(2).font = { size: 10, bold: true };
  [6, 7, 8, 9, 10, 11, 12, 13, 14].forEach((c) => {
    ws.getCell(n, c).numFmt = '"$"#,##0.00';
  });
  ws.getCell(n, 15).numFmt = "0.0%";
});

ws.autoFilter = { from: "A6", to: `P${6 + sorted.length}` };

/* ------------------------------------------------------------------ *
 * A worked example, so the maths can be checked by hand
 * ------------------------------------------------------------------ */
const ex = wb.addWorksheet("Worked example");
ex.columns = [{ width: 32 }, { width: 14 }, { width: 54 }];

ex.getCell("A1").value = "CHECK THE MATHS BY HAND";
ex.getCell("A1").font = { bold: true, size: 14, color: { argb: INK } };
ex.getCell("A2").value =
  "One size, worked through. If the Catalog sheet ever disagrees with this, the sheet is wrong.";
ex.getCell("A2").font = { size: 10, italic: true, color: { argb: "FF6E7681" } };

const example = [
  ["LT285/70R17 — cost $174 each", "", ""],
  ["", "", ""],
  ["Retail each (cost × 1.45)", 252.00, "Rounded to a whole dollar"],
  ["Tires ×4", 1008.00, "TAXABLE"],
  ["Install & balance ×4", 100.00, "Labour — not taxed"],
  ["Alignment", 60.00, "Labour — not taxed. No cost of goods."],
  ["Tax @ 10% of $1,008", 100.80, "Of the TIRES, not of $1,168"],
  ["CA tire fee ×4", 8.00, "Never taxed, never revenue"],
  ["OUT THE DOOR", 1276.80, "The number on the website"],
  ["", "", ""],
  ["Tire cost ×4", -696.00, ""],
  ["Fee owed to the state ×4", -7.00, "$1.75 each"],
  ["Shop keeps", 465.00, "1008 + 100 + 60 − 696 − 7"],
  ["Margin on revenue", 0.398, "Of $1,168 — tax and fee were never yours"],
];

example.forEach(([label, value, note], i) => {
  const r = ex.getRow(4 + i);
  r.getCell(1).value = label;
  if (value !== "") r.getCell(2).value = value;
  r.getCell(3).value = note;
  const strong = label === "OUT THE DOOR" || label === "Shop keeps";
  r.getCell(1).font = { size: 11, bold: strong || i === 0 };
  r.getCell(2).font = { size: 11, bold: strong };
  r.getCell(2).numFmt = label.startsWith("Margin") ? "0.0%" : '"$"#,##0.00';
  r.getCell(3).font = { size: 9, color: { argb: "FF6E7681" } };
  if (label === "OUT THE DOOR") {
    r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER } };
    r.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER } };
  }
});

ex.getCell("A20").value = "IS BUNDLING THE ALIGNMENT WORTH IT?";
ex.getCell("A20").font = { bold: true, size: 12, color: { argb: INK } };
[
  "Alignment is $60 of pure labour — no cost of goods, so all of it is profit.",
  "Bundled, every set gives it away: about 13% of the $465 the shop keeps.",
  "Unbundled, the set is $1,216.80 out the door and alignment is sold separately.",
  "The trade is a bigger, simpler, more convincing number against ~$60 a set.",
  "At four sets a week that is roughly $12,500 a year. Worth deciding on purpose.",
].forEach((t, i) => {
  const c = ex.getCell(`A${21 + i}`);
  c.value = "• " + t;
  c.font = { size: 10 };
  ex.getRow(21 + i).height = 15;
});

const out = "RBP-catalog-pricing.xlsx";
await wb.xlsx.writeFile(out);
console.log(`${out} — ${sorted.length} sizes, live formulas`);
