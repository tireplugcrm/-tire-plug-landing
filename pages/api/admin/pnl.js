/**
 * Weekly P&L tracker API (owner-gated). One endpoint, several actions:
 *   upload     { journalB64, detailB64 }       -> parse PDFs, store the day, return computed day
 *   day        { date }                          -> computed day from stored data + latest costs
 *   week       { start }                         -> 7 computed days + weekly summary
 *   cost       { match_key, label, unit_cost }   -> upsert a tire cost (shared with Finance)
 *   costs_bulk { items:[{match_key,label,unit_cost}] }
 *   list       { from?, to? }                    -> dates that already have data
 *
 * PDFs arrive base64-encoded in JSON (no multipart) to avoid extra deps.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { extractPdfLines } from "../../../lib/pnl/pdf-text.js";
import { parseSalesJournal, parseSalesDetail, matchDay, reportDate } from "../../../lib/pnl/parse.js";
import { saveDayInvoices, getDay, getWeek, loadedDates, getWeekCostItems } from "../../../lib/pnl/store.js";

export const maxDuration = 60;
export const config = { api: { bodyParser: { sizeLimit: "12mb" } } };

const b64ToBuf = (s) => Buffer.from(String(s || "").replace(/^data:.*;base64,/, ""), "base64");

// Parse a cost robustly: strip $, commas, spaces. Returns NaN for non-numbers so we
// refuse the save instead of silently storing 0 (that bug zeroed real costs once).
const parseCost = (v) => {
  const s = String(v ?? "").replace(/[^0-9.\-]/g, "");
  if (s === "" || s === "-" || s === "." || s === "-.") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { action } = req.body || {};
  try {
    if (action === "upload") {
      const { journalB64, detailB64 } = req.body;
      if (!journalB64 || !detailB64) return res.status(400).json({ error: "Upload both the Sales Journal and Sales Detail PDFs." });
      const jLines = await extractPdfLines(b64ToBuf(journalB64));
      const dLines = await extractPdfLines(b64ToBuf(detailB64));
      const journal = parseSalesJournal(jLines);
      const detail = parseSalesDetail(dLines);
      if (!journal.length) return res.status(422).json({ error: "Couldn't read any invoices from the Sales Journal — is it the right PDF?" });
      const date = reportDate(jLines) || reportDate(dLines);
      if (!date) return res.status(422).json({ error: "Couldn't find the report date in the PDF." });
      const invoices = matchDay(journal, detail);
      await saveDayInvoices(date, invoices);
      const day = await getDay(date);
      const unmatched = invoices.filter((i) => !i.matched).map((i) => i.customer);
      return res.status(200).json({ ok: true, date, day, unmatched });
    }

    if (action === "day") {
      const { date } = req.body;
      if (!date) return res.status(400).json({ error: "Missing date." });
      return res.status(200).json({ ok: true, day: await getDay(date) });
    }

    if (action === "week") {
      const { start } = req.body;
      if (!start) return res.status(400).json({ error: "Missing week start." });
      return res.status(200).json({ ok: true, ...(await getWeek(start)) });
    }

    if (action === "cost") {
      const { match_key, label, is_product = true } = req.body;
      if (!match_key) return res.status(400).json({ error: "Missing match_key." });
      const unit_cost = parseCost(req.body.unit_cost);
      if (Number.isNaN(unit_cost)) return res.status(400).json({ error: "Cost must be a number." });
      const { error } = await supabaseAdmin.from("tire_costs").upsert(
        { match_key, label: label || null, unit_cost, is_product, updated_at: new Date().toISOString() },
        { onConflict: "match_key" }
      );
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    if (action === "costs_bulk") {
      const items = (req.body.items || []).filter((i) => i.match_key);
      if (!items.length) return res.status(400).json({ error: "No costs to save." });
      const parsed = items.map((i) => ({ ...i, _cost: parseCost(i.unit_cost) }));
      const bad = parsed.filter((i) => Number.isNaN(i._cost));
      if (bad.length) return res.status(400).json({ error: `These costs aren't numbers: ${bad.map((i) => i.label || i.match_key).join(", ")}` });
      const rows = parsed.map((i) => ({ match_key: i.match_key, label: i.label || null, unit_cost: i._cost, is_product: i.is_product !== false, updated_at: new Date().toISOString() }));
      const { error } = await supabaseAdmin.from("tire_costs").upsert(rows, { onConflict: "match_key" });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, saved: rows.length });
    }

    if (action === "costbook") {
      const { start } = req.body;
      if (!start) return res.status(400).json({ error: "Missing week start." });
      return res.status(200).json({ ok: true, items: await getWeekCostItems(start) });
    }

    if (action === "list") {
      return res.status(200).json({ ok: true, dates: await loadedDates(req.body.from, req.body.to) });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error." });
  }
}
