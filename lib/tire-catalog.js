// Single source of truth for every tire we list on the site.
// Brand pages (RBP, Kumho), the size search (/tires) and the sitemap all read from here,
// so a price changed here changes everywhere. Prices are per tire, product only.
import rbpCatalog from "./rbp-catalog-data.js";

// Mount + balance, charged on top of the product-only price.
export const INSTALL_FROM = 25;

// ---------------- RBP ----------------
export const RBP_AT = "Repulsor A/T Plateau";
export const RBP_RT = "Repulsor R/T";
export const RBP_XT = "Repulsor X/T";
export const RBP_MT = "Repulsor M/T";
// Every RBP size we list: generated from Turbo's RBP list and our shelf costs by
// scripts/rbp-catalog-turbo.mjs (shelf cost + $20 for sizes we stock, Turbo + FET + $20 for the rest).
// Prices per tire, tire only (install not included). Each size: [size, load/speed, ply, price]
export const RBP_CATALOG = rbpCatalog;
// Photo per RBP line on the cards (null until we have one).
export const RBP_IMG = {
  [RBP_AT]: "/images/rbp/repulsor-at-plateau.png", [RBP_RT]: "/images/rbp/repulsor-rt.png",
  [RBP_XT]: "/images/rbp/repulsor-xt.png", [RBP_MT]: "/images/rbp/repulsor-mt3.png",
};

// ---------------- Kumho ----------------
// Specs from Kumho USA (kumhotireusa.com).
export const KUMHO_MODELS = [
  {
    id: "ecsta-pa71",
    name: "Ecsta Sport A/S",
    code: "PA71",
    category: "Ultra-high-performance all-season",
    fits: "sport sedans, coupes & EVs",
    img: "/images/kumho/ecsta-pa71.jpg",
    benefits: ["Strong grip, wet or dry", "Sharp, responsive handling", "Even wear for longer tread life", "Quieter ride"],
    chips: ["50,000-mile treadwear warranty"],
    sizes: [["225/40ZR18", "92Y XL", 99.75], ["235/40ZR18", "95Y XL", 112.25], ["235/45ZR18", "98Y XL", 109.75]],
  },
  {
    id: "majesty-9-ta91",
    name: "Majesty 9 Solus TA91 EV",
    code: "TA91",
    category: "Grand touring all-season · EV",
    fits: "Tesla & electric vehicles",
    img: "/images/kumho/majesty-9-ta91.jpg",
    tesla: true,
    benefits: ["Noise-reducing foam inside the tire", "Built for EV torque and weight", "Quiet, comfortable ride", "All-season grip"],
    chips: ["Foam for Teslas", "50,000-mile treadwear warranty"],
    sizes: [["255/45R19", "104V XL", 154.75]],
  },
  {
    id: "crugen-hp71",
    name: "Crugen HP71",
    code: "HP71",
    category: "All-season touring for SUVs & CUVs",
    fits: "SUVs & crossovers",
    img: "/images/kumho/crugen-hp71.jpg",
    benefits: ["Wet grip, resists hydroplaning", "Quiet, comfortable ride", "Long tread life", "Extra winter traction"],
    chips: ["65,000-mile treadwear warranty"],
    sizes: [["235/55R18", "104V XL", 87]],
  },
  {
    id: "road-venture-ht52",
    name: "Road Venture HT",
    code: "HT52",
    category: "All-season highway terrain",
    fits: "trucks & SUVs",
    img: "/images/kumho/road-venture-ht52.jpg",
    benefits: ["Long tread life", "Resists hydroplaning", "Snow grip (3PMSF rated)", "Quiet on the highway"],
    chips: ["75,000-mile treadwear warranty", "3PMSF snow rated"],
    sizes: [["265/70R17", "115T", 139.75]],
  },
  {
    id: "road-venture-rt51",
    name: "Road Venture RT",
    code: "RT51",
    category: "Rugged terrain",
    fits: "trucks & SUVs",
    img: "/images/kumho/road-venture-rt51.jpg",
    benefits: ["Strong wet traction and braking", "Better grip off the pavement", "Resists cuts and chips", "Rim protection, stone ejectors"],
    chips: ["50,000-mile treadwear warranty"],
    sizes: [["265/70R17", "116T XL", 174.0]],
  },
];

// ---------------- Size search helpers ----------------
// "LT265/70R17", "265/70ZR17", "35X12.50R20LT" -> "265/70R17" / "35X12.50R20" (search key).
export function sizeKey(size) {
  let s = String(size).toUpperCase().replace(/\s+/g, "");
  s = s.replace(/^LT/, "").replace(/LT$/, "").replace("ZR", "R");
  return s;
}
export const isLT = (size) => /^LT/i.test(size) || /LT$/i.test(size);
// "265/70R17" <-> "265-70r17" (URL slug)
export const sizeToSlug = (key) => key.toLowerCase().replace(/\//g, "-");
export const slugToKey = (slug) => String(slug).toUpperCase().replace(/-/g, "/").replace(/^(\d+X[\d.]+)\/?R/, "$1R");

// Every listed tire as one flat list.
export function allTires() {
  const out = [];
  for (const c of RBP_CATALOG) {
    for (const g of c.groups) {
      for (const [size, loadSpeed, ply, price] of g.sizes) {
        out.push({
          brand: "RBP", model: g.model, category: g.note, size, key: sizeKey(size), rim: c.rim,
          loadSpeed, ply: ply || "", price, lt: isLT(size),
          img: RBP_IMG[g.model] || null,
          page: "/rbp-tires-los-angeles", logo: "/images/rbp/rbp-logo.png",
        });
      }
    }
  }
  for (const m of KUMHO_MODELS) {
    for (const [size, loadSpeed, price] of m.sizes) {
      out.push({
        brand: "Kumho", model: m.name, category: m.category, size, key: sizeKey(size),
        rim: Number(String(size).match(/R(\d+)/)[1]), loadSpeed, ply: "", price, lt: isLT(size),
        img: m.img, page: `/kumho-tires-los-angeles#${m.id}`, logo: "/images/kumho/kumho-logo.png",
        special: "Buy 4, get a 4-wheel alignment for $49",
      });
    }
  }
  return out;
}

export function tiresForSize(key) {
  return allTires().filter((t) => t.key === key).sort((a, b) => a.price - b.price);
}

// Unique sizes, grouped by rim, with how many options and the lowest price.
export function sizeIndex() {
  const map = new Map();
  for (const t of allTires()) {
    const cur = map.get(t.key) || { key: t.key, slug: sizeToSlug(t.key), rim: t.rim, count: 0, from: Infinity };
    cur.count += 1;
    cur.from = Math.min(cur.from, t.price);
    map.set(t.key, cur);
  }
  return [...map.values()].sort((a, b) => a.rim - b.rim || a.key.localeCompare(b.key, "en", { numeric: true }));
}
