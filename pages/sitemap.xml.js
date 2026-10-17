import { allSizes } from "../lib/inventory";

// Generated sitemap: the fixed pages below plus one entry per tire size page (/tires/<size>),
// so every size added to lib/tire-catalog.js or stocked in Tekmetric reaches Google automatically.
const BASE = "https://tireplugla.com";
const PAGES = [
  ["/", "weekly", "1.0"],
  ["/tires", "weekly", "0.9"],
  ["/olympic", "monthly", "0.8"],
  ["/new-tires-los-angeles", "monthly", "0.8"],
  ["/rbp-tires-los-angeles", "weekly", "0.8"],
  ["/kumho-tires-los-angeles", "weekly", "0.8"],
  ["/landspider-tires-los-angeles", "weekly", "0.8"],
  ["/used-tires-los-angeles", "monthly", "0.8"],
  ["/wheel-alignment-los-angeles", "monthly", "0.8"],
  ["/oil-change-los-angeles", "monthly", "0.8"],
  ["/tpms-sensors-los-angeles", "monthly", "0.7"],
  ["/brake-service-los-angeles", "monthly", "0.7"],
  ["/tire-shop-near-me-faq", "monthly", "0.8"],
  ["/tire-size-guide", "monthly", "0.7"],
  ["/careers", "monthly", "0.6"],
  ["/sms", "yearly", "0.4"],
  ["/privacy", "yearly", "0.3"],
  ["/terms", "yearly", "0.3"],
];

export async function getServerSideProps({ res }) {
  const sizes = (await allSizes()).map((s) => [`/tires/${s.slug}`, "weekly", "0.7"]);
  const urls = [...PAGES, ...sizes]
    .map(([path, freq, prio]) => `  <url><loc>${BASE}${path}</loc><changefreq>${freq}</changefreq><priority>${prio}</priority></url>`)
    .join("\n");
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  res.end();
  return { props: {} };
}

export default function Sitemap() {
  return null;
}
