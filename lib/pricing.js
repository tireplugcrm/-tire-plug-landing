// In-stock tires and their prices, run as a machine: stock syncs itself, prices follow the rules in
// lib/pricing-engine.js, every change goes through a draft you can review and undo, and an autopilot
// (/api/cron/pricing, every 10 minutes) keeps the website in step and checks it. SERVER ONLY.
//
// Tables (lib/pricing-schema.sql):
//   tire_stock      what's on the racks: public fields + private cost and unit count
//   tire_prices     the owner's per-tire overrides (price, note, hidden)
//   pricing_rules   markup rules by brand / LT / rim size
//   app_settings    default markup, rounding, minimum profit, max jump, live switch, autopilot state
//   pricing_drafts  changes waiting to be published
//   price_publishes each publish with the values it replaced, for undo
//   site_prices     the price every page should show right now (what the autopilot checks against)
//   site_changes    log of everything that changed and who or what changed it
//
// Every function takes a context (lib/pricing-context.js): { db, models, snapshot, catalog, site,
// now, fetchText, alert, digest }. Tests pass a file-backed db and fakes instead.

import { computePrice, tireId, parseSettings, shouldHold, money2, SETTING_KEYS, DEFAULT_SETTINGS } from "./pricing-engine.js";
import { stockBuilder } from "./tire-stock.mjs";

export { tireId };
const slugOf = (key) => key.toLowerCase().replace(/\//g, "-");
const iso = (ctx) => ctx.now().toISOString();
const json = (v, fallback) => { try { return v ? JSON.parse(v) : fallback; } catch { return fallback; } };

// ---------------------------------------------------------------- settings

async function readSettings(ctx, keys) {
  const rows = await ctx.db.select("app_settings", { in: { key: keys } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
async function writeSettings(ctx, obj) {
  const at = iso(ctx);
  await ctx.db.upsert("app_settings", Object.entries(obj).map(([key, v]) => ({ key, value: v == null ? null : typeof v === "string" ? v : JSON.stringify(v), updated_at: at })), ["key"]);
}
const PRICE_KEYS = Object.values(SETTING_KEYS);

async function log(ctx, who, via, action, target, detail) {
  try { await ctx.db.insert("site_changes", [{ who, via, action, target, detail: detail || null }]); } catch (e) { console.warn("[pricing] log failed:", e.message); }
}

// ---------------------------------------------------------------- state + prices

const catalogMap = (ctx) => (ctx._catalog ||= new Map(ctx.catalog.map((t) => [tireId(t), t.price])));
function catalogPrice(ctx, t) {
  const m = catalogMap(ctx);
  return m.get(tireId(t)) ?? m.get(tireId({ ...t, lt: !t.lt })) ?? null;
}
const asTire = (r) => ({ id: r.id, brand: r.brand, model: r.model, key: r.size_key, rim: r.rim, lt: !!r.lt, level: r.level, specs: r.specs || {} });

async function loadState(ctx) {
  const [stock, overrides, rules, raw, site] = await Promise.all([
    ctx.db.select("tire_stock", { eq: { active: true } }),
    ctx.db.select("tire_prices"),
    ctx.db.select("pricing_rules", { order: "id" }),
    readSettings(ctx, PRICE_KEYS),
    ctx.db.select("site_prices"),
  ]);
  return {
    stock,
    overrides: new Map(overrides.map((o) => [o.id, o])),
    rules: rules.map(ruleFromRow),
    raw,
    settings: parseSettings(raw),
    site: new Map(site.map((p) => [p.id, p])),
  };
}
const ruleFromRow = (r) => ({ id: r.id, name: r.name, brand: r.brand || null, lt: r.lt ?? null, minRim: r.min_rim ?? null, maxRim: r.max_rim ?? null, markup: Number(r.markup), active: r.active !== false });
const ruleToRow = (r) => ({ ...(r.id != null && !String(r.id).startsWith("new:") ? { id: Number(r.id) } : {}), name: r.name || null, brand: r.brand || null, lt: r.lt ?? null, min_rim: r.minRim ?? null, max_rim: r.maxRim ?? null, markup: Number(r.markup), active: r.active !== false });

function computeAll(ctx, state) {
  const out = new Map();
  for (const row of state.stock) {
    const t = asTire(row);
    out.set(row.id, { tire: t, row, ...computePrice({ tire: t, cost: row.cost, override: state.overrides.get(row.id), catalogPrice: catalogPrice(ctx, t), settings: state.settings, rules: state.rules }) });
  }
  return out;
}

// ---------------------------------------------------------------- reconcile: rules -> site_prices

// Brings site_prices (what pages show) in line with the rules, holding suspicious jumps.
// Returns { changed, holds, dirty } and queues the pages that need a rebuild.
export async function reconcile(ctx, { state, who = "autopilot" } = {}) {
  state ||= await loadState(ctx);
  const computed = computeAll(ctx, state);
  const at = iso(ctx);
  const writes = [], changed = [], holds = [], dirty = new Set();

  for (const [id, c] of computed) {
    const prev = state.site.get(id);
    let price = c.price, held = null;
    if (prev && shouldHold({ prev: prev.price, next: c.price, source: c.source, maxJumpPct: state.settings.maxJumpPct, accepted: prev.accepted_price })) {
      price = Number(prev.price);
      held = c.price;
    }
    const flags = [...c.flags, ...(held != null ? ["held"] : [])];
    const row = { id, slug: slugOf(c.tire.key), price, note: c.note, source: c.source, held_price: held, flags, rule: c.rule };
    const same = prev && money2(prev.price ?? -1) === money2(price ?? -1) && (prev.note || null) === (row.note || null) &&
      money2(prev.held_price ?? -1) === money2(held ?? -1) && prev.source === row.source && JSON.stringify(prev.flags || []) === JSON.stringify(flags) && (prev.rule || null) === (row.rule || null);
    if (same) continue;
    writes.push({ ...row, accepted_price: held == null ? null : prev?.accepted_price ?? null, updated_at: at });
    if (!prev || money2(prev.price ?? -1) !== money2(price ?? -1) || (prev.note || null) !== (row.note || null)) {
      changed.push({ id, tire: `${c.tire.brand} ${c.tire.model} ${c.tire.key}`, from: prev?.price ?? null, to: price });
      dirty.add(row.slug);
    }
    if (held != null && money2(prev?.held_price ?? -1) !== money2(held)) holds.push({ id, tire: `${c.tire.brand} ${c.tire.model} ${c.tire.key}`, showing: price, wouldBe: held });
  }
  const gone = [...state.site.keys()].filter((id) => !computed.has(id));
  if (writes.length) await ctx.db.upsert("site_prices", writes, ["id"]);
  if (gone.length) {
    for (const id of gone) dirty.add(state.site.get(id).slug);
    await ctx.db.remove("site_prices", { in: { id: gone } });
  }
  // Prices only reach pages while live; stock changes are queued by the stock sync itself.
  if (state.settings.live) await queuePages(ctx, [...dirty]);
  if (changed.length) await log(ctx, who, who === "autopilot" ? "autopilot" : "admin", "prices_updated", null, { count: changed.length, sample: changed.slice(0, 20) });
  for (const h of holds) await log(ctx, "autopilot", "autopilot", "price_held", h.id, h);
  return { changed, holds, dirty: [...dirty] };
}

// ---------------------------------------------------------------- page rebuild queue

export async function queuePages(ctx, slugs) {
  if (!slugs.length) return;
  const cur = json((await readSettings(ctx, ["pricing_dirty_pages"])).pricing_dirty_pages, []);
  await writeSettings(ctx, { pricing_dirty_pages: [...new Set([...cur, ...slugs])] });
}
const allSlugs = (state) => [...new Set(state.stock.map((r) => slugOf(r.size_key)))];

// Pages that also show shelf prices (cheapest tires, fleet list, Landspider, homepage slides).
// They're rebuilt once the size pages in a batch are done, so they match within minutes.
const SHARED_PAGES = ["/", "/tires", "/cheap-tires-los-angeles", "/fleet", "/landspider-tires-los-angeles"];

// Rebuild queued pages until the time budget runs out; the rest wait for the next run.
export async function drainPages(ctx, revalidate, { budgetMs = 20000 } = {}) {
  const start = Date.now();
  const queue = json((await readSettings(ctx, ["pricing_dirty_pages"])).pricing_dirty_pages, []);
  const done = [], failed = [];
  for (let i = 0; i < queue.length && Date.now() - start < budgetMs; i += 6) {
    await Promise.all(queue.slice(i, i + 6).map(async (slug) => {
      try { await revalidate(`/tires/${slug}`); done.push(slug); } catch (e) { failed.push(slug); }
    }));
  }
  const left = queue.filter((s) => !done.includes(s));
  await writeSettings(ctx, { pricing_dirty_pages: left });
  if (done.length && !left.length) {
    await Promise.all(SHARED_PAGES.map((p) => Promise.resolve().then(() => revalidate(p)).catch(() => null)));
  }
  return { rebuilt: done.length, failed: failed.length, left: left.length };
}

// ---------------------------------------------------------------- stock sync

// lines: Tekmetric lines (CSV or API). Replaces the stock with what the lines say.
export async function syncStock(ctx, lines, { source, who = "autopilot", allowShrink = false } = {}) {
  const b = stockBuilder(ctx.models);
  for (const l of lines) b.add(l);
  let { tires } = b.finish({ withPrivate: true });
  if (!tires.length) throw new Error("No tires in stock in that inventory. Nothing changed.");

  // The API may report cost in cents; a tire never costs over $1,000 on average.
  const costs = tires.map((t) => t.cost).filter((c) => c > 0).sort((a, b) => a - b);
  if (costs.length && costs[costs.length >> 1] > 1000) tires = tires.map((t) => ({ ...t, cost: t.cost ? money2(t.cost / 100) : t.cost }));

  const current = await ctx.db.select("tire_stock");
  const byId = new Map(current.map((r) => [r.id, r]));
  const activeBefore = current.filter((r) => r.active).length;
  // A partial export or a Tekmetric hiccup must not wipe the website: refuse a sudden big drop.
  if (!allowShrink && activeBefore >= 40 && tires.length < activeBefore * 0.6) {
    throw new Error(`Stock dropped from ${activeBefore} to ${tires.length} tires in one sync. Not applied; check the export (or upload it from the admin with "this is right").`);
  }

  const at = iso(ctx);
  const seen = new Set();
  const added = [], levelChanged = [], costChanged = [], dirty = new Set();
  const rows = tires.map((t) => {
    const id = tireId(t);
    seen.add(id);
    const prev = byId.get(id);
    if (!prev || !prev.active) { added.push(`${t.brand} ${t.model} ${t.key}`); dirty.add(slugOf(t.key)); }
    else if (prev.level !== t.level) { levelChanged.push(`${t.brand} ${t.model} ${t.key}`); dirty.add(slugOf(t.key)); }
    const cost = t.cost ?? prev?.cost ?? null; // a line without cost keeps the cost we had
    if (prev?.cost && cost && money2(prev.cost) !== money2(cost)) costChanged.push({ id, tire: `${t.brand} ${t.model} ${t.key}`, from: Number(prev.cost), to: cost });
    return {
      id, brand: t.brand, model: t.model, size_key: t.key, rim: t.rim, lt: !!t.lt, level: t.level, specs: t.specs,
      available: t.available, cost, active: true, source, last_seen: at, first_seen: prev?.first_seen || at,
      cost_updated_at: prev && money2(prev.cost ?? -1) === money2(cost ?? -1) ? prev.cost_updated_at || at : at,
    };
  });
  const soldOut = current.filter((r) => r.active && !seen.has(r.id));
  for (const r of soldOut) dirty.add(slugOf(r.size_key));

  await ctx.db.upsert("tire_stock", rows, ["id"]);
  if (soldOut.length) await ctx.db.update("tire_stock", { active: false }, { in: { id: soldOut.map((r) => r.id) } });
  await writeSettings(ctx, { stock_synced_at: at, stock_source: source });
  await queuePages(ctx, [...dirty]);
  const summary = { source, tires: tires.length, added: added.length, soldOut: soldOut.length, levelChanged: levelChanged.length, costChanged: costChanged.length };
  if (added.length || soldOut.length || levelChanged.length || costChanged.length) {
    await log(ctx, who, who === "autopilot" ? "autopilot" : "admin", "stock_synced", source, { ...summary, added: added.slice(0, 30), soldOut: soldOut.slice(0, 30).map((r) => `${r.brand} ${r.model} ${r.size_key}`), costChanged: costChanged.slice(0, 30) });
  }
  const prices = await reconcile(ctx, { who });
  return { ...summary, pricesChanged: prices.changed.length, held: prices.holds.length, pages: dirty.size + prices.dirty.length };
}

// ---------------------------------------------------------------- what pages read

// Pages are rebuilt right after a change, by a different copy of this module than the one that made
// the change (API routes and pages are bundled separately), so nothing is cached between reads: pages
// rebuilt at the same moment only share the read that's already in flight.
function shortCache(ctx, key, load) {
  if (ctx[key]) return ctx[key];
  ctx[key] = load().finally(() => { ctx[key] = null; });
  return ctx[key];
}

// The most we ever show: 12 on the shelf reads "4 in stock"; under 4 shows the exact number.
// Capped here so the real count never reaches the page (or its source).
const SHOW_COUNT_MAX = 4;

// Active stock (public fields only) for the /tires pages; the committed snapshot if the database
// can't be read or hasn't been filled yet, so the site never goes empty.
export async function publicStock(ctx) {
  if (!ctx.db) return ctx.snapshot.tires;
  return shortCache(ctx, "_stockCache", async () => {
    try {
      const rows = await ctx.db.select("tire_stock", { eq: { active: true }, columns: "id,brand,model,size_key,rim,lt,level,specs,available" });
      return rows.length ? rows.map((r) => ({
        brand: r.brand, model: r.model, key: r.size_key, rim: r.rim, lt: !!r.lt, specs: r.specs || {}, level: r.level,
        count: Math.min(Math.max(Math.floor(Number(r.available) || 0), 0), SHOW_COUNT_MAX) || null,
      })) : ctx.snapshot.tires;
    } catch (e) {
      console.warn("[pricing] stock read failed, serving the snapshot:", e.message);
      return ctx.snapshot.tires;
    }
  });
}

// { live, prices: Map(id -> { price, note }) } for the /tires pages. Any failure: no prices.
export async function publicPrices(ctx) {
  if (!ctx.db) return { live: false, prices: new Map() };
  return shortCache(ctx, "_priceCache", async () => {
    try {
      const raw = await readSettings(ctx, ["stock_prices_live"]);
      if (raw.stock_prices_live !== "true") return { live: false, prices: new Map() };
      const rows = await ctx.db.select("site_prices", { columns: "id,price,note" });
      return { live: true, prices: new Map(rows.filter((r) => r.price != null).map((r) => [r.id, { price: Number(r.price), note: r.note || null }])) };
    } catch (e) {
      console.warn("[pricing] price read failed, showing text for price:", e.message);
      return { live: false, prices: new Map() };
    }
  });
}
export function priceOnPage(t, pub) {
  if (!pub.live) return null;
  const p = pub.prices.get(tireId(t)) || pub.prices.get(tireId({ ...t, lt: !t.lt }));
  return p ? { price: p.price, priceNote: p.note } : null;
}

// ---------------------------------------------------------------- drafts, publish, undo

// items: [{ kind: "tire", target: tireId, change: { action: set_price|use_default|hide|show, price?, note? } }
//         { kind: "setting", target: markup|rounding|minProfit|maxJumpPct, change: { value } }
//         { kind: "rule", target: ruleId | "new:<anything>", change: { op: "upsert", rule } | { op: "delete" } }]
export async function stageChanges(ctx, items, { who, via = "admin" }) {
  const state = await loadState(ctx);
  const ids = new Set(state.stock.map((r) => r.id));
  const rows = [];
  for (const it of items || []) {
    if (it.kind === "tire") {
      if (!ids.has(it.target)) throw new Error(`Not an in-stock tire: ${it.target}`);
      const a = it.change?.action;
      if (!["set_price", "use_default", "hide", "show"].includes(a)) throw new Error(`Unknown change: ${a}`);
      if (a === "set_price" && !(Number(it.change.price) > 0 && Number(it.change.price) < 5000)) throw new Error(`Bad price: ${it.change.price}`);
    } else if (it.kind === "setting") {
      if (!SETTING_KEYS[it.target] || it.target === "live") throw new Error(`Unknown setting: ${it.target}`);
      const v = it.change?.value;
      if (it.target === "rounding" ? !["whole", "99"].includes(v) : !(Number(v) >= 0 && Number(v) <= 1000)) throw new Error(`Bad value for ${it.target}: ${v}`);
    } else if (it.kind === "rule") {
      const op = it.change?.op;
      if (op === "upsert" && !(Number(it.change.rule?.markup) >= 0)) throw new Error("A rule needs a markup of $0 or more");
      if (!["upsert", "delete"].includes(op)) throw new Error(`Unknown rule change: ${op}`);
    } else throw new Error(`Unknown change kind: ${it.kind}`);
    rows.push({ kind: it.kind, target: String(it.target), change: it.change, created_by: who, via, created_at: iso(ctx) });
  }
  // A newer change to the same thing replaces the older one.
  await ctx.db.upsert("pricing_drafts", rows, ["kind", "target"]);
  return draftPreview(ctx);
}

export async function discardDrafts(ctx, ids) {
  if (ids?.length) await ctx.db.remove("pricing_drafts", { in: { id: ids } });
  else await ctx.db.remove("pricing_drafts", {});
  return draftPreview(ctx);
}

function applyDrafts(state, drafts) {
  const s = { ...state, overrides: new Map(state.overrides), rules: state.rules.map((r) => ({ ...r })), settings: { ...state.settings } };
  for (const d of drafts) {
    const c = d.change;
    if (d.kind === "tire") {
      const o = { ...(s.overrides.get(d.target) || { id: d.target }) };
      if (c.action === "set_price") { o.price = money2(c.price); o.price_note = c.note || null; o.hidden = false; }
      if (c.action === "use_default") { o.price = null; o.price_note = null; }
      if (c.action === "hide") o.hidden = true;
      if (c.action === "show") o.hidden = false;
      s.overrides.set(d.target, o);
    } else if (d.kind === "setting") {
      s.settings[d.target] = d.target === "rounding" ? c.value : Number(c.value);
    } else if (d.kind === "rule") {
      s.rules = s.rules.filter((r) => String(r.id) !== d.target);
      if (c.op === "upsert") s.rules.push({ ...c.rule, id: d.target.startsWith("new:") ? 1e9 + s.rules.length : Number(d.target), active: c.rule.active !== false });
    }
  }
  return s;
}

const describeDraft = (d, state) => {
  const c = d.change;
  if (d.kind === "setting") return `${{ markup: "Default markup", rounding: "Rounding", minProfit: "Minimum profit", maxJumpPct: "Hold price jumps over" }[d.target]}: ${d.target === "rounding" ? (c.value === "99" ? "$.99" : "whole dollars") : d.target === "maxJumpPct" ? `${c.value}%` : `$${c.value}`}`;
  if (d.kind === "rule") return c.op === "delete" ? `Delete rule ${state.rules.find((r) => String(r.id) === d.target)?.name || d.target}` : `Rule: ${describeRule(c.rule)}`;
  const t = state.stock.find((r) => r.id === d.target);
  const name = t ? `${t.brand} ${t.model} ${t.size_key}` : d.target;
  return { set_price: `${name}: $${c.price}${c.note ? ` (“${c.note}”)` : ""}`, use_default: `${name}: back to the default price`, hide: `${name}: hide price`, show: `${name}: show price` }[c.action];
};
export const describeRule = (r) => `${[r.brand, r.lt === true ? "LT" : r.lt === false ? "non-LT" : null, r.minRim || r.maxRim ? `${r.minRim || "any"}–${r.maxRim || "any"}" rims` : null].filter(Boolean).join(", ") || "Every tire"}: cost + $${r.markup}${r.name ? ` (${r.name})` : ""}`;

// The pending drafts and exactly which website prices they would change.
export async function draftPreview(ctx, state) {
  state ||= await loadState(ctx);
  const drafts = await ctx.db.select("pricing_drafts", { order: "id" });
  if (!drafts.length) return { drafts: [], effects: [], summary: { changes: 0 } };
  const before = computeAll(ctx, state);
  const after = computeAll(ctx, applyDrafts(state, drafts));
  const effects = [];
  for (const [id, a] of after) {
    const b = before.get(id);
    if (money2(b.price ?? -1) === money2(a.price ?? -1) && (b.note || null) === (a.note || null)) continue;
    effects.push({ id, tire: `${a.tire.brand} ${a.tire.model} ${a.tire.lt ? "LT" : ""}${a.tire.key}`, slug: slugOf(a.tire.key), from: b.price, to: a.price, cost: a.row.cost != null ? Number(a.row.cost) : null, profit: a.profit, flags: a.flags });
  }
  return {
    drafts: drafts.map((d) => ({ id: d.id, kind: d.kind, target: d.target, via: d.via, by: d.created_by, text: describeDraft(d, state) })),
    effects,
    summary: { changes: drafts.length, prices: effects.length, belowCost: effects.filter((e) => e.flags.includes("below_cost")).length, lowProfit: effects.filter((e) => e.flags.includes("low_profit")).length },
  };
}

export async function publishDrafts(ctx, { who, via = "admin", note } = {}) {
  const state = await loadState(ctx);
  const drafts = await ctx.db.select("pricing_drafts", { order: "id" });
  if (!drafts.length) throw new Error("Nothing to publish.");
  const preview = await draftPreview(ctx, state);
  const before = { overrides: {}, settings: {}, rules: {} };
  const at = iso(ctx);

  for (const d of drafts) {
    const c = d.change;
    if (d.kind === "tire") {
      if (!(d.target in before.overrides)) before.overrides[d.target] = state.overrides.get(d.target) || null;
      const t = state.stock.find((r) => r.id === d.target);
      if (!t) continue; // sold out since it was drafted
      const row = { id: d.target, brand: t.brand, model: t.model, size_key: t.size_key, lt: !!t.lt, updated_by: who, updated_at: at };
      if (c.action === "set_price") Object.assign(row, { price: money2(c.price), price_note: c.note || null, hidden: false });
      if (c.action === "use_default") Object.assign(row, { price: null, price_note: null });
      if (c.action === "hide") row.hidden = true;
      if (c.action === "show") row.hidden = false;
      await ctx.db.upsert("tire_prices", [row], ["id"]);
    } else if (d.kind === "setting") {
      const key = SETTING_KEYS[d.target];
      if (!(key in before.settings)) before.settings[key] = state.raw[key] ?? null;
      await writeSettings(ctx, { [key]: String(c.value) });
    } else if (d.kind === "rule") {
      if (c.op === "delete") {
        before.rules[d.target] = state.rules.find((r) => String(r.id) === d.target) || null;
        await ctx.db.remove("pricing_rules", { eq: { id: Number(d.target) } });
      } else if (d.target.startsWith("new:")) {
        const [created] = await ctx.db.insert("pricing_rules", [ruleToRow({ ...c.rule, id: null })]);
        before.rules[String(created.id)] = null;
      } else {
        before.rules[d.target] = state.rules.find((r) => String(r.id) === d.target) || null;
        await ctx.db.upsert("pricing_rules", [ruleToRow({ ...c.rule, id: Number(d.target) })], ["id"]);
      }
    }
  }
  const [pub] = await ctx.db.insert("price_publishes", [{
    who, via, note: note || null, created_at: at,
    summary: `${drafts.length} change${drafts.length === 1 ? "" : "s"}, ${preview.effects.length} price${preview.effects.length === 1 ? "" : "s"}`,
    items: preview.drafts.map((d) => d.text), effects: preview.effects.slice(0, 400), before,
  }]);
  await ctx.db.remove("pricing_drafts", { in: { id: drafts.map((d) => d.id) } });
  await log(ctx, who, via, "publish", String(pub.id), { items: preview.drafts.map((d) => d.text).slice(0, 30), prices: preview.effects.length });
  const r = await reconcile(ctx, { who });
  return { publish: pub.id, prices: preview.effects.length, pages: r.dirty.length };
}

export async function undoPublish(ctx, id, { who }) {
  const [pub] = await ctx.db.select("price_publishes", { eq: { id: Number(id) } });
  if (!pub) throw new Error("No such publish.");
  if (pub.undone_at) throw new Error("Already undone.");
  const b = pub.before || {};
  for (const [tid, row] of Object.entries(b.overrides || {})) {
    if (row) await ctx.db.upsert("tire_prices", [{ ...row, updated_by: who, updated_at: iso(ctx) }], ["id"]);
    else await ctx.db.remove("tire_prices", { eq: { id: tid } });
  }
  for (const [key, value] of Object.entries(b.settings || {})) {
    if (value == null) await ctx.db.remove("app_settings", { eq: { key } });
    else await writeSettings(ctx, { [key]: value });
  }
  for (const [rid, rule] of Object.entries(b.rules || {})) {
    if (rule) await ctx.db.upsert("pricing_rules", [ruleToRow({ ...rule, id: Number(rid) })], ["id"]);
    else await ctx.db.remove("pricing_rules", { eq: { id: Number(rid) } });
  }
  await ctx.db.update("price_publishes", { undone_at: iso(ctx), undone_by: who }, { eq: { id: Number(id) } });
  await log(ctx, who, "admin", "undo", String(id), { summary: pub.summary });
  const r = await reconcile(ctx, { who });
  return { undone: Number(id), prices: r.changed.length };
}

// Accept a held price: the autopilot publishes it on this run.
export async function acceptHeld(ctx, ids, { who }) {
  const rows = await ctx.db.select("site_prices", { in: { id: ids } });
  for (const r of rows) if (r.held_price != null) await ctx.db.update("site_prices", { accepted_price: r.held_price }, { eq: { id: r.id } });
  await log(ctx, who, "admin", "accept_held", null, { ids });
  return reconcile(ctx, { who });
}

export async function setLive(ctx, live, { who }) {
  await writeSettings(ctx, { stock_prices_live: live ? "true" : "false" });
  await log(ctx, who, "admin", live ? "go_live" : "go_offline", "stock_prices_live");
  const state = await loadState(ctx);
  await reconcile(ctx, { state, who });
  await queuePages(ctx, allSlugs(state));
  return { live, pages: allSlugs(state).length };
}

// ---------------------------------------------------------------- admin view

export async function adminState(ctx, { isOwner }) {
  const state = await loadState(ctx);
  const computed = computeAll(ctx, state);
  const [preview, publishes, changes, auto] = await Promise.all([
    isOwner ? draftPreview(ctx, state) : null,
    ctx.db.select("price_publishes", { order: "id", desc: true, limit: 20 }),
    ctx.db.select("site_changes", { order: "id", desc: true, limit: 40 }),
    readSettings(ctx, ["stock_synced_at", "stock_source", "pricing_autopilot", "pricing_dirty_pages", "pricing_mismatch", "pricing_check_cursor"]),
  ]);
  const rows = state.stock.map((r) => {
    const c = computed.get(r.id);
    const site = state.site.get(r.id);
    const shown = site ? site.price : c.price;
    const row = {
      id: r.id, brand: r.brand, model: r.model, key: r.size_key, slug: slugOf(r.size_key), lt: !!r.lt, level: r.level, rim: r.rim,
      price: shown != null ? Number(shown) : null, note: site?.note ?? c.note, source: c.source, rule: c.rule,
      held: site?.held_price != null ? Number(site.held_price) : null,
      flags: site?.flags || c.flags,
    };
    if (isOwner) Object.assign(row, { cost: r.cost != null ? Number(r.cost) : null, available: r.available, profit: shown != null && r.cost ? money2(shown - r.cost) : null, costUpdatedAt: r.cost_updated_at });
    return row;
  }).sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model) || a.key.localeCompare(b.key, "en", { numeric: true }));

  const attention = {
    held: rows.filter((r) => r.held != null).length,
    noCost: rows.filter((r) => r.flags.includes("no_cost")).length,
    belowCost: rows.filter((r) => r.flags.includes("below_cost")).length,
    lowProfit: rows.filter((r) => r.flags.includes("low_profit")).length,
  };
  return {
    rows, settings: state.settings, rules: state.rules, attention, drafts: preview,
    publishes: publishes.map((p) => ({ id: p.id, at: p.created_at, who: p.who, via: p.via, summary: p.summary, items: p.items, undone: !!p.undone_at })),
    changes: isOwner ? changes : [],
    health: {
      stockSyncedAt: auto.stock_synced_at || null, stockSource: auto.stock_source || "snapshot",
      autopilot: json(auto.pricing_autopilot, null),
      pagesQueued: json(auto.pricing_dirty_pages, []).length,
      mismatches: Object.keys(json(auto.pricing_mismatch, {})).length,
      tekmetric: !!ctx.tekmetricConfigured?.(),
      db: ctx.db?.kind || "none",
    },
  };
}

// ---------------------------------------------------------------- live check

// Reads live /tires pages the way a customer gets them and compares them with what they should show.
// Wrong pages are rebuilt; a page still wrong 30 minutes later is reported.
export async function checkLivePages(ctx, revalidate, { count = 6 } = {}) {
  const state = await loadState(ctx);
  const slugs = allSlugs(state).sort();
  if (!slugs.length) return { checked: 0, wrong: [] };
  const raw = await readSettings(ctx, ["pricing_check_cursor", "pricing_mismatch"]);
  const cursor = Number(raw.pricing_check_cursor) || 0;
  const mismatch = json(raw.pricing_mismatch, {});
  const pick = Array.from({ length: Math.min(count, slugs.length) }, (_, i) => slugs[(cursor + i) % slugs.length]);
  const wrong = [], stuck = [];

  for (const slug of pick) {
    const expected = new Map();
    for (const r of state.stock) if (slugOf(r.size_key) === slug) {
      const p = state.settings.live ? state.site.get(r.id)?.price : null;
      expected.set(r.id, p != null ? money2(p) : null);
    }
    let problem = null;
    try {
      const html = await ctx.fetchText(`${ctx.site}/tires/${slug}`);
      const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      const stock = m ? JSON.parse(m[1]).props?.pageProps?.stock : null;
      if (!Array.isArray(stock)) problem = "page has no stock data";
      else {
        const shown = new Map(stock.map((t) => [tireId(t), t.price != null ? money2(t.price) : null]));
        const missing = [...expected.keys()].filter((id) => !shown.has(id) && !shown.has(id.replace(/\|(lt|p)$/, (x) => (x === "|lt" ? "|p" : "|lt"))));
        const extra = [...shown.keys()].filter((id) => !expected.has(id) && !expected.has(id.replace(/\|(lt|p)$/, (x) => (x === "|lt" ? "|p" : "|lt"))));
        const badPrice = [...expected].filter(([id, p]) => shown.has(id) && shown.get(id) !== p);
        if (missing.length || extra.length || badPrice.length) problem = `${missing.length} missing, ${extra.length} sold out still shown, ${badPrice.length} wrong price`;
      }
    } catch (e) {
      problem = `could not load (${e.message})`;
    }
    if (problem) {
      wrong.push({ slug, problem });
      mismatch[slug] ||= iso(ctx);
      if (ctx.now() - new Date(mismatch[slug]) > 30 * 60 * 1000) stuck.push(`${slug}: ${problem}`);
      try { await revalidate(`/tires/${slug}`); } catch { /* retried next run */ }
    } else delete mismatch[slug];
  }
  await writeSettings(ctx, { pricing_check_cursor: String((cursor + pick.length) % slugs.length), pricing_mismatch: mismatch });
  if (stuck.length) await alertOnce(ctx, `stuck:${stuck.map((s) => s.split(":")[0]).sort().join(",")}`, "Tire pages not updating", `${stuck.length} tire page(s) still show the wrong stock or price after a rebuild: ${stuck.slice(0, 3).join("; ")}`);
  return { checked: pick.length, wrong };
}

// ---------------------------------------------------------------- alerts + daily report

async function alertOnce(ctx, key, subject, text, { hours = 12 } = {}) {
  const sent = json((await readSettings(ctx, ["pricing_alerted"])).pricing_alerted, {});
  if (sent[key] && ctx.now() - new Date(sent[key]) < hours * 3600e3) return false;
  for (const [k, at] of Object.entries(sent)) if (ctx.now() - new Date(at) > 7 * 864e5) delete sent[k];
  sent[key] = iso(ctx);
  await writeSettings(ctx, { pricing_alerted: sent });
  await log(ctx, "autopilot", "autopilot", "alert", key, { subject, text });
  try { await ctx.alert(subject, text); } catch (e) { console.error("[pricing] alert failed:", e.message); }
  return true;
}

const laDay = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d);
const laHour = (d) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" }).format(d));

export async function dailyReport(ctx, { force = false } = {}) {
  const now = ctx.now();
  const raw = await readSettings(ctx, ["pricing_report_day", "stock_synced_at", "stock_source", "stock_prices_live"]);
  if (!force && (raw.pricing_report_day === laDay(now) || laHour(now) < 7)) return null;
  const since = new Date(now - 864e5).toISOString();
  const changes = (await ctx.db.select("site_changes", { order: "id", desc: true, limit: 500 })).filter((c) => c.created_at >= since);
  const state = await loadState(ctx);
  const site = [...state.site.values()];
  const count = (a) => changes.filter((c) => c.action === a);
  const sum = (a, f) => count(a).reduce((n, c) => n + (Number(c.detail?.[f]) || 0), 0);
  const syncedAgo = raw.stock_synced_at ? Math.floor((now - new Date(raw.stock_synced_at)) / 864e5) : null;

  const lines = [
    `In stock: ${state.stock.length} tires. Prices on the website: ${raw.stock_prices_live === "true" ? "ON" : "OFF"}.`,
    `Stock: ${syncedAgo == null ? "never synced (website shows the saved snapshot)" : syncedAgo === 0 ? `synced today from ${raw.stock_source}` : `last synced ${syncedAgo} day(s) ago from ${raw.stock_source}`}.`,
    `Last 24h: ${sum("stock_synced", "added")} tires added, ${sum("stock_synced", "soldOut")} sold out, ${sum("stock_synced", "costChanged")} cost changes, ${sum("prices_updated", "count")} prices updated automatically, ${count("publish").length} publish(es) by you.`,
  ];
  const held = site.filter((p) => p.held_price != null);
  if (held.length) lines.push(`Waiting for you: ${held.length} price(s) held because they'd jump more than ${state.settings.maxJumpPct}% (open Admin → Pricing → Needs attention).`);
  const noCost = site.filter((p) => (p.flags || []).includes("no_cost")).length;
  const low = site.filter((p) => (p.flags || []).some((f) => f === "below_cost" || f === "low_profit")).length;
  if (noCost) lines.push(`${noCost} tire(s) show "text for price" because Tekmetric has no cost for them.`);
  if (low) lines.push(`${low} tire(s) are priced below cost or under $${state.settings.minProfit} profit.`);
  const alerts = count("alert");
  if (alerts.length) lines.push(`Alerts sent: ${alerts.map((a) => a.detail?.subject).join("; ")}.`);
  if (!ctx.tekmetricConfigured?.() && (syncedAgo == null || syncedAgo >= 2)) lines.push("Until the Tekmetric API keys are in, drop the inventory CSV in Admin → Pricing to update stock.");

  await writeSettings(ctx, { pricing_report_day: laDay(now) });
  await ctx.digest("Tire Plug pricing: daily report", lines);
  return lines;
}

// ---------------------------------------------------------------- the autopilot

// One run: sync stock (Tekmetric), re-apply the price rules, rebuild changed pages, check the live
// site, raise alerts, send the morning report. Each step fails on its own; three failed runs in a
// row of the same step text the owner.
export async function autopilot(ctx, revalidate, { budgetMs = 45000, force = false } = {}) {
  const start = Date.now();
  const left = () => budgetMs - (Date.now() - start);
  const raw = await readSettings(ctx, ["pricing_lock", "pricing_autopilot", "stock_synced_at"]);
  if (!force && raw.pricing_lock && ctx.now() - new Date(raw.pricing_lock) < 120e3) return { skipped: "another run is in progress" };
  await writeSettings(ctx, { pricing_lock: iso(ctx) });
  const prev = json(raw.pricing_autopilot, {});
  const report = { at: iso(ctx), steps: {}, errors: {} };

  const step = async (name, fn) => {
    try { report.steps[name] = await fn(); }
    catch (e) { report.errors[name] = e.message || String(e); }
  };

  if (ctx.tekmetricConfigured?.()) {
    const last = raw.stock_synced_at ? ctx.now() - new Date(raw.stock_synced_at) : Infinity;
    if (force || last > 9 * 60e3) await step("stock", async () => syncStock(ctx, await ctx.fetchTekmetricLines(), { source: "tekmetric-api" }));
  }
  await step("prices", async () => { const r = await reconcile(ctx); return { changed: r.changed.length, newlyHeld: r.holds.length }; });
  await step("pages", () => drainPages(ctx, revalidate, { budgetMs: Math.max(5000, left() - 15000) }));
  if (left() > 8000) await step("check", () => checkLivePages(ctx, revalidate, { count: 6 }));
  if (left() > 3000) await step("report", async () => !!(await dailyReport(ctx)));

  // Alerts: held prices (however they got held: autopilot or a CSV upload), repeated failures, stale stock.
  await step("holds", async () => {
    const held = (await ctx.db.select("site_prices")).filter((p) => p.held_price != null).sort((a, b) => a.id.localeCompare(b.id));
    if (!held.length) return 0;
    const names = new Map((await ctx.db.select("tire_stock", { in: { id: held.map((h) => h.id) } })).map((r) => [r.id, `${r.brand} ${r.model} ${r.size_key}`]));
    await alertOnce(ctx, `held:${held.map((h) => `${h.id}=${h.held_price}`).join(",")}`, "Prices held for your OK",
      `${held.length} price(s) would jump a lot after a cost change, so the website keeps the old price until you accept them in Admin → Pricing: ${held.slice(0, 3).map((h) => `${names.get(h.id) || h.id} $${h.price} → $${h.held_price}`).join("; ")}.`, { hours: 24 });
    return held.length;
  });
  const failures = { ...(prev.failures || {}) };
  for (const name of ["stock", "prices", "pages", "check"]) {
    if (report.errors[name]) failures[name] = (failures[name] || 0) + 1; else if (report.steps[name] !== undefined) failures[name] = 0;
    if (failures[name] === 3) await alertOnce(ctx, `fail:${name}`, "Pricing autopilot needs a look", `The ${name} step failed 3 runs in a row: ${report.errors[name]}`);
  }
  report.failures = failures;
  if (!ctx.tekmetricConfigured?.() && raw.stock_synced_at && ctx.now() - new Date(raw.stock_synced_at) > 7 * 864e5) {
    await alertOnce(ctx, "stale-stock", "Website stock is a week old", "Stock on tireplugla.com hasn't been updated in 7 days. Drop today's Tekmetric inventory CSV in Admin → Pricing.", { hours: 72 });
  }
  report.ms = Date.now() - start;
  report.ok = Object.keys(report.errors).length === 0;
  await writeSettings(ctx, { pricing_autopilot: report, pricing_lock: null });
  return report;
}

// Is the 10-minute schedule still running? Called by the daily Vercel cron as a backstop.
export async function checkSchedule(ctx) {
  const last = json((await readSettings(ctx, ["pricing_autopilot"])).pricing_autopilot, null);
  if (!last || ctx.now() - new Date(last.at) > 60 * 60e3) {
    await alertOnce(ctx, "schedule-stopped", "Pricing autopilot schedule stopped", `The 10-minute pricing autopilot last ran ${last ? new Date(last.at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) : "never"}. Check the pg_cron job in Supabase (lib/pricing-schema.sql).`, { hours: 24 });
    return false;
  }
  return true;
}

export { DEFAULT_SETTINGS, loadState, computeAll };
