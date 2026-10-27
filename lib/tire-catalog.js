// Single source of truth for every tire we list on the site.
// Brand pages (RBP, Kumho), the size search (/tires) and the sitemap all read from here,
// so a price changed here changes everywhere. Prices are per tire, product only.

// Mount + balance, charged on top of the product-only price.
export const INSTALL_FROM = 25;

// ---------------- RBP ----------------
export const RBP_AT = "Repulsor A/T Plateau";
export const RBP_RT = "Repulsor R/T";
// Prices per tire, tire only (install not included). Each size: [size, load/speed, ply, price]
export const RBP_CATALOG = [
  { rim: 15, groups: [{ model: RBP_AT, note: "All-terrain", sizes: [
    ["235/75R15", "109T", "", 99], ["255/70R15", "108S", "", 120], ["265/70R15", "112S", "", 130],
    ["31X10.50R15LT", "109S", "C/6", 130], ["LT235/75R15", "116/113R", "E/10", 136],
  ] }] },
  { rim: 16, groups: [{ model: RBP_AT, note: "All-terrain", sizes: [
    ["245/70R16", "106S", "", 101], ["245/75R16", "115T", "", 111], ["255/70R16", "115T", "", 125],
    ["265/70R16", "112T", "", 119], ["265/75R16", "116T", "", 125], ["LT215/85R16", "115/112R", "E/10", 125],
    ["LT225/75R16", "115/112S", "E/10", 115], ["LT235/85R16", "120/116S", "E/10", 130], ["LT245/75R16", "120/116S", "E/10", 119],
    ["LT265/70R16", "117/114S", "D/8", 130], ["LT265/75R16", "123/120S", "E/10", 135], ["LT285/75R16", "126/123R", "E/10", 160],
    ["LT315/75R16", "127/124R", "E/10", 210],
  ] }] },
  { rim: 17, groups: [{ model: RBP_AT, note: "All-terrain", sizes: [
    ["225/65R17", "106T", "", 100], ["235/65R17", "104H", "", 115], ["245/65R17", "111T", "", 110],
    ["245/70R17", "114T", "", 110], ["255/65R17", "114T", "", 117], ["255/70R17", "112T", "", 136],
    ["265/65R17", "116T", "", 125], ["265/70R17", "115T", "", 125], ["285/70R17", "117T", "", 145],
    ["LT235/70R17", "120/117R", "E/10", 135], ["LT235/80R17", "120/117R", "E/10", 125], ["LT245/70R17", "119/116S", "E/10", 125],
    ["LT265/70R17", "123/120S", "E/10", 140], ["LT285/70R17", "126/123S", "E/10", 155],
  ] }] },
  { rim: 18, groups: [{ model: RBP_AT, note: "All-terrain", sizes: [
    ["245/60R18", "105H", "", 135], ["255/70R18", "113T", "", 130], ["265/60R18", "114T", "", 136],
    ["265/65R18", "114T", "", 135], ["265/70R18", "116T", "", 130], ["275/65R18", "116T", "", 150],
    ["LT265/65R18", "122/119R", "E/10", 165], ["LT265/70R18", "124/121S", "E/10", 149], ["LT275/65R18", "123/120S", "E/10", 150],
    ["LT275/70R18", "125/122S", "E/10", 155], ["LT285/65R18", "125/122S", "E/10", 165], ["LT295/70R18", "129/126R", "E/10", 210],
    ["LT305/65R18", "128/125R", "F/12", 210], ["LT325/65R18", "121/118T", "D/8", 205],
  ] }] },
  { rim: 20, groups: [{ model: RBP_AT, note: "All-terrain", sizes: [
    ["265/50R20", "111H", "", 140], ["275/55R20", "117T", "", 135], ["275/60R20", "115T", "", 145],
    ["35X12.50R20LT", "125R", "F/12", 200], ["LT265/60R20", "121/118S", "E/10", 165], ["LT275/65R20", "126/123S", "E/10", 155],
    ["LT285/60R20", "125/122R", "E/10", 175],
  ] }] },
  { rim: 22, groups: [
    { model: RBP_AT, note: "All-terrain", sizes: [["285/45R22", "114T", "", 150]] },
    { model: RBP_RT, note: "Rugged-terrain", sizes: [["33X13.50R22", "109Q", "F/12", 230], ["35X13.50R22", "122Q", "F/12", 270], ["305/45R22", "118V", "", 185]] },
  ] },
  { rim: 24, groups: [
    { model: RBP_AT, note: "All-terrain", sizes: [["305/35R24", "112H", "", 180]] },
    { model: RBP_RT, note: "Rugged-terrain", sizes: [
      ["33X12.50R24", "106Q", "F/12", 232], ["35X12.50R24", "116Q", "F/12", 275], ["33X13.50R24", "102Q", "F/12", 240],
      ["35X13.50R24", "118Q", "E/10", 264], ["305/35R24", "112V", "", 190], ["285/40R24", "112H", "", 185],
    ] },
  ] },
];

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
          img: g.model === RBP_AT ? "/images/rbp/repulsor-at-plateau.png" : null,
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
