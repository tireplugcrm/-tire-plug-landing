/**
 * Jarvis (server-only). See lib/agent-schema.sql. The scheduled Claude agents on the shop PC text the
 * owner a question and wait for "YES 4821" / "NO 4821"; every step they take goes in agent_log.
 */
import crypto from "crypto";
import { supabaseAdmin } from "./supabaseAdmin.js";
import { sendSms } from "./sms.js";
import { digits10 } from "./phone.js";
import { setting } from "./invoices.js";

// JARVIS_PHONE: the owner's cell for Jarvis; falls back to the front-desk alert phone.
export const ownerPhones = () => (process.env.JARVIS_PHONE || process.env.ADMIN_ALERT_PHONE || "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
const isOwner = (phone) => ownerPhones().some((p) => digits10(p) === digits10(phone));

const same = (a, b) => !!a && !!b && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function agentKeyOk(req) {
  const got = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const key = await setting("agent_key");
  return key.length >= 32 && same(got, key);
}

export async function log(agent, message, data = null) {
  await supabaseAdmin.from("agent_log").insert({ agent, message, data });
}

async function textOwner(body) {
  const to = ownerPhones();
  if (!to.length) return false;
  const r = await Promise.all(to.map((phone) => sendSms({ to: phone, body })));
  return r.some((x) => x.ok);
}

/** Text the owner a FYI (no answer needed). */
export async function notify(agent, text) {
  await log(agent, `told owner: ${text}`);
  return { ok: await textOwner(`Jarvis: ${text}`) };
}

/** Text the owner a yes/no question; the answer lands on the row when they reply. */
export async function ask(agent, question, details = null) {
  const code = String(crypto.randomInt(1000, 10000));
  const { data, error } = await supabaseAdmin.from("agent_approvals")
    .insert({ code, agent, question, details }).select("id, code").single();
  if (error) throw new Error(error.message);
  const sms_ok = await textOwner(`Jarvis: ${question}\nReply YES ${code} or NO ${code} (add a note after the code if something's off).`);
  await supabaseAdmin.from("agent_approvals").update({ sms_ok }).eq("id", data.id);
  await log(agent, `asked owner (${code}): ${question}`);
  return { id: data.id, code, sms_ok };
}

export async function approval(id) {
  const { data } = await supabaseAdmin.from("agent_approvals").select("*").eq("id", id).maybeSingle();
  return data;
}

/**
 * Called for every inbound text. "YES 4821" / "no 4821 qty is 8" answers that request; a bare
 * "yes" / "no" answers the owner's only open request. Returns true when it was an answer.
 */
export async function answerFromText(phone, body) {
  if (!isOwner(phone)) return false;
  const m = String(body || "").trim().match(/^(yes|y|ok|okay|approve|approved|no|n|nope)\b[\s,.:-]*(\d{4})?\b\s*(.*)$/i);
  if (!m) return false;
  const status = /^(no|n|nope)$/i.test(m[1]) ? "no" : "yes"; // not STOP: that opts the number out in GHL
  const since = new Date(Date.now() - 3 * 864e5).toISOString();
  let q = supabaseAdmin.from("agent_approvals").select("id").eq("status", "open").gte("asked_at", since);
  q = m[2] ? q.eq("code", m[2]) : q;
  const { data: open } = await q;
  if (!open || open.length !== 1) return false; // no match, or a bare yes with several open: ignore
  await supabaseAdmin.from("agent_approvals")
    .update({ status, answer: String(body).trim(), answered_at: new Date().toISOString() }).eq("id", open[0].id);
  return true;
}
