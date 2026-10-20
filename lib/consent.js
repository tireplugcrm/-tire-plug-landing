/**
 * Marketing consent: record an opt-in (from /book or /deals) or an opt-out (a STOP text), log it
 * with the exact wording in marketing_consents (lib/consent-schema.sql), and update the customer
 * list so the campaign tools can reach the person. A new person gets a "web:<phone>" row.
 */
import { supabaseAdmin } from "./supabaseAdmin.js";
import { digits10 } from "./phone.js";
import { MARKETING_CONSENT_TEXT } from "./consent-text.js";

export { MARKETING_CONSENT_TEXT };

const STOP_RE = /^\s*(stop|stopall|unsubscribe|cancel|end|quit|revoke|optout|opt out)\s*[.!]*\s*$/i;
export const isStopText = (body) => STOP_RE.test(String(body || ""));

const cleanEmail = (e) => {
  const s = String(e || "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s : null;
};

async function findCustomer(phone, email) {
  if (phone) {
    const { data } = await supabaseAdmin.from("customers").select("id,email").eq("phone10", phone).order("last_visit", { ascending: false, nullsFirst: false }).limit(1);
    if (data && data[0]) return data[0];
  }
  if (email) {
    const { data } = await supabaseAdmin.from("customers").select("id,email").eq("email", email).limit(1);
    if (data && data[0]) return data[0];
  }
  return null;
}

/** Opt-in from a form. Returns { ok, customerId } and never throws (a booking must not fail on it). */
export async function recordOptIn({ name, phone, email, source, req }) {
  if (!supabaseAdmin) return { ok: false };
  try {
    const p = digits10(phone);
    const e = cleanEmail(email);
    const tel = p.length === 10 ? p : null;
    if (!tel && !e) return { ok: false };
    const now = new Date().toISOString();

    let row = await findCustomer(tel, e);
    if (row) {
      const patch = { consent_source: source };
      if (tel) { patch.sms_opt_in = true; patch.sms_opt_in_at = now; }
      if (e && !row.email) patch.email = e;
      await supabaseAdmin.from("customers").update(patch).eq("id", row.id);
    } else {
      const { data } = await supabaseAdmin.from("customers").insert({
        tb_customer_id: `web:${tel || e}`, name: String(name || "").trim() || "(no name)",
        phone: tel, email: e, sms_opt_in: !!tel, sms_opt_in_at: tel ? now : null, consent_source: source,
      }).select("id").single();
      row = data;
    }

    await supabaseAdmin.from("marketing_consents").insert({
      customer_id: row ? row.id : null, phone: tel, email: e, name: String(name || "").trim() || null,
      sms: !!tel, email_ok: !!e, source, wording: MARKETING_CONSENT_TEXT,
      ip: req ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || null : null,
      user_agent: req ? String(req.headers["user-agent"] || "").slice(0, 300) || null : null,
    });
    return { ok: true, customerId: row ? row.id : null };
  } catch (err) {
    console.error("consent opt-in:", err);
    return { ok: false };
  }
}

/** Opt-out from a STOP text: no more marketing texts to this number. */
export async function recordSmsStop(phone, body) {
  const p = digits10(phone);
  if (!supabaseAdmin || p.length !== 10) return;
  try {
    await supabaseAdmin.from("customers").update({ sms_opt_in: false, consent_source: "sms-stop" }).eq("phone10", p);
    await supabaseAdmin.from("marketing_consents").insert({ phone: p, sms: false, source: "sms-stop", wording: String(body || "").slice(0, 200) });
  } catch (err) {
    console.error("consent stop:", err);
  }
}
