// Email-safe copies of the logo and tire photos. Outlook (desktop) can't show .webp, so the
// email templates use the PNG/JPG files this writes into public/images/email/.
// Rerun after adding tire photos:  node scripts/email-images.mjs
import sharp from "sharp";
import { readdirSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const out = path.join(root, "public/images/email");
mkdirSync(path.join(out, "tires"), { recursive: true });

// Logo: trim the white margin, then a 2x-retina PNG on white.
await sharp(path.join(root, "public/images/logo.webp"))
  .flatten({ background: "#ffffff" }).trim({ threshold: 20 })
  .resize({ width: 320, withoutEnlargement: true })
  .extend({ top: 12, bottom: 12, left: 12, right: 12, background: "#ffffff" })
  .png().toFile(path.join(out, "logo.png"));

// Tire photos: small white-background JPGs for the deal cards.
const dir = path.join(root, "public/images/tires");
let n = 0;
for (const f of readdirSync(dir).filter((f) => f.endsWith(".webp"))) {
  await sharp(path.join(dir, f)).flatten({ background: "#ffffff" })
    .resize({ width: 280, height: 280, fit: "contain", background: "#ffffff" })
    .jpeg({ quality: 78 }).toFile(path.join(out, "tires", f.replace(/\.webp$/, ".jpg")));
  n += 1;
}
// Brand logos: email clients (Gmail, Outlook) don't show SVG, so every brand logo gets a PNG,
// 2x size for a 32px-tall display. Light-colored logos sit on a dark plate, like on the site.
const ON_DARK = new Set(["blackhawk", "goodyear", "prinx"]);
mkdirSync(path.join(out, "brands"), { recursive: true });
const logos = [
  ...readdirSync(path.join(root, "public/images/brands")).map((f) => path.join(root, "public/images/brands", f)),
  path.join(root, "public/images/kumho/kumho-logo.png"),
  path.join(root, "public/images/rbp/rbp-logo.png"),
];
let b = 0;
for (const src of logos) {
  const base = path.basename(src).replace(/\.\w+$/, "");
  const plate = ON_DARK.has(base) ? "#111111" : "#ffffff";
  await sharp(src, { density: 300 }).flatten({ background: plate }).trim({ threshold: 10 })
    .resize({ height: 64, width: 320, fit: "inside", withoutEnlargement: false })
    .extend({ top: 10, bottom: 10, left: 14, right: 14, background: plate })
    .png().toFile(path.join(out, "brands", `${base}.png`));
  b += 1;
}
console.log(`logo + ${n} tire photos + ${b} brand logos -> public/images/email/`);
