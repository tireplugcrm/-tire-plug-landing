// node --test tests/   (npm test)
// The pricing rules, and the whole autopilot loop against a throwaway file database with a fake
// website, fake clock and fake alerts: stock sync, publish, undo, rules, holds, live checks, report.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { computePrice, roundPrice, matchRule, shouldHold, tireId } from "../lib/pricing-engine.js";
import { fileDb } from "../lib/pricing-db.js";
import * as P from "../lib/pricing.js";

const models = JSON.parse(fs.readFileSync(new URL("../data/tire-models.json", import.meta.url), "utf8"));

// ---------------------------------------------------------------- engine

test("rounding: whole dollars and .99", () => {
  assert.equal(roundPrice(94, "whole"), 94);
  assert.equal(roundPrice(93.2, "whole"), 94);
  assert.equal(roundPrice(93.2, "99"), 93.99);
  assert.equal(roundPrice(94, "99"), 94.99); // never below cost + markup
});

test("cost + markup, floor, and source order", () => {
  const tire = { brand: "Lexani", model: "LX-Twenty", key: "245/40R20", rim: 20, lt: false };
  const base = { tire, settings: { markup: 20, minProfit: 10, rounding: "whole" }, rules: [] };
  assert.deepEqual(pick(computePrice({ ...base, cost: 74.3 })), { price: 95, source: "markup", profit: 20.7 });
  assert.equal(computePrice({ ...base, cost: 50, settings: { markup: 5, minProfit: 10 } }).price, 60); // floor
  assert.equal(computePrice({ ...base, cost: 50, catalogPrice: 99 }).source, "catalog");
  assert.equal(computePrice({ ...base, cost: 50, catalogPrice: 99, override: { price: 80 } }).price, 80);
  assert.equal(computePrice({ ...base, cost: 50, override: { price: 80, hidden: true } }).price, null);
  const none = computePrice({ ...base, cost: null });
  assert.equal(none.price, null);
  assert.deepEqual(none.flags, ["no_cost"]);
  assert.deepEqual(computePrice({ ...base, cost: 50, override: { price: 45 } }).flags, ["below_cost"]);
  assert.deepEqual(computePrice({ ...base, cost: 50, override: { price: 55 } }).flags, ["low_profit"]);
});

test("the most specific rule wins", () => {
  const rules = [
    { id: 1, name: "LT", lt: true, markup: 30 },
    { id: 2, name: "Lexani", brand: "lexani", markup: 35 },
    { id: 3, name: "Lexani LT", brand: "Lexani", lt: true, markup: 40 },
    { id: 4, name: "Big rims", minRim: 22, markup: 45 },
    { id: 5, name: "off", brand: "Lexani", lt: true, minRim: 1, markup: 99, active: false },
  ];
  assert.equal(matchRule({ brand: "Lexani", lt: true, rim: 20 }, rules).name, "Lexani LT");
  assert.equal(matchRule({ brand: "Lexani", lt: false, rim: 20 }, rules).name, "Lexani");
  assert.equal(matchRule({ brand: "RBP", lt: true, rim: 17 }, rules).name, "LT");
  assert.equal(matchRule({ brand: "RBP", lt: false, rim: 22 }, rules).name, "Big rims");
  assert.equal(matchRule({ brand: "RBP", lt: false, rim: 17 }, rules), null);
});

test("holds only big automatic jumps", () => {
  assert.equal(shouldHold({ prev: 100, next: 140, source: "markup", maxJumpPct: 35 }), true);
  assert.equal(shouldHold({ prev: 100, next: 130, source: "markup", maxJumpPct: 35 }), false);
  assert.equal(shouldHold({ prev: 100, next: 140, source: "owner", maxJumpPct: 35 }), false);
  assert.equal(shouldHold({ prev: 100, next: 140, source: "markup", maxJumpPct: 35, accepted: 140 }), false);
});

// ---------------------------------------------------------------- the loop

function line(brand, model, w, r, d, available, cost, extra = {}) {
  return { partType: "Tire", available, width: w, ratio: r, diameter: d, brand, model, cost, ...extra };
}
const STOCK = [
  line("Lexani", "LX-Twenty", 245, 40, 20, 8, 74.3),
  line("Lexani", "LX-Twenty", 245, 40, 20, 4, 80.3), // same tire, second line: weighted cost 76.3
  line("Hankook", "Kinergy 4S2 X H750A", 225, 65, 17, 2, 100),
  line("RBP", "Repulsor A/T Plateau", 265, 70, 17, 6, 101.5, { tireType: "LT" }),
  line("Venom Power", "Terra Hunter X/T", 35, 12.5, 20, 4, 250),
  line("Mystery", "No Cost", 205, 55, 16, 5, ""),
  line("Used", "Takeoff", 205, 55, 16, 5, 10, { details: "used takeoff" }),
];

function makeCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pricing-"));
  const clock = { t: new Date("2026-10-17T15:00:00Z") }; // 8am in LA
  const sent = { alerts: [], digests: [], rebuilt: [] };
  const pages = new Map(); // slug -> html served by the "website"
  const ctx = {
    db: fileDb(path.join(dir, "db.json")),
    models, snapshot: { tires: [] }, catalog: [{ brand: "RBP", model: "Repulsor A/T Plateau", key: "265/70R17", lt: false, price: 125 }],
    site: "https://example.test", now: () => new Date(clock.t),
    tekmetricConfigured: () => false,
    async fetchText(url) { const slug = url.split("/tires/")[1]; if (!pages.has(slug)) throw new Error("HTTP 404"); return pages.get(slug); },
    async alert(subject, text) { sent.alerts.push({ subject, text }); },
    async digest(subject, lines) { sent.digests.push(lines); },
  };
  // A fake rebuild renders the page from site_prices + stock, the way the real page does.
  const revalidate = async (p) => {
    const slug = p.split("/tires/")[1];
    sent.rebuilt.push(slug);
    const stock = (await ctx.db.select("tire_stock", { eq: { active: true } })).filter((r) => r.size_key.toLowerCase().replace(/\//g, "-") === slug);
    const pub = await P.publicPrices(ctx);
    const tires = stock.map((r) => { const t = { brand: r.brand, model: r.model, key: r.size_key, lt: r.lt }; return { ...t, ...(P.priceOnPage(t, pub) || {}) }; });
    pages.set(slug, `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { stock: tires } } })}</script>`);
  };
  return { ctx, clock, sent, pages, revalidate };
}
const priceOf = async (ctx, brand, size) => (await ctx.db.select("site_prices")).find((p) => p.id.startsWith(brand.toLowerCase()) && p.id.includes(size))?.price ?? null;
const pick = (r) => ({ price: r.price, source: r.source, profit: r.profit });

test("stock sync, cost + $20, catalog wins, no cost = text for price", async () => {
  const { ctx } = makeCtx();
  const r = await P.syncStock(ctx, STOCK, { source: "tekmetric-csv", who: "owner" });
  assert.equal(r.tires, 5); // used takeoff left out, two Lexani lines merged
  assert.equal(await priceOf(ctx, "lexani", "245/40R20"), 97); // 76.3 + 20 -> 97
  assert.equal(await priceOf(ctx, "hankook", "225/65R17"), 120);
  assert.equal(await priceOf(ctx, "rbp", "265/70R17"), 125); // catalog (LT flag differs, still matched)
  assert.equal(await priceOf(ctx, "mystery", "205/55R16"), null);
  const stock = await P.publicStock({ ...ctx });
  assert.ok(stock.every((t) => !("cost" in t) && !("available" in t)), "no cost or counts on pages");
});

test("prices stay off the pages until live; going live queues every page", async () => {
  const { ctx, revalidate, pages, sent } = makeCtx();
  await P.syncStock(ctx, STOCK, { source: "tekmetric-csv" });
  await P.drainPages(ctx, revalidate);
  assert.ok(!pages.get("245-40r20").includes('"price"'));
  await P.setLive(ctx, true, { who: "owner" });
  const d = await P.drainPages(ctx, revalidate);
  assert.equal(d.left, 0);
  assert.ok(pages.get("245-40r20").includes('"price":97'));
  assert.ok(sent.rebuilt.length >= 5);
});

test("draft -> preview -> publish -> undo", async () => {
  const { ctx } = makeCtx();
  await P.syncStock(ctx, STOCK, { source: "tekmetric-csv" });
  const lex = tireId({ brand: "Lexani", model: "LX-Twenty", key: "245/40R20", lt: false });
  let pv = await P.stageChanges(ctx, [{ kind: "tire", target: lex, change: { action: "set_price", price: 109 } }, { kind: "setting", target: "markup", change: { value: 25 } }], { who: "owner" });
  assert.equal(pv.drafts.length, 2);
  assert.equal(await priceOf(ctx, "lexani", "245/40R20"), 97, "drafts don't touch the website");
  const byTire = Object.fromEntries(pv.effects.map((e) => [e.tire.split(" ")[0], e.to]));
  assert.deepEqual(byTire, { Lexani: 109, Hankook: 125, Venom: 275 });
  const pub = await P.publishDrafts(ctx, { who: "owner" });
  assert.equal(await priceOf(ctx, "lexani", "245/40R20"), 109);
  assert.equal(await priceOf(ctx, "hankook", "225/65R17"), 125);
  assert.equal((await ctx.db.select("pricing_drafts")).length, 0);
  await P.undoPublish(ctx, pub.publish, { who: "owner" });
  assert.equal(await priceOf(ctx, "lexani", "245/40R20"), 97);
  assert.equal(await priceOf(ctx, "hankook", "225/65R17"), 120);
  await assert.rejects(P.undoPublish(ctx, pub.publish, { who: "owner" }), /Already undone/);
});

test("rules publish and undo", async () => {
  const { ctx } = makeCtx();
  await P.syncStock(ctx, STOCK, { source: "tekmetric-csv" });
  await P.stageChanges(ctx, [{ kind: "rule", target: "new:a", change: { op: "upsert", rule: { name: "Lexani", brand: "Lexani", markup: 35 } } }], { who: "owner" });
  const pub = await P.publishDrafts(ctx, { who: "owner" });
  assert.equal(await priceOf(ctx, "lexani", "245/40R20"), 112);
  assert.equal(await priceOf(ctx, "hankook", "225/65R17"), 120);
  await P.undoPublish(ctx, pub.publish, { who: "owner" });
  assert.equal(await priceOf(ctx, "lexani", "245/40R20"), 97);
  assert.equal((await ctx.db.select("pricing_rules")).length, 0);
});

test("a big cost jump is held, alerted once, and published when accepted", async () => {
  const { ctx, revalidate, sent } = makeCtx();
  await P.syncStock(ctx, STOCK, { source: "tekmetric-csv" });
  const jumped = STOCK.map((l) => (l.brand === "Hankook" ? { ...l, cost: 180 } : l));
  await P.syncStock(ctx, jumped, { source: "tekmetric-csv" });
  const row = (await ctx.db.select("site_prices")).find((p) => p.id.startsWith("hankook"));
  assert.equal(row.price, 120);
  assert.equal(row.held_price, 200);
  await P.autopilot(ctx, revalidate, { force: true });
  await P.autopilot(ctx, revalidate, { force: true });
  assert.equal(sent.alerts.filter((a) => /held/i.test(a.subject)).length, 1, "one alert, not one per run");
  await P.acceptHeld(ctx, [row.id], { who: "owner" });
  assert.equal(await priceOf(ctx, "hankook", "225/65R17"), 200);
});

test("a sudden stock drop is refused unless confirmed", async () => {
  const { ctx } = makeCtx();
  const many = Array.from({ length: 60 }, (_, i) => line("Brand" + i, "M", 205, 55, 16, 5, 50));
  await P.syncStock(ctx, many, { source: "tekmetric-csv" });
  await assert.rejects(P.syncStock(ctx, many.slice(0, 10), { source: "tekmetric-api" }), /dropped from 60 to 10/);
  const ok = await P.syncStock(ctx, many.slice(0, 10), { source: "tekmetric-csv", allowShrink: true });
  assert.equal(ok.soldOut, 50);
});

test("live check rebuilds a wrong page and alerts if it stays wrong", async () => {
  const { ctx, clock, pages, revalidate, sent } = makeCtx();
  await P.syncStock(ctx, STOCK, { source: "tekmetric-csv" });
  await P.setLive(ctx, true, { who: "owner" });
  await P.drainPages(ctx, revalidate);
  let r = await P.checkLivePages(ctx, revalidate, { count: 10 });
  assert.equal(r.wrong.length, 0);
  // The site serves a stale page that the rebuild doesn't fix.
  const stale = pages.get("245-40r20").replace('"price":97', '"price":90');
  const stuckRevalidate = async (p) => { if (!p.endsWith("245-40r20")) return revalidate(p); pages.set("245-40r20", stale); };
  pages.set("245-40r20", stale);
  r = await P.checkLivePages(ctx, stuckRevalidate, { count: 10 });
  assert.equal(r.wrong.length, 1);
  assert.equal(sent.alerts.length, 0);
  clock.t = new Date(clock.t.getTime() + 31 * 60e3);
  await P.checkLivePages(ctx, stuckRevalidate, { count: 10 });
  assert.equal(sent.alerts.length, 1);
  assert.match(sent.alerts[0].text, /245-40r20/);
});

test("autopilot: daily report once a day, lock, failures counted", async () => {
  const { ctx, clock, revalidate, sent } = makeCtx();
  await P.syncStock(ctx, STOCK, { source: "tekmetric-csv" });
  const a = await P.autopilot(ctx, revalidate);
  assert.equal(a.ok, true, JSON.stringify(a.errors));
  assert.equal(sent.digests.length, 1);
  clock.t = new Date(clock.t.getTime() + 10 * 60e3);
  await P.autopilot(ctx, revalidate);
  assert.equal(sent.digests.length, 1, "one report per day");
  // A failing Tekmetric texts the owner on the third failed run in a row.
  ctx.tekmetricConfigured = () => true;
  ctx.fetchTekmetricLines = async () => { throw new Error("Tekmetric 503"); };
  for (let i = 0; i < 4; i++) { clock.t = new Date(clock.t.getTime() + 10 * 60e3); await P.autopilot(ctx, revalidate); }
  assert.equal(sent.alerts.filter((x) => /autopilot/.test(x.subject)).length, 1);
});
