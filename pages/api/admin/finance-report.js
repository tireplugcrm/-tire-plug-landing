/**
 * Downloadable P&L report (PDF). Owner/Google gated.
 * POST { password|accessToken, from, to, store_id, insights? } -> application/pdf
 *
 * Recomputes the P&L from the shared lib so the PDF is authoritative.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { computePnL } from "../../../lib/finance.js";

export const maxDuration = 30;

const DARK = rgb(0.1, 0.1, 0.1), GREY = rgb(0.42, 0.42, 0.42), LINE = rgb(0.85, 0.85, 0.85);
const GREEN = rgb(0.12, 0.6, 0.4), RED = rgb(0.8, 0.12, 0.12);

function clean(s) {
  return String(s == null ? "" : s).replace(/[‘’′]/g, "'").replace(/[“”″]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[^\x20-\x7E\n]/g, "");
}
const money = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
  const to = req.body.to || today;
  const from = req.body.from || to;
  const insights = req.body.insights || "";

  let d;
  try { d = await computePnL({ from, to, store_id: req.body.store_id || 1 }); }
  catch (e) { return res.status(502).json({ error: e.message || "Could not reach TireBase." }); }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const M = 50, W = 612, H = 792, MAXW = W - M * 2;
  let page = pdf.addPage([W, H]); let y = H - M;

  function newPage(need) { if (y - need < M) { page = pdf.addPage([W, H]); y = H - M; } }
  function wrap(t, f, s, m) {
    const out = [];
    for (const raw of clean(t).split("\n")) {
      const ws = raw.split(/\s+/).filter(Boolean); if (!ws.length) { out.push(""); continue; }
      let line = "";
      for (const w of ws) { const t2 = line ? line + " " + w : w; if (f.widthOfTextAtSize(t2, s) > m && line) { out.push(line); line = w; } else line = t2; }
      if (line) out.push(line);
    }
    return out;
  }
  function text(str, { size = 10, f = font, color = DARK, x = M, gap = 4, maxw = MAXW } = {}) {
    for (const ln of wrap(str, f, size, maxw)) { newPage(size + gap); page.drawText(ln, { x, y: y - size, size, font: f, color }); y -= size + gap; }
  }
  function rule() { newPage(12); page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, thickness: 1, color: LINE }); y -= 12; }
  function plLine(label, value, { strong, color, pct } = {}) {
    newPage(18);
    const size = strong ? 12 : 10.5;
    page.drawText(clean(label), { x: M, y: y - size, size, font: strong ? bold : font, color: strong ? DARK : GREY });
    const valStr = clean(value) + (pct ? `   ${pct}` : "");
    const wv = (strong ? bold : font).widthOfTextAtSize(valStr, size);
    page.drawText(valStr, { x: W - M - wv, y: y - size, size, font: strong ? bold : font, color: color || DARK });
    y -= size + 6;
  }

  // Header
  text("THE TIRE PLUG  -  PROFIT & LOSS", { size: 12, f: bold, color: RED, gap: 6 });
  text(`Period: ${from} to ${to}`, { size: 10, color: GREY, gap: 10 });

  // Statement
  plLine("Revenue (pre-tax)", money(d.revenue));
  plLine("- Tire / product cost (COGS)", money(d.cogs));
  rule();
  plLine("= Gross profit", money(d.gross), { strong: true, color: GREEN, pct: `${d.grossMargin}%` });
  plLine("- Labor (payroll)", money(d.labor));
  plLine("- Operating expenses", money(d.otherOpex));
  rule();
  plLine("= NET PROFIT", money(d.net), { strong: true, color: d.net >= 0 ? GREEN : RED, pct: `${d.netMargin}%` });
  y -= 6;
  text("Tax excluded (passthrough). Monthly expenses counted across the months in range.", { size: 8, color: GREY, gap: 10 });

  // AI insights (if provided by the client)
  if (insights) {
    y -= 4; text("ADVISOR NOTES", { size: 9, f: bold, color: GREY }); rule();
    text(insights, { size: 10, color: DARK, gap: 5 });
    y -= 6;
  }

  // Margin by item
  const priced = d.products.filter((p) => p.hasCost);
  if (priced.length) {
    text("MARGIN BY ITEM", { size: 9, f: bold, color: GREY }); rule();
    for (const p of priced) {
      newPage(16);
      page.drawText(clean(`${p.label}  x${p.qty}`).slice(0, 70), { x: M, y: y - 9, size: 9, font, color: DARK });
      const right = `${money(p.revenue)}  -  ${money(p.cost)}  =  ${money(p.margin)} (${p.marginPct}%)`;
      const wr = font.widthOfTextAtSize(right, 9);
      page.drawText(right, { x: W - M - wr, y: y - 9, size: 9, font, color: p.margin >= 0 ? GREEN : RED });
      y -= 14;
    }
    y -= 6;
  }

  // Operating expenses detail
  if ((d.expenses || []).length) {
    text("OPERATING EXPENSES", { size: 9, f: bold, color: GREY }); rule();
    for (const e of d.expenses) {
      newPage(14);
      page.drawText(clean(`${e.label} (${e.category}, ${e.frequency === "monthly" ? "/mo" : "one-time"})`), { x: M, y: y - 9, size: 9, font, color: DARK });
      const wr = font.widthOfTextAtSize(money(e.amount), 9);
      page.drawText(money(e.amount), { x: W - M - wr, y: y - 9, size: 9, font, color: GREY });
      y -= 14;
    }
  }

  const unpriced = d.products.filter((p) => !p.hasCost).length;
  if (unpriced) { y -= 6; text(`Note: ${unpriced} item(s) still need a cost entered — COGS will rise and net profit fall once added.`, { size: 8, color: RED }); }

  const bytes = await pdf.save();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="tireplug-pnl-${from}-to-${to}.pdf"`);
  return res.status(200).send(Buffer.from(bytes));
}
