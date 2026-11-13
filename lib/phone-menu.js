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
 *   { enabled, agent_phone, schedule: [{ day: 0-6, from: "HH:MM", to: "HH:MM" }], max_wait: 180,
 *     ai_url: ElevenLabs' inbound webhook (what the number pointed at before the menu) }
 * State: app_settings 'phone_menu_state' JSON { leg: Twilio call sid ringing the person, at: ms }.
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
export function liveNow(s, now = new Date()) {
  if (!s.enabled || !toE164(s.agent_phone)) return false;
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

const readState = async () => parse(await setting("phone_menu_state"), { leg: null, at: 0 });
const writeState = (st) => supabaseAdmin.from("app_settings").upsert({ key: "phone_menu_state", value: JSON.stringify(st), updated_at: new Date().toISOString() });

/**
 * Ring the person on calls unless their phone is already ringing or on a menu call.
 * Called when someone presses 1, on every hold-music tick, and when their call ends.
 */
export async function ringAgent(s, { why = "" } = {}) {
  const to = toE164(s.agent_phone), from = toE164(process.env.TWILIO_PHONE_NUMBER);
  if (!to || !from) return { rang: false, reason: "no phone" };
  const st = await readState();
  if (st.leg && Date.now() - st.at < 10 * 60 * 1000) {
    const c = await twilio(`/Calls/${st.leg}.json`).catch(() => null);
    if (c && ["queued", "initiated", "ringing", "in-progress"].includes(c.status)) return { rang: false, reason: `busy (${c.status})` };
  }
  if (Date.now() - st.at < 4000) return { rang: false, reason: "just rang" };
  await writeState({ leg: null, at: Date.now() }); // claim before dialing so two ticks don't double-ring
  if ((await queueSize()) === 0 && why !== "press1") return { rang: false, reason: "nobody waiting" };
  const base = `${SITE}/api/phone-menu`;
  const c = await twilio(`/Calls.json`, {
    method: "POST",
    body: {
      To: to, From: from, Url: `${base}?step=agent`, Method: "POST", Timeout: "20",
      StatusCallback: `${base}?step=agent-status`, StatusCallbackMethod: "POST",
    },
  });
  await writeState({ leg: c.sid, at: Date.now() });
  console.log(`phone-menu: ringing agent (${why}) ${c.sid}`);
  return { rang: true, sid: c.sid };
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
