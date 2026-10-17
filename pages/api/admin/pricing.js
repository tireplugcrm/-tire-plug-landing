/**
 * Admin → Pricing (lib/pricing.js). Owner/Google gated. Team members can look (no costs);
 * only the owner changes anything.
 *
 * POST { action: "state" }                          everything the tab shows
 * POST { action: "stage", items }                   add changes to the draft (see stageChanges)
 * POST { action: "discard", ids? }                  drop some or all draft changes
 * POST { action: "publish", note? }                 publish the draft; changed pages rebuild now
 * POST { action: "undo", id }                       undo a publish
 * POST { action: "accept", ids }                    accept held prices
 * POST { action: "live", live }                     in-stock prices on/off on the website
 * POST { action: "upload", csv, confirmShrink? }    Tekmetric inventory CSV -> stock + costs
 * POST { action: "run" }                            run the autopilot now
 */
import { requireAdmin } from "../../../lib/adminAuth.js";
import { pricingContext } from "../../../lib/pricing-context.js";
import * as P from "../../../lib/pricing.js";
import { linesFromCsv } from "../../../lib/stock-csv.mjs";

export const maxDuration = 60;
export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  const ctx = pricingContext();
  if (!ctx.db) return res.status(500).json({ error: "Supabase not configured." });
  const { action = "state" } = req.body || {};
  const isOwner = !!auth.user.isOwner;
  const who = auth.user.email;
  const revalidate = (path) => res.revalidate(path);
  // After a change, rebuild what we can now; the autopilot finishes the rest within 10 minutes.
  const rebuild = () => P.drainPages(ctx, revalidate, { budgetMs: 20000 });

  try {
    if (action === "state") return res.status(200).json({ ...(await P.adminState(ctx, { isOwner })), canEdit: isOwner });
    if (!isOwner) return res.status(403).json({ error: "Only the owner can change prices." });

    let out;
    if (action === "stage") out = { drafts: await P.stageChanges(ctx, req.body.items, { who, via: req.body.via === "agent" ? "agent" : "admin" }) };
    else if (action === "discard") out = { drafts: await P.discardDrafts(ctx, req.body.ids) };
    else if (action === "publish") out = { ...(await P.publishDrafts(ctx, { who, note: req.body.note })), pages: await rebuild() };
    else if (action === "undo") out = { ...(await P.undoPublish(ctx, req.body.id, { who })), pages: await rebuild() };
    else if (action === "accept") { await P.acceptHeld(ctx, req.body.ids || [], { who }); out = { pages: await rebuild() }; }
    else if (action === "live") out = { ...(await P.setLive(ctx, !!req.body.live, { who })), pages: await rebuild() };
    else if (action === "upload") {
      const lines = linesFromCsv(String(req.body.csv || ""));
      out = { stock: await P.syncStock(ctx, lines, { source: "tekmetric-csv", who, allowShrink: !!req.body.confirmShrink }), pages: await rebuild() };
    } else if (action === "run") out = { report: await P.autopilot(ctx, revalidate, { budgetMs: 45000, force: true }) };
    else return res.status(400).json({ error: "Unknown action" });
    return res.status(200).json({ ok: true, ...out });
  } catch (e) {
    console.error("pricing:", e);
    return res.status(400).json({ error: e.message || "Pricing request failed" });
  }
}
