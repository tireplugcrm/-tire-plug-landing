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
 * POST { action: "health" }                           stock freshness, pricing checks, leads, check-in texts, agent errors
 * POST { action: "reprice" }                          run the pricing autopilot now (rebuilds stale tire pages)
 */
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { agentKeyOk, ask, approval, notify, log } from "../../lib/agent.js";
import { INVOICE_BUCKET } from "../../lib/invoices.js";
import { pricingContext } from "../../lib/pricing-context.js";
import * as P from "../../lib/pricing.js";
import { linesFromCsv } from "../../lib/stock-csv.mjs";

export const maxDuration = 60;
export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

// What the background jobs left behind, for the nightly watchdog to judge. Read-only.
async function health() {
  const day = new Date(Date.now() - 864e5).toISOString();
  const keys = ["stock_synced_at", "stock_source", "stock_prices_live", "pricing_autopilot", "pricing_dirty_pages", "pricing_mismatch", "pricing_alerted", "pricing_report_day"];
  const [settings, leads, invoiceDays, commissionDays, errors, open] = await Promise.all([
    supabaseAdmin.from("app_settings").select("key, value, updated_at").in("key", keys),
    supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).gte("created_at", day),
    supabaseAdmin.from("invoice_days").select("*").order("day", { ascending: false }).limit(3),
    supabaseAdmin.from("commission_days").select("*").order("day", { ascending: false }).limit(3),
    supabaseAdmin.from("agent_log").select("at, agent, message").gte("at", day).ilike("message", "error%").order("at", { ascending: false }).limit(20),
    supabaseAdmin.from("agent_approvals").select("code, agent, question, asked_at").eq("status", "open"),
  ]);
  return {
    now: new Date().toISOString(),
    settings: Object.fromEntries((settings.data || []).map((s) => [s.key, { value: s.value, updated_at: s.updated_at }])),
    leads_last_24h: leads.count ?? null,
    invoice_days: invoiceDays.data || [],
    commission_days: commissionDays.data || [],
    agent_errors_24h: errors.data || [],
    open_approvals: open.data || [],
  };
}

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
    if (b.action === "health") return res.status(200).json({ ok: true, ...(await health()) });
    if (b.action === "reprice") {
      const ctx = pricingContext();
      const report = await P.autopilot(ctx, (path) => res.revalidate(path), { budgetMs: 45000, force: true });
      await log(agent, "ran the pricing autopilot", report);
      return res.status(200).json({ ok: true, report });
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error("agent:", e);
    await log(agent, `error: ${e.message}`).catch(() => {});
    return res.status(400).json({ error: e.message || "Agent request failed" });
  }
}
