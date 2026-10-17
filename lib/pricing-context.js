// The real-world wiring for lib/pricing.js: Supabase (or a local file), the committed fallback data,
// Tekmetric, owner alerts (text + email) and the daily report email. One context per server process,
// so the pages' 30-second stock and price caches are shared. SERVER ONLY.
//
// Local preview: PRICING_DB_FILE=<path to a JSON file outside the repo> runs everything against that
// file instead of Supabase (see tests/pricing.test.mjs for the same setup).
import snapshot from "../data/inventory-snapshot.json";
import models from "../data/tire-models.json";
import { allTires } from "./tire-catalog";
import { supabaseAdmin } from "./supabaseAdmin.js";
import { supabaseDb, fileDb } from "./pricing-db.js";
import { fetchTireLines, tekmetricConfigured } from "./tekmetric.mjs";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://tireplugla.com").replace(/\/$/, "");
const list = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
const EMAILS = list(process.env.ADMIN_ALERT_EMAIL || "alejandro.l@tirexchange.org");
const PHONES = list(process.env.ADMIN_ALERT_PHONE);
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function sendEmail(subject, lines, link) {
  if (!process.env.RESEND_API_KEY) return;
  const { sendOne } = await import("./email.js");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:560px">
<h2 style="margin:0 0 12px">${esc(subject)}</h2>${lines.map((l) => `<p style="margin:0 0 10px">${esc(l)}</p>`).join("")}
<p><a href="${link}" style="display:inline-block;background:#FF1F1F;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open Pricing</a></p></div>`;
  await Promise.allSettled(EMAILS.map((to) => sendOne({ to, subject, html, text: `${lines.join("\n\n")}\n\n${link}`, tags: { kind: "pricing_alert" } })));
}

let ctx = null;
export function pricingContext() {
  if (ctx) return ctx;
  const db = process.env.PRICING_DB_FILE ? fileDb(process.env.PRICING_DB_FILE) : supabaseAdmin ? supabaseDb(supabaseAdmin) : null;
  ctx = {
    db, models, snapshot, catalog: allTires(), site: SITE,
    now: () => new Date(),
    tekmetricConfigured,
    fetchTekmetricLines: fetchTireLines,
    async fetchText(url) {
      const res = await fetch(url, { headers: { "User-Agent": "TirePlug-PricingCheck/1.0", "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
    // Urgent: text + email the owner. Same recipients as the Front Desk alerts (comma-separated
    // ADMIN_ALERT_PHONE / ADMIN_ALERT_EMAIL); no phone set = email only.
    async alert(subject, text) {
      if (process.env.PRICING_DB_FILE) return console.log(`[pricing alert] ${subject}: ${text}`);
      const link = `${SITE}/admin?tab=pricing`;
      const { sendSms } = await import("./sms.js");
      await Promise.allSettled([
        ...PHONES.map((to) => sendSms({ to, body: `Tire Plug pricing: ${text} ${link}` })),
        sendEmail(subject, [text], link),
      ]);
    },
    // Once a day: email only.
    async digest(subject, lines) {
      if (process.env.PRICING_DB_FILE) return console.log(`[pricing report] ${subject}\n${lines.join("\n")}`);
      await sendEmail(subject, lines, `${SITE}/admin?tab=pricing`);
    },
  };
  return ctx;
}
