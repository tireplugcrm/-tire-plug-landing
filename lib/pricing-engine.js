// The in-stock price rules, as pure functions (no database, no network) so they can be tested and
// reused by the site, the admin, the autopilot and the site agent alike.
//
// Price of one stocked tire, first match wins:
//   hidden by the owner         -> "text for price"
//   owner's own price           -> that price
//   website catalog price       -> that price (RBP / Kumho promos: a tire never shows two prices)
//   no cost on file             -> "text for price"
//   cost + markup               -> markup from the most specific matching rule, else the default;
//                                  never less than cost + minimum profit; then rounded
// Every result carries flags the admin and the daily report surface (below cost, low profit...).

export const DEFAULT_SETTINGS = {
  markup: 20,        // $ on top of cost per tire
  rounding: "whole", // "whole" ($94) or "99" ($93.99)
  minProfit: 10,     // floor for cost + markup prices; owner and catalog prices below it get flagged
  maxJumpPct: 35,    // autopilot holds a cost + markup price that moves more than this, and asks
  live: false,       // in-stock prices shown on the website
};

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const tireId = (t) => [norm(t.brand), norm(t.model), t.key, t.lt ? "lt" : "p"].join("|");
export const money2 = (n) => Math.round(Number(n) * 100) / 100;

export function roundPrice(raw, rounding) {
  const up = Math.ceil(money2(raw));
  if (rounding === "99") return money2(up - 0.01 >= raw ? up - 0.01 : up + 0.99);
  return up;
}

// Rules: { id, name, brand?, lt?, minRim?, maxRim?, markup, active }. Blank fields match anything.
// The rule that names the most fields wins; ties go to the older rule.
export function matchRule(tire, rules) {
  let best = null, bestScore = -1;
  for (const r of rules || []) {
    if (r.active === false) continue;
    if (r.brand && norm(r.brand) !== norm(tire.brand)) continue;
    if (r.lt != null && !!r.lt !== !!tire.lt) continue;
    if (r.minRim != null && tire.rim < r.minRim) continue;
    if (r.maxRim != null && tire.rim > r.maxRim) continue;
    const score = (r.brand ? 4 : 0) + (r.lt != null ? 2 : 0) + (r.minRim != null || r.maxRim != null ? 1 : 0);
    if (score > bestScore || (score === bestScore && Number(r.id) < Number(best.id))) { best = r; bestScore = score; }
  }
  return best;
}

// -> { price, note, source, rule, profit, flags }
//    source: hidden | owner | catalog | markup | none
export function computePrice({ tire, cost, override, catalogPrice, settings, rules }) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const c = cost > 0 ? Number(cost) : null;
  const flags = [];
  const out = (price, source, extra = {}) => {
    const profit = price != null && c != null ? money2(price - c) : null;
    if (price != null && c != null && source !== "markup") {
      if (price <= c) flags.push("below_cost");
      else if (profit < s.minProfit) flags.push("low_profit");
    }
    return { price, note: null, source, rule: null, profit, flags, ...extra };
  };

  if (override?.hidden) return out(null, "hidden");
  if (override?.price != null) return out(money2(override.price), "owner", { note: override.price_note || null });
  if (catalogPrice != null) return out(money2(catalogPrice), "catalog");
  if (c == null) { flags.push("no_cost"); return out(null, "none"); }

  const rule = matchRule(tire, rules);
  const markup = Number(rule ? rule.markup : s.markup);
  const raw = Math.max(c + markup, c + Number(s.minProfit));
  return out(roundPrice(raw, s.rounding), "markup", { rule: rule ? rule.name || `Rule ${rule.id}` : null });
}

// Should the autopilot hold this new price instead of publishing it? Only cost + markup prices
// move on their own (a cost change in Tekmetric); owner, catalog and hidden changes are deliberate.
export function shouldHold({ prev, next, source, maxJumpPct, accepted }) {
  if (source !== "markup" || prev == null || next == null || prev <= 0) return false;
  if (accepted != null && money2(accepted) === money2(next)) return false;
  return Math.abs(next - prev) / prev * 100 > maxJumpPct;
}

// Settings stored as text in app_settings -> typed settings.
export function parseSettings(raw) {
  const s = { ...DEFAULT_SETTINGS };
  const num = (v) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
  if (num(raw.stock_markup) != null) s.markup = num(raw.stock_markup);
  if (raw.price_rounding === "99" || raw.price_rounding === "whole") s.rounding = raw.price_rounding;
  if (num(raw.price_min_profit) != null) s.minProfit = num(raw.price_min_profit);
  if (num(raw.price_max_jump_pct) != null) s.maxJumpPct = num(raw.price_max_jump_pct);
  s.live = raw.stock_prices_live === "true";
  return s;
}
export const SETTING_KEYS = { markup: "stock_markup", rounding: "price_rounding", minProfit: "price_min_profit", maxJumpPct: "price_max_jump_pct", live: "stock_prices_live" };
