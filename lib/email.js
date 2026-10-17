/**
 * Shared email layer for every marketing email the shop sends (blasts, customer campaigns,
 * business outreach, the welcome email). One place for:
 *   - the branded templates (logo, Google rating, a real review, shop address)
 *   - working unsubscribe links + Gmail/Yahoo one-click unsubscribe headers
 *   - the suppression list (unsubscribed, bounced, complained) every send checks
 *   - Resend batch sending, tagged with the campaign id so opens/clicks come back
 *
 * Env: RESEND_API_KEY, RESEND_FROM, RESEND_REPLY_TO,
 *      RESEND_OUTREACH_FROM (business cold email; ideally a separate subdomain),
 *      EMAIL_UNSUB_SECRET (signs unsubscribe links), NEXT_PUBLIC_SITE_URL.
 */
import crypto from "node:crypto";
import { supabaseAdmin } from "./supabaseAdmin.js";
import { REVIEWS_FALLBACK } from "./reviews-fallback.js";
import nextDay from "../data/next-day.json";
import modelInfo from "../data/tire-models.json";
import { sizeToSlug, INSTALL_FROM } from "./tire-catalog.js";
import { brandLogo } from "./tire-brands.js";

export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://tireplugla.com").replace(/\/$/, "");
export const FROM = process.env.RESEND_FROM || "The Tire Plug <deals@tireplugla.com>";
export const OUTREACH_FROM = process.env.RESEND_OUTREACH_FROM || FROM;
export const REPLY_TO = process.env.RESEND_REPLY_TO || "tiredepotplug@gmail.com";

// Reputation shown in every email. Same numbers as the website; keep them true.
export const BRAND = {
  name: "The Tire Plug",
  phone: "562-500-4625",
  address: "2331 E Olympic Blvd, Los Angeles, CA 90021",
  hours: "Open 7 days · Mon–Fri 9–7, Sat 9–6, Sun 10–4",
  logo: `${SITE}/images/email/logo.png`,
  rating: "5.0",
  vehicles: "10,000+",
  instagram: "130K",
};

const RED = "#E01B22";
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const linkify = (s) => s.replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="color:${RED};">$1</a>`);
export const firstName = (n) => (n || "").trim().split(/\s+/)[0] || "there";

// {name}/{first} -> first name, {business} -> business name.
export function personalize(text, { name, business } = {}) {
  return String(text || "")
    .replace(/\{(name|first)\}/gi, firstName(name))
    .replace(/\{business\}/gi, (business || "").trim() || "your team");
}

/* ---------------- unsubscribe ---------------- */
const secret = () => process.env.EMAIL_UNSUB_SECRET || process.env.CAREERS_ADMIN_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY || "tireplug";
const b64u = (s) => Buffer.from(s).toString("base64url");
export const unsubSig = (email) => crypto.createHmac("sha256", secret()).update(String(email).trim().toLowerCase()).digest("hex").slice(0, 24);
export function unsubParams(email) { return `e=${b64u(String(email).trim().toLowerCase())}&t=${unsubSig(email)}`; }
export const unsubPageUrl = (email) => `${SITE}/unsubscribe?${unsubParams(email)}`;
export const unsubApiUrl = (email) => `${SITE}/api/unsubscribe?${unsubParams(email)}`;
export function readUnsub({ e, t }) {
  try {
    const email = Buffer.from(String(e || ""), "base64url").toString("utf8");
    if (!/\S+@\S+\.\S+/.test(email)) return null;
    const a = Buffer.from(unsubSig(email)), b = Buffer.from(String(t || ""));
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? email : null;
  } catch { return null; }
}

// Everyone who must never get marketing email again.
export async function suppressedSet() {
  const set = new Set();
  if (!supabaseAdmin) return set;
  const { data } = await supabaseAdmin.from("email_suppressions").select("email");
  (data || []).forEach((r) => r.email && set.add(r.email.toLowerCase()));
  const { data: subs } = await supabaseAdmin.from("subscribers").select("email").eq("status", "unsubscribed");
  (subs || []).forEach((r) => r.email && set.add(r.email.toLowerCase()));
  return set;
}

export async function suppress(email, reason = "unsubscribed") {
  const e = String(email || "").trim().toLowerCase();
  if (!e || !supabaseAdmin) return;
  await supabaseAdmin.from("email_suppressions").upsert({ email: e, reason }, { onConflict: "email" });
  await supabaseAdmin.from("subscribers").update({ status: "unsubscribed" }).ilike("email", e);
  await supabaseAdmin.from("business_prospects").update({ status: reason === "unsubscribed" ? "unsubscribed" : "bounced" }).ilike("email", e);
}

/* ---------------- tire deal cards ---------------- */
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const MODELS = new Map(Object.entries(modelInfo.models).map(([k, v]) => [k.split("|").map(norm).join("|"), v]));
export const tireId = (t) => `${t.brand}|${t.model}|${t.key}`;

// Next-day tires the email builder can feature, cheapest first.
export function dealTires() {
  return nextDay.tires.map((t) => {
    const m = MODELS.get(`${norm(t.brand)}|${norm(t.model)}`) || {};
    const img = m.img ? `/images/email/tires/${m.img.split("/").pop().replace(/\.webp$/, ".jpg")}` : null;
    return { id: tireId(t), brand: t.brand, model: t.model, size: t.key, price: t.price, note: t.priceNote || "", category: m.category || "", img };
  }).sort((a, b) => a.price - b.price);
}

function tireCardsHtml(ids = []) {
  const all = new Map(dealTires().map((t) => [t.id, t]));
  const picked = ids.map((id) => all.get(id)).filter(Boolean).slice(0, 6);
  if (!picked.length) return "";
  const cell = (t) => `<td width="50%" valign="top" style="padding:6px;">
    <a href="${SITE}/tires/${sizeToSlug(t.size)}" style="text-decoration:none;display:block;background:#fff;border:1px solid #e6e6e6;border-radius:12px;padding:14px;text-align:center;">
      ${t.img ? `<img src="${SITE}${t.img}" width="120" height="120" alt="${esc(t.brand)} ${esc(t.model)}" style="display:block;margin:0 auto 8px;border:0;width:120px;height:120px;"/>` : ""}
      <div style="color:#888;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${esc(t.brand)}</div>
      <div style="color:#111;font-size:14px;font-weight:700;line-height:1.3;margin:2px 0;">${esc(t.model)}</div>
      <div style="color:#666;font-size:12px;">${esc(t.size)}</div>
      <div style="color:${RED};font-size:22px;font-weight:900;margin-top:6px;">$${esc(t.price)}<span style="font-size:12px;color:#888;font-weight:600;"> /tire</span></div>
      ${t.note ? `<div style="color:#1a7f37;font-size:11px;font-weight:700;margin-top:2px;">${esc(t.note)}</div>` : ""}
    </a></td>`;
  let rows = "";
  for (let i = 0; i < picked.length; i += 2) rows += `<tr>${cell(picked[i])}${picked[i + 1] ? cell(picked[i + 1]) : '<td width="50%"></td>'}</tr>`;
  return `<tr><td style="padding:0 30px 8px;">
    <div style="color:#111;font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;text-align:center;margin:8px 0 6px;">Next-day tire deals</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    <div style="color:#999;font-size:11px;text-align:center;margin-top:4px;">Price per tire. Installed next day at our Olympic Blvd shop. Call to confirm your size.</div>
  </td></tr>`;
}

/* ---------------- tire order card ---------------- */
// What a /book customer ordered, from the tire name ("Goodyear Assurance Finesse"), size, qty, price.
// Brand logo and tire photo use the email-safe copies in public/images/email (scripts/email-images.mjs).
export function tireOrder({ name, size, qty, price }) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  let brand = words[0] || "", model = words.slice(1).join(" ");
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    const b = words.slice(0, n).join(" ");
    if (brandLogo(b)) { brand = b; model = words.slice(n).join(" "); break; }
  }
  const logoPath = brandLogo(brand);
  const m = MODELS.get(`${norm(brand)}|${norm(model)}`) || {};
  return {
    brand, model, size: size || "", qty: Number(qty) || null, price: Number(price) || null, category: m.category || "",
    logo: logoPath ? `${SITE}/images/email/brands/${logoPath.split("/").pop().replace(/\.\w+$/, "")}.png` : null,
    img: m.img ? `${SITE}/images/email/tires/${m.img.split("/").pop().replace(/\.webp$/, ".jpg")}` : null,
  };
}

const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;
function orderHtml(o) {
  const total = o.price && o.qty ? o.price * o.qty : null;
  return `<tr><td style="padding:2px 30px 14px;">
  <div style="color:#888;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px;">Your order</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;">
    <tr>
      ${o.img ? `<td width="130" valign="middle" align="center" style="padding:14px 6px 14px 14px;"><img src="${o.img}" width="116" height="116" alt="${esc(o.brand)} ${esc(o.model)}" style="display:block;border:0;width:116px;height:116px;"/></td>` : ""}
      <td valign="middle" style="padding:16px 18px 16px ${o.img ? 8 : 18}px;">
        ${o.badge ? `<div style="display:inline-block;background:${o.badge[1]}14;color:${o.badge[1]};font-size:12px;font-weight:700;padding:3px 8px;border-radius:4px;margin:0 0 8px;">${esc(o.badge[0])}</div>` : ""}
        ${o.logo ? `<img src="${o.logo}" height="26" alt="${esc(o.brand)}" style="display:block;border:0;height:26px;width:auto;border-radius:4px;margin:0 0 8px;"/>` : `<div style="color:#666;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">${esc(o.brand)}</div>`}
        <div style="color:#111;font-size:18px;font-weight:800;line-height:1.25;">${esc(o.model || o.brand)}</div>
        ${o.category ? `<div style="color:#777;font-size:13px;margin-top:2px;">${esc(o.category)}</div>` : ""}
        ${o.size ? `<div style="color:#15803d;font-size:13px;font-weight:700;margin-top:4px;">&#10003; ${esc(o.size)}</div>` : ""}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-top:1px solid #eee;"><tr>
          <td style="padding-top:8px;color:#444;font-size:14px;">${o.qty ? `${o.qty} tire${o.qty > 1 ? "s" : ""}` : ""}${o.qty && o.price ? " &times; " : ""}${o.price ? `${money(o.price)} each` : ""}</td>
          ${total ? `<td align="right" style="padding-top:8px;color:#111;font-size:18px;font-weight:800;">${money(total)}</td>` : ""}
        </tr></table>
        <div style="color:#999;font-size:12px;margin-top:4px;">Plus installation, from $${INSTALL_FROM} per wheel. Pay at the shop.</div>
      </td>
    </tr>
  </table>
</td></tr>`;
}

/* ---------------- reputation blocks ---------------- */
function pickReview(seed = "") {
  const list = REVIEWS_FALLBACK;
  let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}
const stars = `<span style="color:#FFB800;font-size:15px;letter-spacing:1px;">★★★★★</span>`;

function trustBar() {
  const item = (big, small) => `<td align="center" style="padding:10px 4px;"><div style="color:#111;font-size:18px;font-weight:900;">${big}</div><div style="color:#777;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${small}</div></td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;border-radius:12px;">
    <tr>${item(`${BRAND.rating} ★`, "Google rating")}${item(BRAND.vehicles, "Vehicles serviced")}${item(BRAND.instagram, "Instagram")}${item("7 days", "Open a week")}</tr></table>`;
}

function reviewBlock(seed) {
  const r = pickReview(seed);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid ${RED};">
    <tr><td style="padding:4px 0 4px 14px;">${stars}
      <div style="color:#333;font-size:14px;line-height:1.5;font-style:italic;margin:4px 0;">“${esc(r.text)}”</div>
      <div style="color:#888;font-size:12px;">— ${esc(r.name)}, Google review</div></td></tr></table>`;
}

function footer(unsubUrl, why) {
  return `<tr><td style="padding:22px 30px 28px;text-align:center;color:#999;font-size:11px;line-height:1.6;">
    <strong style="color:#666;">${BRAND.name}</strong> · ${BRAND.address}<br/>${BRAND.hours}<br/>
    ${why ? `${esc(why)}<br/>` : ""}
    ${unsubUrl ? `<a href="${unsubUrl}" style="color:#999;text-decoration:underline;">Unsubscribe</a>` : "Unsubscribe link appears here"}
  </td></tr>`;
}

const paragraphs = (msg, color = "#222") => String(msg || "").trim().split(/\n\s*\n/)
  .map((p) => `<p style="margin:0 0 16px;color:${color};font-size:16px;line-height:1.6;">${linkify(esc(p)).replace(/\n/g, "<br/>")}</p>`).join("");

const shell = (preheader, inner) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#efefef;font-family:Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader || "")}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efefef;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
${inner}
</table></td></tr></table></body></html>`;

/**
 * Promo template (blasts, customer campaigns, welcome): logo header, headline, message,
 * optional tire cards, call + quote buttons, trust bar and a real Google review.
 */
export function renderPromo({ subject, headline, message, preheader, tires = [], unsubUrl, why }) {
  return shell(preheader || subject, `
<tr><td style="height:5px;background:${RED};"></td></tr>
<tr><td align="center" style="padding:24px 30px 8px;"><a href="${SITE}"><img src="${BRAND.logo}" width="120" alt="The Tire Plug" style="display:block;border:0;width:120px;height:auto;"/></a></td></tr>
<tr><td align="center" style="padding:4px 30px 0;">${stars} <span style="color:#555;font-size:12px;font-weight:700;">${BRAND.rating} on Google · ${BRAND.vehicles} vehicles serviced</span></td></tr>
<tr><td style="padding:22px 30px 6px;text-align:center;"><h1 style="margin:0;color:#111;font-size:26px;font-weight:900;line-height:1.15;text-transform:uppercase;letter-spacing:-0.3px;">${esc(headline || subject || "")}</h1></td></tr>
<tr><td style="padding:14px 30px 4px;">${paragraphs(message)}</td></tr>
${tireCardsHtml(tires)}
<tr><td align="center" style="padding:14px 30px 24px;">
  <a href="tel:${BRAND.phone}" style="display:inline-block;background:${RED};color:#fff;padding:14px 26px;border-radius:8px;font-weight:800;font-size:14px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;margin:4px;">Call ${BRAND.phone}</a>
  <a href="${SITE}/book" style="display:inline-block;background:#111;color:#fff;padding:14px 26px;border-radius:8px;font-weight:800;font-size:14px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;margin:4px;">Get a quote</a>
</td></tr>
<tr><td style="padding:0 30px 18px;">${trustBar()}</td></tr>
<tr><td style="padding:4px 30px 8px;">${reviewBlock(subject)}</td></tr>
<tr><td style="padding:0 30px;"><div style="border-top:1px solid #eee;"></div></td></tr>
${footer(unsubUrl, why)}`);
}

/**
 * Letter template (business outreach): reads like a personal email on letterhead, which
 * lands in the inbox far more often than a flyer. Logo, the message, a signature with the
 * shop's reputation, one real review.
 */
export function renderLetter({ message, preheader, signer = {}, unsubUrl, why }) {
  const name = signer.name || "The Tire Plug Team";
  const title = signer.title || "Fleet & Commercial Accounts";
  return shell(preheader, `
<tr><td style="padding:26px 34px 6px;"><a href="${SITE}"><img src="${BRAND.logo}" width="96" alt="The Tire Plug" style="display:block;border:0;width:96px;height:auto;"/></a></td></tr>
<tr><td style="padding:16px 34px 4px;">${paragraphs(message, "#1f1f1f")}</td></tr>
<tr><td style="padding:0 34px 18px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td valign="top" style="padding-right:14px;border-right:3px solid ${RED};"><img src="${BRAND.logo}" width="64" alt="" style="display:block;border:0;width:64px;height:auto;"/></td>
    <td valign="top" style="padding-left:14px;font-size:13px;line-height:1.5;color:#444;">
      <strong style="color:#111;font-size:15px;">${esc(name)}</strong><br/>${esc(title)} · ${BRAND.name}<br/>
      <a href="tel:${BRAND.phone}" style="color:${RED};font-weight:700;text-decoration:none;">${BRAND.phone}</a> · <a href="${SITE}" style="color:#444;">tireplugla.com</a><br/>
      ${stars} <span style="font-size:12px;color:#555;">${BRAND.rating} Google rating · ${BRAND.vehicles} vehicles serviced</span>
    </td></tr></table>
</td></tr>
<tr><td style="padding:0 34px 20px;">${reviewBlock(message)}</td></tr>
<tr><td style="padding:0 34px;"><div style="border-top:1px solid #eee;"></div></td></tr>
${footer(unsubUrl, why)}`);
}

/**
 * Notice template (appointment confirmations, reminders, owner alerts): logo, headline, a short
 * message, a details card, and up to two buttons. Transactional, so no marketing unsubscribe.
 */
export function renderNotice({ headline, message, details = [], buttons = [], preheader, footerNote, order }) {
  const rows = details.filter(([, v]) => v).map(([k, v]) => `<tr>
    <td style="padding:8px 0;color:#888;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;width:90px;vertical-align:top;">${esc(k)}</td>
    <td style="padding:8px 0;color:#111;font-size:15px;font-weight:600;">${esc(v)}</td></tr>`).join("");
  const btns = buttons.map((b, i) => `<a href="${b.href}" style="display:inline-block;background:${i === 0 ? RED : "#111"};color:#fff;padding:13px 22px;border-radius:8px;font-weight:800;font-size:13px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;margin:4px;">${esc(b.label)}</a>`).join("");
  return shell(preheader || headline, `
<tr><td style="height:5px;background:${RED};"></td></tr>
<tr><td align="center" style="padding:24px 30px 4px;"><a href="${SITE}"><img src="${BRAND.logo}" width="110" alt="The Tire Plug" style="display:block;border:0;width:110px;height:auto;"/></a></td></tr>
<tr><td style="padding:16px 30px 4px;text-align:center;"><h1 style="margin:0;color:#111;font-size:24px;font-weight:900;line-height:1.2;">${esc(headline)}</h1></td></tr>
<tr><td style="padding:14px 30px 0;">${paragraphs(message)}</td></tr>
${order ? orderHtml(order) : ""}
${rows ? `<tr><td style="padding:0 30px 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;border-radius:12px;padding:8px 18px;">${rows}</table></td></tr>` : ""}
${btns ? `<tr><td align="center" style="padding:10px 30px 18px;">${btns}</td></tr>` : ""}
<tr><td align="center" style="padding:0 30px 6px;">${stars} <span style="color:#555;font-size:12px;font-weight:700;">${BRAND.rating} on Google · ${BRAND.vehicles} vehicles serviced</span></td></tr>
<tr><td style="padding:16px 30px 26px;text-align:center;color:#999;font-size:11px;line-height:1.6;">
  <strong style="color:#666;">${BRAND.name}</strong> · ${BRAND.address}<br/>${BRAND.hours} · <a href="tel:${BRAND.phone}" style="color:#999;">${BRAND.phone}</a>
  ${footerNote ? `<br/>${esc(footerNote)}` : ""}
</td></tr>`);
}

/* ---------------- sending ---------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const headersFor = (to) => ({ "List-Unsubscribe": `<${unsubApiUrl(to)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
const tagsFor = (tags = {}) => Object.entries(tags).filter(([, v]) => v).map(([name, value]) => ({ name, value: String(value).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256) }));

/**
 * Send many emails through Resend's batch endpoint (100 per call, paced under the rate limit).
 * messages: [{ to, subject, html, text?, from?, tags?, attachments?, transactional? }] — the unsubscribe
 * headers are added here unless the email is transactional (confirmations, reminders, alerts).
 * Returns { sent, failed, error? }.
 */
export async function sendBatch(messages) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: 0, failed: messages.length, error: "RESEND_API_KEY is not set." };
  let sent = 0, failed = 0, error;
  for (let i = 0; i < messages.length; i += 100) {
    const group = messages.slice(i, i + 100).map((m) => ({
      from: m.from || FROM, to: [m.to], subject: m.subject, html: m.html, text: m.text,
      reply_to: m.replyTo || REPLY_TO, headers: m.transactional ? undefined : headersFor(m.to), tags: tagsFor(m.tags),
      attachments: m.attachments,
    }));
    try {
      const r = await fetch("https://api.resend.com/emails/batch", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(group),
      });
      if (r.ok) sent += group.length;
      else { failed += group.length; error = (await r.text()).slice(0, 300); console.error("Resend batch error:", error); }
    } catch (e) { failed += group.length; error = e.message; }
    if (i + 100 < messages.length) await sleep(600);
  }
  return { sent, failed, error };
}

export async function sendOne(m) { return sendBatch([m]); }

// Plain-text twin of a message (helps deliverability; some inboxes show only text).
export function textVersion(message, unsubUrl) {
  return `${String(message || "").trim()}\n\n--\n${BRAND.name} · ${BRAND.phone}\n${BRAND.address}\nUnsubscribe: ${unsubUrl}`;
}
