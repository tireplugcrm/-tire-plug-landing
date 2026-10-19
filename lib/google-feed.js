// Google Merchant Center feeds for free local listings ("cheap tires near me", "<size> tires near me").
// Two feeds, both rebuilt on every fetch from the same in-stock tires the /tires pages show:
//   /feeds/google-products.xml         primary feed: what each tire is, its price, its page
//   /feeds/google-local-inventory.xml  local inventory feed: that it's on the shelf at our store
// Only tires with a public price (lib/pricing.js) go in; cost and unit counts never do.
// SERVER ONLY.
import crypto from "crypto";
import { pricedStock } from "./inventory";
import { INSTALL_FROM, sizeToSlug } from "./tire-catalog";

const SITE = "https://tireplugla.com";
// Must match the store code on the Google Business Profile (Business Profile > Advanced settings).
export const STORE_CODE = process.env.GOOGLE_STORE_CODE || "TIREPLUG-OLYMPIC";
const CATEGORY = "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Wheel Systems > Motor Vehicle Tires";

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const price = (n) => `${Number(n).toFixed(2)} USD`;

// Stable, readable id (Merchant Center allows 50 characters): kumho-solusta31-205-55r16-p
export function feedId(t) {
  const id = [norm(t.brand), norm(t.model), sizeToSlug(t.key), t.lt ? "lt" : "p"].join("-");
  if (id.length <= 50) return id;
  const hash = crypto.createHash("sha1").update(id).digest("hex").slice(0, 8);
  return `${id.slice(0, 41)}-${hash}`;
}

function item(t) {
  const size = t.key.replace("X", "x");
  const s = t.specs || {};
  const fit = [s.loadIndex ? `${s.loadIndex}${s.speed || ""}` : "", s.loadRange === "XL" ? "XL" : "", t.lt ? "LT" : ""].filter(Boolean).join(" ");
  const title = `${t.brand} ${t.model} ${size}${fit ? ` ${fit}` : ""} Tire`;
  const description = [
    `${t.brand} ${t.model} in ${size}${t.category ? `, ${t.category.toLowerCase()}` : ""}.`,
    t.about || "",
    `In stock at The Tire Plug, 2331 E Olympic Blvd, Los Angeles, CA 90021. Installed today: mount and balance from $${INSTALL_FROM} per wheel.`,
    "Financing available: pay over time with Snap Finance, ask in store. Open 7 days, (562) 500-4625.",
  ].filter(Boolean).join(" ");
  const img = (t.imgGeneric ? "/images/tires/generic-tire.png" : t.img);
  return {
    id: feedId(t),
    title: title.slice(0, 150),
    description: description.slice(0, 5000),
    link: `${SITE}/tires/${sizeToSlug(t.key)}`,
    image_link: `${SITE}${img}`,
    price: price(t.price),
    availability: t.level === "low" ? "limited_availability" : "in_stock",
    brand: t.brand,
    mpn: s.partNumber || null,
    // We don't have UPCs from Tekmetric; brand + part number is enough when we have one.
    identifier_exists: s.partNumber ? null : "no",
    condition: "new",
    google_product_category: CATEGORY,
    product_type: `Tires > ${t.rim}" > ${size}`,
  };
}

export async function feedItems() {
  // A tire listed twice in Tekmetric (same brand, model, size) becomes one item.
  const seen = new Set();
  return (await pricedStock()).map(item).filter((i) => !seen.has(i.id) && seen.add(i.id));
}

const tag = (k, v) => (v == null || v === "" ? "" : `<g:${k}>${esc(v)}</g:${k}>`);
function rss(title, items, fields) {
  const body = items.map((i) => `<item>${fields.map((f) => tag(f, i[f])).join("")}</item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n<title>${esc(title)}</title>\n<link>${SITE}/tires</link>\n<description>In-stock tires at The Tire Plug, Los Angeles</description>\n${body}\n</channel>\n</rss>\n`;
}

const PRODUCT_FIELDS = ["id", "title", "description", "link", "image_link", "price", "availability", "brand", "mpn", "identifier_exists", "condition", "google_product_category", "product_type"];
export const productsXml = (items) => rss("The Tire Plug: in-stock tires", items, PRODUCT_FIELDS);
export const localInventoryXml = (items) => rss("The Tire Plug: local inventory",
  items.map((i) => ({ store_code: STORE_CODE, id: i.id, availability: i.availability, price: i.price })),
  ["store_code", "id", "availability", "price"]);

// Shared handler for the two feed pages. An empty list means prices or stock couldn't be read:
// answer 503 so Merchant Center keeps yesterday's items instead of deleting them all.
export async function serveFeed(res, build) {
  const items = await feedItems();
  if (!items.length) {
    res.statusCode = 503;
    res.setHeader("Retry-After", "3600");
    res.setHeader("Cache-Control", "no-store");
    res.end("Feed temporarily unavailable");
    return;
  }
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
  res.end(build(items));
}
