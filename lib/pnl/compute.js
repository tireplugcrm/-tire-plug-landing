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
  tpmsCost: 15,           // our cost per TPMS sensor (COGS)
  commissionRate: 0.10,   // 10% of adjusted profit
  rentPerWeek: 4750,
  eligibleReps: ["Belen Moana", "Jonathan Alatorre", "Dennis Bliznuk", "Oscar Landaverde", "Alex"],
  pickupKeywords: ["Mobile", "Tow", "Fleet", "Body", "Repair", "Shop", "Tires", "Motor", "Parts", "Transport", "Auto", "Wholesale"],
};

const r2 = (n) => Math.round(n * 100) / 100;
const firstToken = (s) => String(s || "").trim().split(/\s+/)[0].toLowerCase();

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
  const tires = (inv.lines || []).filter((l) => l.isTire);
  const tpms = (inv.lines || []).filter((l) => l.isTPMS);
  const aligns = (inv.lines || []).filter((l) => l.isAlignment);

  const tireQty = tires.reduce((s, l) => s + l.qty, 0);
  const tpmsQty = tpms.reduce((s, l) => s + l.qty, 0);
  const alignCount = aligns.reduce((s, l) => s + (l.qty || 1), 0);

  // Tire (product) cost from the shared cost memory; track any we don't know yet.
  const missing = [];
  let productCost = 0;
  const tireDetail = tires.map((l) => {
    const key = normalizeDesc(l.description);
    const c = costByKey[key];
    if (!c) missing.push({ key, description: l.description, qty: l.qty });
    const unit = c ? Number(c.unit_cost) : null;
    if (unit != null) productCost += unit * l.qty;
    return { description: l.description, qty: l.qty, unit_price: l.unit_price, retail: l.total, unit_cost: unit, key };
  });
  const hasAllCosts = missing.length === 0;

  const etcCost = tpmsQty * cfg.tpmsCost;            // TPMS sensors (COGS)
  const totalCost = r2(productCost + etcCost);        // COGS
  const retail = r2(inv.subtotal);                    // pre-tax revenue
  const tax = r2(inv.tax);
  const totalProfit = r2(retail - totalCost);         // gross profit (real costs)

  const pickup = isPickupCustomer(inv.customer, cfg);
  const perTire = pickup ? cfg.pickupPerTire : cfg.installPerTire;
  const adjustedCost = r2(productCost + perTire * tireQty + cfg.perAlignment * alignCount);
  const adjustedProfit = r2(retail - adjustedCost);
  const eligible = isEligibleRep(inv.rep, cfg);
  const commission = eligible ? Math.max(0, Math.trunc(adjustedProfit * cfg.commissionRate)) : 0;

  // Per-invoice flags
  const netPerTire = tireQty ? totalProfit / tireQty : null;
  const flags = [];
  if (hasAllCosts && totalCost > retail) flags.push("negative");      // 🟥
  if (netPerTire != null && hasAllCosts && netPerTire < 30) flags.push("low");   // 🟨
  if (netPerTire != null && hasAllCosts && netPerTire > 60) flags.push("high");  // 🟩
  if (pickup) flags.push("pickup");                                   // 📦
  if (!hasAllCosts) flags.push("missing");                            // 🟧

  // 50/50 partner split on gross profit (rent + commission settle separately)
  const gp = totalProfit;
  const partnerA = r2(totalCost + 0.5 * gp + 0.5 * tax);  // COGS + 50% GP + 50% tax
  const partnerB = r2(0.5 * gp + 0.5 * tax);

  return {
    inv_no: inv.inv_no, detail_no: inv.detail_no, rep: inv.rep, customer: inv.customer,
    cust_type: inv.cust_type, payment_method: inv.payment_method,
    description: tireDetail.map((t) => t.description).join(" · ") || summarize(inv.lines),
    tireQty, tpmsQty, alignCount, pickup, eligible,
    productCost: r2(productCost), etcCost: r2(etcCost), totalCost, retail, tax,
    adjustedCost, adjustedProfit, commission,
    totalProfit, netPerTire: netPerTire == null ? null : r2(netPerTire),
    partnerA, partnerB, missing, hasAllCosts, flags, lines: inv.lines || [],
  };
}

function summarize(lines = []) {
  const al = lines.some((l) => l.isAlignment) ? "Alignment" : null;
  const tp = lines.some((l) => l.isTPMS) ? "TPMS" : null;
  const lb = lines.some((l) => l.isLabor) ? "Labor" : null;
  return [al, tp, lb].filter(Boolean).join(" · ") || "—";
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
    grossProfit: sum("totalProfit"),
    commissions: sum("commission"), commissionsByRep,
    partnerA: sum("partnerA"), partnerB: sum("partnerB"),
    tireQty: rows.reduce((s, r) => s + r.tireQty, 0),
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
