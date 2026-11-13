/**
 * Shop line phone menu (owner, Nov 11: "Press 1 for a tire quote, Press 2 for location, hours...").
 * Twilio number -> pages/api/phone-menu.js. While the menu is live:
 *   Press 1 -> waits in the "tirequote" queue (hold music + "check tireplugla.com" every ~30 s)
 *              while we ring the person on calls (Belen). They press 1 to take the next caller,
 *              so a busy cell rolling to voicemail never swallows a call.
 *              After max_wait seconds the caller goes to the AI instead.
 *   Press 2 / no key -> the AI agent (Alejandro, ElevenLabs).
 * Outside the menu's hours (or when it's off) every call goes straight to the AI, as before.
 *
 * Settings: app_settings 'phone_menu' JSON (personal numbers stay out of the repo):
 *   { enabled, agent_phones: [everyone who takes quote calls; first to press 1 gets the caller], schedule: [{ day: 0-6, from: "HH:MM", to: "HH:MM" }], max_wait: 180,
 *     test_from: [phones that always get the menu, for testing],
 *     ai_url: ElevenLabs' inbound webhook (what the number pointed at before the menu) }
 * State: app_settings 'phone_menu_state' JSON { legs: { "+1...": { sid, at } } }, the call ringing each person.
 */
import crypto from "crypto";
import { supabaseAdmin } from "./supabaseAdmin.js";
import { setting, shopClock, SITE } from "./invoices.js";
import { toE164 } from "./phone.js";

export const QUEUE = "tirequote";
export const AI_URL_DEFAULT = "https://api.us.elevenlabs.io/twilio/inbound_call";

const SID = () => process.env.TWILIO_ACCOUNT_SID;
const auth = () => `Basic ${Buffer.from(`${SID()}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`;

export async function twilio(path, { method = "GET", body } = {}) {
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID()}${path}`, {
    method,
    headers: { Authorization: auth(), ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: body ? new URLSearchParams(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || `Twilio ${r.status}`);
  return j;
}

const parse = (s, fallback) => { try { return { ...fallback, ...JSON.parse(s || "{}") }; } catch { return fallback; } };

/** Who takes quote calls (agent_phones, or the older single agent_phone). */
export const agentPhones = (s) => [...new Set([...(s.agent_phones || []), s.agent_phone].map((p) => toE164(p)).filter(Boolean))];

export async function menuSettings() {
  return parse(await setting("phone_menu"), { enabled: false, agent_phone: "", schedule: [], max_wait: 180, ai_url: AI_URL_DEFAULT });
}

export async function saveSettings(next) {
  const cur = await menuSettings();
  const value = JSON.stringify({ ...cur, ...next });
  await supabaseAdmin.from("app_settings").upsert({ key: "phone_menu", value, updated_at: new Date().toISOString() });
  return JSON.parse(value);
}

/** Is the menu answering right now (enabled, someone to ring, inside a schedule window)? */
export function liveNow(s, now = new Date(), from = "") {
  if (!s.enabled || !agentPhones(s).length) return false;
  // Testing: these callers always get the menu, whatever the schedule (customers don't).
  if (from && (s.test_from || []).some((p) => toE164(p) && toE164(p) === toE164(from))) return true;
  if (!s.schedule?.length) return true;
  const c = shopClock(now);
  const mins = c.hour * 60 + c.minute;
  const hm = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };
  return s.schedule.some((w) => Number(w.day) === c.weekday && mins >= hm(w.from) && mins < hm(w.to));
}

/** Twilio request signature (X-Twilio-Signature) for the exact URL Twilio called + its POST params. */
export function signatureOk(req) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const got = req.headers["x-twilio-signature"];
  if (!token || !got) return false;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const url = `https://${host}${req.url}`;
  const params = req.method === "POST" && typeof req.body === "object" ? req.body : {};
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const want = crypto.createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
  return want.length === got.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got));
}

export async function queueSize() {
  const { queues = [] } = await twilio(`/Queues.json?PageSize=50`);
  const q = queues.find((x) => x.friendly_name === QUEUE);
  return q ? Number(q.current_size) || 0 : 0;
}

const readState = async () => parse(await setting("phone_menu_state"), { legs: {} });
const writeState = (st) => supabaseAdmin.from("app_settings").upsert({ key: "phone_menu_state", value: JSON.stringify(st), updated_at: new Date().toISOString() });
const LIVE = ["queued", "initiated", "ringing", "in-progress"];

/**
 * Ring everyone on calls whose phone isn't already ringing or on a menu call. The first to press 1
 * gets the caller (step=accept hangs up the others' ringing). Called when someone presses 1, on every
 * hold-music tick, and when one of their calls ends.
 */
export async function ringAgent(s, { why = "" } = {}) {
  const from = toE164(process.env.TWILIO_PHONE_NUMBER);
  const phones = agentPhones(s);
  if (!phones.length || !from) return { rang: [], reason: "no phone" };
  if (why !== "press1" && (await queueSize()) === 0) return { rang: [], reason: "nobody waiting" };
  const st = await readState();
  st.legs = st.legs || {};
  const base = `${SITE}/api/phone-menu`;
  const rang = [];
  for (const to of phones) {
    const leg = st.legs[to];
    if (leg?.sid && Date.now() - leg.at < 10 * 60 * 1000) {
      if (Date.now() - leg.at < 4000) continue; // just rang
      const c = await twilio(`/Calls/${leg.sid}.json`).catch(() => null);
      if (c && LIVE.includes(c.status)) continue; // ringing or on a menu call
    }
    st.legs[to] = { sid: null, at: Date.now() };
    await writeState(st); // claim before dialing so two ticks don't double-ring
    const c = await twilio(`/Calls.json`, {
      method: "POST",
      body: {
        To: to, From: from, Url: `${base}?step=agent`, Method: "POST", Timeout: "20",
        StatusCallback: `${base}?step=agent-status`, StatusCallbackMethod: "POST",
      },
    });
    st.legs[to] = { sid: c.sid, at: Date.now() };
    await writeState(st);
    rang.push(c.sid);
  }
  if (rang.length) console.log(`phone-menu: ringing ${rang.length} (${why})`);
  return { rang };
}

/** Someone took the last caller in line: stop the other phones that are still ringing. */
export async function stopOtherRinging(exceptSid) {
  const st = await readState();
  for (const leg of Object.values(st.legs || {})) {
    if (!leg?.sid || leg.sid === exceptSid) continue;
    const c = await twilio(`/Calls/${leg.sid}.json`).catch(() => null);
    if (c && ["queued", "initiated", "ringing"].includes(c.status)) {
      await twilio(`/Calls/${leg.sid}.json`, { method: "POST", body: { Status: "canceled" } }).catch(() => null);
    }
  }
}

/** The number's current webhook, so the menu can be installed and undone in one step. */
export async function numberInfo() {
  const phone = toE164(process.env.TWILIO_PHONE_NUMBER);
  const { incoming_phone_numbers: list = [] } = await twilio(`/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phone)}`);
  const n = list[0];
  if (!n) throw new Error(`Twilio number ${phone} not found`);
  return { sid: n.sid, phone: n.phone_number, voice_url: n.voice_url, voice_method: n.voice_method, fallback_url: n.voice_fallback_url };
}

export const MENU_URL = () => `${SITE}/api/phone-menu`;

/** Point the number at the menu (AI stays the fallback if the site can't answer). */
export async function install() {
  const n = await numberInfo();
  const s = await menuSettings();
  const ai = n.voice_url && !n.voice_url.startsWith(MENU_URL()) ? n.voice_url : s.ai_url || AI_URL_DEFAULT;
  await saveSettings({ ai_url: ai });
  await twilio(`/IncomingPhoneNumbers/${n.sid}.json`, {
    method: "POST",
    body: { VoiceUrl: MENU_URL(), VoiceMethod: "POST", VoiceFallbackUrl: ai, VoiceFallbackMethod: "POST" },
  });
  return { ...(await numberInfo()), ai_url: ai };
}

/** Back to "the AI answers every call" exactly as before. */
export async function uninstall() {
  const n = await numberInfo();
  const s = await menuSettings();
  await twilio(`/IncomingPhoneNumbers/${n.sid}.json`, {
    method: "POST",
    body: { VoiceUrl: s.ai_url || AI_URL_DEFAULT, VoiceMethod: "POST", VoiceFallbackUrl: "" },
  });
  return numberInfo();
}
