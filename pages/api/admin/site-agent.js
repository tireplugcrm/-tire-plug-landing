/**
 * Site agent (admin → Pricing): the owner asks in plain words and Claude works the pricing system
 * through tools — looks tires up, stages changes into the draft, and publishes or undoes only when
 * the owner's latest message says to. Streams its reply (Server-Sent Events); conversations are saved
 * in agent_chats so they survive a refresh.
 *
 * POST { chatId?, text }  -> text/event-stream of
 *   { type: "status", text } progress | { type: "text", text } reply chunk | { type: "tool", name }
 *   { type: "done", chatId, draftChanged, published } | { type: "error", error }
 * POST { action: "load", chatId? } -> { chatId, bubbles }  (latest chat when no id)
 */
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { pricingContext } from "../../../lib/pricing-context.js";
import * as P from "../../../lib/pricing.js";

export const maxDuration = 120;
const MODEL = process.env.SITE_AGENT_MODEL || "claude-opus-5-5";
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const MAX_MESSAGES = 160;

const SYSTEM = `You are the site agent inside the admin page of The Tire Plug, a tire shop in Downtown Los Angeles
(tireplugla.com). You run the prices of the tires the shop has in stock, which show on the /tires/<size> pages,
for the owner.

How prices work (the system enforces this; you work through the tools):
- Default price per tire = cost + the default markup ($20 unless changed), never less than cost + the minimum
  profit, rounded (whole dollars or .99). Markup rules by brand, LT and rim size override the default; the rule
  naming the most fields wins. Install & balance is separate ("from $25 per wheel") and is not yours to change.
- A tire the website catalog already lists (RBP and Kumho promos) shows its catalog price.
- The owner can set a price on any single tire, put it back to the default, or hide its price ("text for price").
- Stock and costs sync from Tekmetric on their own. An autopilot keeps the website in step every 10 minutes and
  holds any automatic price that jumps more than the max-jump setting until the owner accepts it.
- Changes go into a draft first. Nothing reaches the website until it is published. Every publish can be undone.

How to work:
- Look things up with the tools before you answer. Never guess a tire id, cost or price.
- Stage what the owner asks for, then show the effect with show_draft: how many prices change, the biggest moves,
  anything below cost or under the minimum profit.
- Publish, undo a publish or accept held prices only when the owner's latest message clearly tells you to.
  Otherwise stage, summarize, and say "Say publish when you're ready."
- Never stage a price at or below cost. Point out prices under the minimum profit.
- Costs are private. Talk about them with the owner, but never put them in a price note: notes are public.
- You can't turn website prices on or off; that's the Go live switch on the page.
- Replies are short and plain: the owner often reads on a phone. Dollar amounts, not percentages, unless asked.`;

// Tool inputs are tiny, so they aren't streamed eagerly: the API validates them against these
// strict schemas before they reach us.
const nullable = (t, extra = {}) => ({ type: [t, "null"], ...extra });
const TOOLS = [
  {
    name: "search_tires",
    description: "In-stock tires with website price, where it comes from (owner, catalog, markup = cost + markup, hidden, none = no cost so text for price), the rule used, cost, profit per tire, units and flags (no_cost, below_cost, low_profit, held). Query words match brand, model and size ('lexani', '265/70R17', 'kumho 18'); empty query = all.",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, required: ["query", "source", "flag", "limit"], properties: {
      query: { type: "string" },
      source: nullable("string", { enum: ["owner", "catalog", "markup", "hidden", "none", null] }),
      flag: nullable("string", { enum: ["no_cost", "below_cost", "low_profit", "held", null] }),
      limit: nullable("integer", { description: "Default 60, max 400" }),
    } },
  },
  {
    name: "pricing_overview",
    description: "Settings (default markup, rounding, minimum profit, max jump, live), markup rules, counts per price source and flag, stock sync and autopilot health, the current draft and the last publishes.",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, required: [], properties: {} },
  },
  {
    name: "stage_tire_changes",
    description: "Add per-tire changes to the draft. set_price needs price (per tire) and may carry a short public note; use_default = back to catalog price or cost + markup; hide = text for price; show = undo hide.",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, required: ["changes"], properties: {
      changes: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "action", "price", "note"], properties: {
        id: { type: "string" },
        action: { type: "string", enum: ["set_price", "use_default", "hide", "show"] },
        price: nullable("number"),
        note: nullable("string"),
      } } },
    } },
  },
  {
    name: "stage_setting",
    description: "Add a settings change to the draft: markup ($ on top of cost), minProfit ($ floor), maxJumpPct (autopilot holds bigger automatic moves), rounding ('whole' or '99').",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, required: ["setting", "value"], properties: {
      setting: { type: "string", enum: ["markup", "minProfit", "maxJumpPct", "rounding"] },
      value: { type: "string" },
    } },
  },
  {
    name: "stage_rule",
    description: "Add a markup rule change to the draft. rule_id null = new rule. delete true removes rule_id. Blank matchers (null) match every tire.",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, required: ["rule_id", "delete", "name", "brand", "lt", "min_rim", "max_rim", "markup"], properties: {
      rule_id: nullable("integer"), delete: { type: "boolean" }, name: nullable("string"), brand: nullable("string"),
      lt: nullable("boolean"), min_rim: nullable("integer"), max_rim: nullable("integer"), markup: nullable("number"),
    } },
  },
  {
    name: "show_draft",
    description: "The draft: each staged change and every website price it would change (from -> to, cost, profit, flags).",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, required: [], properties: {} },
  },
  {
    name: "discard_draft",
    description: "Drop the whole draft.",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, required: [], properties: {} },
  },
  {
    name: "publish_draft",
    description: "Publish the draft to the website. Only when the owner's latest message tells you to publish.",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, required: ["note"], properties: { note: nullable("string") } },
  },
  {
    name: "undo_publish",
    description: "Undo a publish by id (from pricing_overview). Only when the owner's latest message tells you to.",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "integer" } } },
  },
  {
    name: "accept_held",
    description: "Accept held prices (ids from search_tires with flag held) so the website shows the new price. Only when the owner's latest message tells you to.",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, required: ["ids"], properties: { ids: { type: "array", items: { type: "string" } } } },
  },
];

const compact = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
// The owner's go-ahead for anything that changes the live website.
const GO = /\b(publish|apply|go ahead|do it|push it|make it live|ship it|yes|confirm|undo|revert|roll ?back|accept|approve)\b/i;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!auth.user.isOwner) return res.status(403).json({ error: "The site agent is for the owner." });
  const ctx = pricingContext();
  if (!ctx.db) return res.status(500).json({ error: "Supabase not configured." });
  const who = auth.user.email;

  if (req.body?.action === "load") {
    const chats = req.body.chatId
      ? await ctx.db.select("agent_chats", { eq: { id: req.body.chatId } })
      : await ctx.db.select("agent_chats", { eq: { who }, order: "updated_at", desc: true, limit: 1 });
    const chat = chats[0];
    return res.status(200).json({ chatId: chat?.id || null, bubbles: chat ? bubbles(chat.messages) : [] });
  }

  if (!client) return res.status(500).json({ error: "AI is not set up (missing ANTHROPIC_API_KEY)." });
  const text = String(req.body?.text || "").trim().slice(0, 4000);
  if (!text) return res.status(400).json({ error: "Type a message first." });

  let chat = req.body.chatId ? (await ctx.db.select("agent_chats", { eq: { id: req.body.chatId } }))[0] : null;
  if (chat && chat.who !== who) chat = null;
  const messages = [...(chat?.messages || []), { role: "user", content: text }];
  if (messages.length > MAX_MESSAGES) return res.status(400).json({ error: "This chat is long. Start a new chat." });
  const allowLive = GO.test(text);

  res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
  const send = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
  let draftChanged = false, published = false;

  const save = async () => {
    const row = { who, title: (chat?.title || text).slice(0, 80), messages, updated_at: new Date().toISOString() };
    if (chat) await ctx.db.update("agent_chats", row, { eq: { id: chat.id } });
    else [chat] = await ctx.db.insert("agent_chats", [{ id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, ...row }]);
  };

  async function runTool(name, input) {
    const needsGo = ["publish_draft", "undo_publish", "accept_held"].includes(name);
    if (needsGo && !allowLive) return { error: "The owner hasn't told you to do this in their latest message. Stage it and ask them to say publish." };
    const revalidate = (path) => res.revalidate(path);
    switch (name) {
      case "search_tires": {
        const { rows } = await P.adminState(ctx, { isOwner: true });
        const ws = String(input.query || "").split(/\s+/).map(compact).filter(Boolean);
        const hits = rows.filter((r) => (!input.source || r.source === input.source) && (!input.flag || (input.flag === "held" ? r.held != null : r.flags.includes(input.flag))) &&
          ws.every((w) => compact(`${r.brand} ${r.model} ${r.key} ${r.lt ? "lt" : ""}`).includes(w)));
        const n = Math.min(Math.max(Number(input.limit) || 60, 1), 400);
        return { total: hits.length, shown: Math.min(n, hits.length), tires: hits.slice(0, n).map((r) => ({
          id: r.id, tire: `${r.brand} ${r.model} ${r.lt ? "LT" : ""}${r.key}`, stock: r.level, units: r.available, price: r.price, source: r.source, rule: r.rule,
          note: r.note, cost: r.cost, profit: r.profit, held: r.held, flags: r.flags,
        })) };
      }
      case "pricing_overview": {
        const s = await P.adminState(ctx, { isOwner: true });
        const by = {};
        for (const r of s.rows) by[r.source] = (by[r.source] || 0) + 1;
        return { settings: s.settings, rules: s.rules.map((r) => ({ ...r, text: P.describeRule(r) })), tires: s.rows.length, bySource: by, attention: s.attention, health: s.health,
          draft: s.drafts?.summary, publishes: s.publishes.slice(0, 8) };
      }
      case "stage_tire_changes":
        draftChanged = true;
        return summarize(await P.stageChanges(ctx, input.changes.map((c) => ({ kind: "tire", target: c.id, change: { action: c.action, price: c.price, note: c.note } })), { who, via: "agent" }));
      case "stage_setting":
        draftChanged = true;
        return summarize(await P.stageChanges(ctx, [{ kind: "setting", target: input.setting, change: { value: input.setting === "rounding" ? input.value : Number(input.value) } }], { who, via: "agent" }));
      case "stage_rule":
        draftChanged = true;
        return summarize(await P.stageChanges(ctx, [{
          kind: "rule", target: input.rule_id != null ? String(input.rule_id) : `new:${Date.now()}`,
          change: input.delete ? { op: "delete" } : { op: "upsert", rule: { name: input.name, brand: input.brand, lt: input.lt, minRim: input.min_rim, maxRim: input.max_rim, markup: input.markup } },
        }], { who, via: "agent" }));
      case "show_draft": return summarize(await P.draftPreview(ctx), 80);
      case "discard_draft": draftChanged = true; return summarize(await P.discardDrafts(ctx));
      case "publish_draft": {
        const r = await P.publishDrafts(ctx, { who, via: "agent", note: input.note });
        published = draftChanged = true;
        return { ...r, pagesRebuilt: (await P.drainPages(ctx, revalidate, { budgetMs: 15000 })).rebuilt };
      }
      case "undo_publish": { const r = await P.undoPublish(ctx, input.id, { who }); published = true; await P.drainPages(ctx, revalidate, { budgetMs: 15000 }); return r; }
      case "accept_held": { await P.acceptHeld(ctx, input.ids, { who }); published = true; await P.drainPages(ctx, revalidate, { budgetMs: 15000 }); return { accepted: input.ids.length }; }
      default: return { error: `Unknown tool ${name}` };
    }
  }

  try {
    for (let turn = 0; turn < 12; turn++) {
      const stream = client.beta.messages.stream({
        model: MODEL, max_tokens: 16000, system: SYSTEM, tools: TOOLS, messages,
        thinking: { type: "adaptive", display: "updates" },
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01", "thinking-display-updates-2026-08-18"],
        fallbacks: "default",
      });
      for await (const ev of stream) {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") send({ type: "text", text: ev.delta.text });
        else if (ev.type === "content_block_delta" && ev.delta.type === "thinking_delta" && ev.delta.thinking) send({ type: "status", text: ev.delta.thinking });
        else if (ev.type === "content_block_start" && ev.content_block.type === "tool_use") send({ type: "tool", name: ev.content_block.name });
      }
      const msg = await stream.finalMessage();
      messages.push({ role: "assistant", content: msg.content });

      if (msg.stop_reason === "refusal") { send({ type: "text", text: "I can't help with that one. Try asking another way." }); break; }
      if (msg.stop_reason === "pause_turn") continue;
      if (msg.stop_reason === "max_tokens") { send({ type: "text", text: "\n(That ran long. Ask for a smaller piece.)" }); break; }
      const uses = msg.content.filter((b) => b.type === "tool_use");
      if (msg.stop_reason !== "tool_use" || !uses.length) break;
      const results = [];
      for (const u of uses) {
        let out;
        try { out = await runTool(u.name, u.input || {}); } catch (e) { out = { error: e.message }; }
        results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out), ...(out?.error ? { is_error: true } : {}) });
      }
      messages.push({ role: "user", content: results });
      send({ type: "text", text: "\n" });
    }
    await save();
    send({ type: "done", chatId: chat.id, draftChanged, published });
  } catch (e) {
    console.error("site-agent:", e);
    const error = e instanceof Anthropic.RateLimitError ? "The AI is busy. Try again in a minute."
      : e instanceof Anthropic.BadRequestError ? "The AI couldn't read this chat. Start a new chat."
      : e instanceof Anthropic.APIError ? `AI request failed (${e.status}). Try again.` : e.message || "Site agent failed.";
    // The saved chat stays as it was before this message, so the next message starts clean.
    send({ type: "error", error, chatId: chat?.id || null, draftChanged, published });
  }
  res.end();
}

function summarize(preview, max = 25) {
  return {
    drafts: preview.drafts.map((d) => d.text),
    summary: preview.summary,
    prices: preview.effects.slice(0, max).map((e) => ({ tire: e.tire, from: e.from, to: e.to, cost: e.cost, profit: e.profit, flags: e.flags })),
    morePrices: Math.max(0, preview.effects.length - max),
  };
}

// The owner's messages and the agent's text, for drawing the chat.
function bubbles(messages) {
  return (messages || []).flatMap((m) => {
    if (m.role === "user" && typeof m.content === "string") return [{ me: true, text: m.content }];
    if (m.role === "assistant" && Array.isArray(m.content)) {
      const t = m.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
      return t ? [{ me: false, text: t }] : [];
    }
    return [];
  });
}
