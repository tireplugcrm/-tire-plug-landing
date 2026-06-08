/**
 * P&L math for The Tire Plug weekly tracker. Pure functions — given parsed invoices
 * and a tire-cost lookup, produce per-invoice costing, commissions, flags, and the
 * 50/50 partner split. All tunable numbers live in PNL_CONFIG.
 */
import { normalizeDesc } from "../tirebase.js";

export const PNL_CONFIG = {
  installPerTire: 25,     // labor allocation per installed tire (commission basis)
  pickupPerTire: 10,      // labor allocation per tire for pickup-only customers
  perAlignment: 50,       // labor allocation per alignment (commission basis)
  commissionRate: 0.10,   // 10% of adjusted profit
  rentPerWeek: 4750,
  eligibleReps: ["Belen Moana", "Jonathan Alatorre", "Dennis Bliznuk", "Oscar Landaverde", "Alex"],
  pickupKeywords: ["Mobile", "Tow", "Fleet", "Body", "Repair", "Shop", "Tires", "Motor", "Parts", "Transport", "Auto", "Wholesale"],
};

const r2 = (n) => Math.round(n * 100) / 100;
const firstToken = (s) => String(s || "").trim().split(/\s+/)[0].toLowerCase();

// Classify a line by its DESCRIPTION (the report types oil filters / TPMS / oil
// changes as "Tires" too, so the type column can't be trusted). Categories:
//   tire | tpms | oil | alignment | labor
export function lineCategory(l) {
  const d = String(l.description || "").toLowerCase();
  if (/tpms|sensor/.test(d)) return "tpms";
  if (/oil/.test(d)) return "oil";                 // oil change, motor oil, oil filter
  if (/alignment/.test(d)) return "alignment";
  if ((l.type || "") === "Tires") return "tire";
  return "labor";                                   // generic install labor, disposal, etc.
}
const COST_LABEL = { tire: "🛞 Tire", tpms: "💡 TPMS", oil: "🛢️ Oil" };
export { COST_LABEL };

export function isEligibleRep(rep, cfg = PNL_CONFIG) {
  const f = firstToken(rep);
  return cfg.eligibleReps.some((e) => firstToken(e) === f);
}

export function isPickupCustomer(name, cfg = PNL_CONFIG) {
  const n = String(name || "");
  return cfg.pickupKeywords.some((k) => new RegExp(`\\b${k}\\b`, "i").test(n));
}

// Compute one invoice's P&L. costByKey: { normalizedDesc: { unit_cost } }.
export function computeInvoice(inv, costByKey = {}, cfg = PNL_CONFIG) {
  const lines = inv.lines || [];
  const tires = lines.filter((l) => lineCategory(l) === "tire");
  const tpms = lines.filter((l) => lineCategory(l) === "tpms");
  const oils = lines.filter((l) => lineCategory(l) === "oil");
  const aligns = lines.filter((l) => lineCategory(l) === "alignment");

  const tireQty = tires.reduce((s, l) => s + l.qty, 0);
  const tpmsQty = tpms.reduce((s, l) => s + l.qty, 0);
  const oilQty = oils.reduce((s, l) => s + l.qty, 0);
  const alignCount = aligns.reduce((s, l) => s + (l.qty || 1), 0);

  // Three cost buckets, all from the shared cost memory; track any we don't know yet.
  const missing = [];
  const costOf = (l, category) => {
    const key = normalizeDesc(l.description);
    const c = costByKey[key];
    if (!c) { missing.push({ key, description: l.description, qty: l.qty, category }); return null; }
    return Number(c.unit_cost) * l.qty;
  };
  let tireCost = 0, tpmsCost = 0, oilCost = 0;
  const tireDetail = tires.map((l) => {
    const cost = costOf(l, "tire");
    if (cost != null) tireCost += cost;
    return { description: l.description, qty: l.qty, unit_price: l.unit_price, retail: l.total, unit_cost: cost == null ? null : r2(cost / (l.qty || 1)), key: normalizeDesc(l.description) };
  });
  for (const l of tpms) { const c = costOf(l, "tpms"); if (c != null) tpmsCost += c; }  // TPMS sensors
  for (const l of oils) { const c = costOf(l, "oil"); if (c != null) oilCost += c; }    // oil change / filter / motor oil
  const hasAllCosts = missing.length === 0;

  const productCost = tireCost;                       // tires only (alias for adjusted cost)
  const etcCost = r2(tpmsCost + oilCost);             // TPMS + oil
  const totalCost = r2(tireCost + tpmsCost + oilCost); // COGS = tires + TPMS + oil
  const retail = r2(inv.subtotal);                    // pre-tax revenue
  const tax = r2(inv.tax);
  const totalProfit = r2(retail - totalCost);         // gross profit (real costs)

  // Seller operating cost per tire: $25 when installed (has generic labor),
  // $10 when pickup-only (tires sold with no generic labor). Plus $50/alignment.
  // Commission is net of ALL cost (tire + TPMS + oil) plus these operating costs.
  const hasInstallLabor = lines.some((l) => lineCategory(l) === "labor");
  const pickup = tireQty > 0 && !hasInstallLabor;
  const perTire = pickup ? cfg.pickupPerTire : cfg.installPerTire;
  const adjustedCost = r2(totalCost + perTire * tireQty + cfg.perAlignment * alignCount);
  const adjustedProfit = r2(retail - adjustedCost);
  const eligible = isEligibleRep(inv.rep, cfg);
  // No matched line items = incomplete data; never pay commission on it.
  const unmatched = lines.length === 0;
  const commission = (eligible && !unmatched) ? Math.max(0, Math.trunc(adjustedProfit * cfg.commissionRate)) : 0;

  // Per-invoice flags
  const netPerTire = tireQty ? totalProfit / tireQty : null;
  const flags = [];
  if (hasAllCosts && totalCost > retail) flags.push("negative");      // 🟥
  if (netPerTire != null && hasAllCosts && netPerTire < 30) flags.push("low");   // 🟨
  if (netPerTire != null && hasAllCosts && netPerTire > 60) flags.push("high");  // 🟩
  if (pickup) flags.push("pickup");                                   // 📦
  if (!hasAllCosts) flags.push("missing");                            // 🟧
  if (unmatched) flags.push("unmatched");                             // ⚠️ no Sales Detail matched

  // 50/50 partner split on gross profit (rent + commission settle separately)
  const gp = totalProfit;
  const partnerA = r2(totalCost + 0.5 * gp + 0.5 * tax);  // COGS + 50% GP + 50% tax
  const partnerB = r2(0.5 * gp + 0.5 * tax);

  return {
    inv_no: inv.inv_no, detail_no: inv.detail_no, rep: inv.rep, customer: inv.customer,
    cust_type: inv.cust_type, payment_method: inv.payment_method,
    // Full line-item list with quantities, exactly as it appears on the TireBase Sales Detail.
    description: (lines.length ? lines.map((l) => `${l.description}${l.qty ? ` ×${l.qty}` : ""}`).join(" · ") : summarize(lines)) || "—",
    tireQty, tpmsQty, oilQty, alignCount, pickup, eligible,
    tireCost: r2(tireCost), tpmsCost: r2(tpmsCost), oilCost: r2(oilCost),
    tireUnitCost: tireQty ? r2(tireCost / tireQty) : 0, tpmsUnitCost: tpmsQty ? r2(tpmsCost / tpmsQty) : 0, oilUnitCost: oilQty ? r2(oilCost / oilQty) : 0,
    productCost: r2(productCost), etcCost: r2(etcCost), totalCost, retail, tax,
    adjustedCost, adjustedProfit, commission,
    totalProfit, netPerTire: netPerTire == null ? null : r2(netPerTire),
    partnerA, partnerB, missing, hasAllCosts, flags, lines: inv.lines || [],
  };
}

function summarize(lines = []) {
  const cats = new Set(lines.map(lineCategory));
  const out = [];
  if (cats.has("alignment")) out.push("Alignment");
  if (cats.has("tpms")) out.push("TPMS");
  if (cats.has("oil")) out.push("Oil change");
  if (cats.has("labor")) out.push("Labor");
  return out.join(" · ") || "—";
}

// Aggregate a single day.
export function computeDay({ date, invoices }, costByKey = {}, cfg = PNL_CONFIG) {
  const rows = invoices.map((inv) => computeInvoice(inv, costByKey, cfg));
  const sum = (f) => r2(rows.reduce((s, r) => s + (r[f] || 0), 0));
  const commissionsByRep = {};
  for (const r of rows) if (r.commission) commissionsByRep[r.rep] = r2((commissionsByRep[r.rep] || 0) + r.commission);
  const missingMap = {};
  for (const r of rows) for (const m of r.missing) missingMap[m.key] = m;
  return {
    date,
    rows,
    invoices: rows.length,
    revenue: sum("retail"), tax: sum("tax"), cogs: sum("totalCost"),
    tireCost: sum("tireCost"), tpmsCost: sum("tpmsCost"), oilCost: sum("oilCost"),
    grossProfit: sum("totalProfit"),
    commissions: sum("commission"), commissionsByRep,
    partnerA: sum("partnerA"), partnerB: sum("partnerB"),
    tireQty: rows.reduce((s, r) => s + r.tireQty, 0),
    tpmsQty: rows.reduce((s, r) => s + (r.tpmsQty || 0), 0),
    oilQty: rows.reduce((s, r) => s + (r.oilQty || 0), 0),
    missing: Object.values(missingMap),
    flags: {
      negative: rows.filter((r) => r.flags.includes("negative")).length,
      low: rows.filter((r) => r.flags.includes("low")).length,
      high: rows.filter((r) => r.flags.includes("high")).length,
      pickup: rows.filter((r) => r.flags.includes("pickup")).length,
      missing: rows.filter((r) => r.flags.includes("missing")).length,
    },
  };
}

// Aggregate a week of computed days into the summary sheet.
export function computeWeek(days, cfg = PNL_CONFIG) {
  const sum = (f) => r2(days.reduce((s, d) => s + (d[f] || 0), 0));
  const commissionsByRep = {};
  for (const d of days) for (const [rep, amt] of Object.entries(d.commissionsByRep || {})) commissionsByRep[rep] = r2((commissionsByRep[rep] || 0) + amt);
  const revenue = sum("revenue"), cogs = sum("cogs"), grossProfit = sum("grossProfit");
  const commissions = sum("commissions"), rent = cfg.rentPerWeek;
  return {
    days: days.length, revenue, tax: sum("tax"), cogs, grossProfit,
    commissions, commissionsByRep, rent,
    partnerA: sum("partnerA"), partnerB: sum("partnerB"),
    tireQty: days.reduce((s, d) => s + (d.tireQty || 0), 0),
    net: r2(grossProfit - rent - commissions),
  };
}
