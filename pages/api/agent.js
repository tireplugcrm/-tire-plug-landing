/**
 * Jarvis API for the scheduled Claude agents on the shop PC (lib/agent.js).
 * Auth: "Authorization: Bearer <app_settings.agent_key>".
 *
 * POST { action: "ask", agent, question, details? }   text the owner a yes/no question -> { id, code }
 * POST { action: "status", id }                       -> { status: open|yes|no, answer }
 * POST { action: "notify", agent, text }              text the owner a FYI
 * POST { action: "log", agent, message, data? }       write to agent_log
 * POST { action: "invoices" }                         check-in uploads not entered in Tekmetric yet,
 *                                                     with the AI read and a 1-hour photo link
 * POST { action: "entered", ids, note? }              mark uploads entered in Tekmetric
 * POST { action: "stock", csv, confirmShrink? }       Tekmetric inventory CSV -> website stock + prices
 */
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { agentKeyOk, ask, approval, notify, log } from "../../lib/agent.js";
import { INVOICE_BUCKET } from "../../lib/invoices.js";
import { pricingContext } from "../../lib/pricing-context.js";
import * as P from "../../lib/pricing.js";
import { linesFromCsv } from "../../lib/stock-csv.mjs";

export const maxDuration = 60;
export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });
  if (!(await agentKeyOk(req))) return res.status(401).json({ error: "Unauthorized" });
  const b = req.body || {};
  const agent = String(b.agent || "jarvis").slice(0, 40);

  try {
    if (b.action === "ask") {
      if (!b.question) return res.status(400).json({ error: "question is required" });
      return res.status(200).json({ ok: true, ...(await ask(agent, String(b.question).slice(0, 600), b.details || null)) });
    }
    if (b.action === "status") {
      const a = await approval(b.id);
      if (!a) return res.status(404).json({ error: "No such request." });
      return res.status(200).json({ ok: true, status: a.status, answer: a.answer, answered_at: a.answered_at });
    }
    if (b.action === "notify") return res.status(200).json(await notify(agent, String(b.text || "").slice(0, 600)));
    if (b.action === "log") { await log(agent, String(b.message || "").slice(0, 2000), b.data || null); return res.status(200).json({ ok: true }); }

    if (b.action === "invoices") {
      const { data, error } = await supabaseAdmin.from("invoice_uploads")
        .select("id, day, file_name, path, read, read_error, uploaded_by, created_at")
        .is("entered_at", null).order("day").order("created_at").limit(60);
      if (error) throw new Error(error.message);
      const uploads = await Promise.all((data || []).map(async (u) => {
        const { data: s } = await supabaseAdmin.storage.from(INVOICE_BUCKET).createSignedUrl(u.path, 3600);
        return { ...u, photo: s?.signedUrl || null };
      }));
      return res.status(200).json({ ok: true, uploads });
    }
    if (b.action === "entered") {
      const ids = Array.isArray(b.ids) ? b.ids : [];
      if (!ids.length) return res.status(400).json({ error: "ids is required" });
      const { error } = await supabaseAdmin.from("invoice_uploads")
        .update({ entered_at: new Date().toISOString(), entered_by: "Jarvis" }).in("id", ids).is("entered_at", null);
      if (error) throw new Error(error.message);
      await log(agent, `marked ${ids.length} invoice upload(s) entered${b.note ? `: ${b.note}` : ""}`, { ids });
      return res.status(200).json({ ok: true });
    }
    if (b.action === "stock") {
      const ctx = pricingContext();
      const lines = linesFromCsv(String(b.csv || ""));
      const stock = await P.syncStock(ctx, lines, { source: "tekmetric-csv", who: "jarvis", allowShrink: !!b.confirmShrink });
      const pages = await P.drainPages(ctx, (path) => res.revalidate(path), { budgetMs: 20000 });
      await log(agent, "synced website stock from a Tekmetric export", { lines: lines.length });
      return res.status(200).json({ ok: true, stock, pages });
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error("agent:", e);
    await log(agent, `error: ${e.message}`).catch(() => {});
    return res.status(400).json({ error: e.message || "Agent request failed" });
  }
}
