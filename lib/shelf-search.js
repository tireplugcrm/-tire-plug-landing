// Find tires on our shelf for the Shop Floor tire picker: "225/45R17", "2254517", "michelin",
// "falken 17". Every word must match the size (digits) or the brand/model. Server-only.
import { shelfTires } from "./inventory.js";

const digits = (s) => String(s).replace(/\D/g, "");
const text = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

export async function searchShelf(q, limit = 24) {
  const words = String(q || "").toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (!words.length) return [];
  const tires = await shelfTires();
  return tires
    .filter((t) => {
      const name = text(`${t.brand} ${t.model}`), size = digits(t.key);
      return words.every((w) => (/\d/.test(w) && digits(w).length >= 2 ? size.includes(digits(w)) : name.includes(text(w))));
    })
    .sort((a, b) => (a.level === b.level ? 0 : a.level === "in" ? -1 : 1) || a.key.localeCompare(b.key, "en", { numeric: true }) || a.brand.localeCompare(b.brand))
    .slice(0, limit)
    .map((t) => ({
      brand: t.brand, model: t.model, size: t.key, img: t.img, imgGeneric: !!t.imgGeneric, logo: t.logo || null,
      level: t.level, count: t.count || null, category: t.category || null,
    }));
}

// The shelf tire a booking picked on /book (leads.tire_type is "Brand Model"), for its photo.
export async function findShelfTire(size, name) {
  if (!size || !name) return null;
  const t = (await shelfTires()).find((x) => x.key === size && text(`${x.brand} ${x.model}`) === text(name));
  return t ? { tire_brand: t.brand, tire_model: t.model, tire_img: t.imgGeneric ? null : t.img } : null;
}
