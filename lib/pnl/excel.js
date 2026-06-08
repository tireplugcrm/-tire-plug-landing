/**
 * Build the cumulative weekly P&L workbook: Sheet 1 = weekly summary, then one
 * sheet per day. Mirrors the owner's spec columns and applies the flag colors.
 */
import ExcelJS from "exceljs";

const MONEY = '"$"#,##0.00';
const FILL = {
  refund: "FFEDE0FF",   // ↩️
  unmatched: "FFFFD6D6",// ⚠️
  negative: "FFFFCDD2", // 🟥
  low: "FFFFF9C4",      // 🟨
  high: "FFC8E6C9",     // 🟩
  missing: "FFFFE0B2",  // 🟧
  pickup: "FFE1F5FE",   // 📦
};
const FLAG_EMOJI = { refund: "↩️", unmatched: "⚠️", negative: "🟥", low: "🟨", high: "🟩", pickup: "📦", missing: "🟧" };

function rowFill(flags) {
  for (const f of ["refund", "unmatched", "missing", "negative", "low", "high", "pickup"]) if (flags.includes(f)) return FILL[f];
  return null;
}
function dayLabel(date) {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A1A" } }; c.alignment = { vertical: "middle" }; });
}

function addDaySheet(wb, day) {
  const ws = wb.addWorksheet(dayLabel(day.date));
  ws.columns = [
    { header: "INV #", key: "inv", width: 11 },
    { header: "SALES REP", key: "rep", width: 18 },
    { header: "CUSTOMER", key: "cust", width: 20 },
    { header: "DESCRIPTION", key: "desc", width: 40 },
    { header: "TIRE QTY", key: "qty", width: 9 },
    { header: "TIRE COST", key: "tireC", width: 12 },
    { header: "TPMS QTY", key: "tpmsQ", width: 9 },
    { header: "TPMS COST", key: "tpmsC", width: 12 },
    { header: "OIL QTY", key: "oilQ", width: 9 },
    { header: "OIL COST", key: "oilC", width: 11 },
    { header: "TOTAL COST", key: "tcost", width: 12 },
    { header: "RETAIL", key: "retail", width: 12 },
    { header: "TAX", key: "tax", width: 10 },
    { header: "TOTAL PROFIT", key: "profit", width: 13 },
    { header: "COMMISSION", key: "comm", width: 12 },
    { header: "FLAGS", key: "flags", width: 12 },
  ];
  styleHeader(ws.getRow(1));
  for (const r of day.rows) {
    const row = ws.addRow({
      inv: r.inv_no, rep: r.rep, cust: r.customer, desc: r.description, qty: r.tireQty || "",
      tireC: r.tireCost, tpmsQ: r.tpmsQty || "", tpmsC: r.tpmsCost || "", oilQ: r.oilQty || "", oilC: r.oilCost || "", tcost: r.totalCost, retail: r.retail, tax: r.tax,
      profit: r.totalProfit, comm: r.commission || "",
      flags: r.flags.map((f) => FLAG_EMOJI[f]).join(" "),
    });
    ["tireC", "tpmsC", "oilC", "tcost", "retail", "tax", "profit", "comm"].forEach((k) => { row.getCell(k).numFmt = MONEY; });
    const fill = rowFill(r.flags);
    if (fill) row.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } }; });
  }
  // Totals
  const t = ws.addRow({
    inv: "TOTALS", qty: day.tireQty,
    tireC: day.tireCost, tpmsQ: day.tpmsQty || "", tpmsC: day.tpmsCost, oilQ: day.oilQty || "", oilC: day.oilCost, tcost: day.cogs,
    retail: day.revenue, tax: day.tax, profit: day.grossProfit, comm: day.commissions,
  });
  t.font = { bold: true };
  ["tireC", "tpmsC", "oilC", "tcost", "retail", "tax", "profit", "comm"].forEach((k) => { t.getCell(k).numFmt = MONEY; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return ws;
}

function addSummarySheet(wb, week) {
  const ws = wb.addWorksheet("Weekly P&L");
  ws.mergeCells("A1:G1");
  ws.getCell("A1").value = `The Tire Plug — Weekly P&L (${week.dates[0]} to ${week.dates[6]})`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.addRow([]);

  const head = ws.addRow(["DAY", "INVOICES", "REVENUE", "COGS", "GROSS PROFIT", "COMMISSIONS"]);
  styleHeader(head);
  week.days.forEach((d) => {
    const row = ws.addRow([dayLabel(d.date), d.invoices, d.revenue, d.cogs, d.grossProfit, d.commissions]);
    [3, 4, 5, 6].forEach((c) => { row.getCell(c).numFmt = MONEY; });
  });
  const s = week.summary;
  const tot = ws.addRow(["TOTAL", week.days.reduce((a, d) => a + d.invoices, 0), s.revenue, s.cogs, s.grossProfit, s.commissions]);
  tot.font = { bold: true };
  [3, 4, 5, 6].forEach((c) => { tot.getCell(c).numFmt = MONEY; });

  ws.addRow([]);
  const put = (label, val, money = true) => { const r = ws.addRow([label, val]); r.getCell(1).font = { bold: true }; if (money) r.getCell(2).numFmt = MONEY; return r; };
  put("Gross Profit", s.grossProfit);
  put("− Rent (week)", s.rent);
  put("− Commissions", s.commissions);
  put("= NET PROFIT", s.net).getCell(1).font = { bold: true, color: { argb: s.net < 0 ? "FFC62828" : "FF2E7D32" } };

  ws.addRow([]);
  ws.addRow(["PARTNER SPLIT (50/50 on Gross Profit; rent & commissions settle separately)"]).getCell(1).font = { bold: true, italic: true };
  put("Party A  (COGS + 50% GP + 50% Tax)", s.partnerA);
  put("Party B  (50% GP + 50% Tax)", s.partnerB);

  ws.addRow([]);
  ws.addRow(["COMMISSIONS BY REP"]).getCell(1).font = { bold: true };
  Object.entries(s.commissionsByRep || {}).sort((a, b) => b[1] - a[1]).forEach(([rep, amt]) => put(rep, amt));

  ws.getColumn(1).width = 42; ws.getColumn(2).width = 16;
  [3, 4, 5, 6].forEach((c) => { ws.getColumn(c).width = 15; });
  return ws;
}

export async function buildWorkbook(week) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "The Tire Plug CRM";
  addSummarySheet(wb, week);
  week.days.forEach((d) => addDaySheet(wb, d));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
