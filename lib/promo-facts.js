// Prices and ranges the homepage promo slides quote, read from the same stock and catalog the
// /tires pages use, so a slide can't drift from the page it links to. SERVER ONLY.
import { stockForSize } from "./inventory";
import { allTires, RBP_AT, INSTALL_FROM } from "./tire-catalog";

// Landspider special: the 10 sizes received from the October 2026 Landspider buy.
export const LANDSPIDER_LINES = [
  { model: "Citytraxx G/P", title: "Citytraxx G/P", sub: "Everyday all-season for sedans and compacts", sizes: ["195/65R15", "205/65R15", "205/55R16", "205/60R16", "215/60R16", "215/55R17"] },
  { model: "Citytraxx H/P", title: "Citytraxx H/P", sub: "Performance all-season for coupes, sedans and crossovers", sizes: ["235/45R18", "235/40R19", "245/50R20"] },
  { model: "Citytraxx H/T", title: "Citytraxx H/T", sub: "Highway all-season for SUVs and crossovers", sizes: ["235/60R18"] },
];

const rimOf = (key) => Number(String(key).match(/R(\d{2})$/)?.[1]);
const minOf = (list) => (list.length ? Math.min(...list) : null);

// Landspider tires on the shelf, by line (sold-out sizes drop off on their own).
export async function landspiderStock() {
  const lines = [];
  for (const line of LANDSPIDER_LINES) {
    const tires = [];
    for (const size of line.sizes) {
      for (const t of await stockForSize(size)) if (t.brand === "Landspider" && t.model === line.model) tires.push({ ...t, size });
    }
    lines.push({ ...line, tires });
  }
  return lines;
}

export async function promoFacts() {
  const remington = (await stockForSize("155/80R13")).find((t) => t.brand === "Remington" && t.price != null);
  const ls = (await landspiderStock()).flatMap((l) => l.tires);
  const lsRims = ls.map((t) => rimOf(t.size));
  const catalog = allTires();
  const kumho = catalog.filter((t) => t.brand === "Kumho");
  const rbpAt = catalog.filter((t) => t.brand === "RBP" && t.model === RBP_AT);
  return {
    install: INSTALL_FROM,
    remington: remington ? remington.price : null,
    landspider: { from: minOf(ls.filter((t) => t.price != null).map((t) => t.price)), sizes: ls.length, rimMin: minOf(lsRims), rimMax: lsRims.length ? Math.max(...lsRims) : null },
    kumhoFrom: minOf(kumho.map((t) => t.price)),
    rbpAt: { from: minOf(rbpAt.map((t) => t.price)), rimMin: minOf(rbpAt.map((t) => t.rim)), rimMax: Math.max(...rbpAt.map((t) => t.rim)) },
  };
}
