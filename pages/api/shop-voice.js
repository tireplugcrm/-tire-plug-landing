/**
 * The shop TVs' spoken announcements in an ElevenLabs voice ("New check-in…", "…is complete").
 * POST { text } -> audio/mpeg. Needs ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID (the voice picked in
 * ElevenLabs; optional ELEVENLABS_MODEL_ID). Without them this answers 501 and the TV only chimes
 * (there is no fallback voice).
 * Only a TV (x-tv-key = app_settings 'shop_tv_key') or the local /shop-demo may call it, since every
 * call costs ElevenLabs characters.
 */
import crypto from "node:crypto";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";

const VOICE = process.env.ELEVENLABS_VOICE_ID;
const MODEL = process.env.ELEVENLABS_MODEL_ID || "eleven_v4"; // the model the owner's sample was made with
// The owner's sample (TikTok promotional voice): speed 1.11, stability 50, similarity 80.
const SETTINGS = { stability: 0.5, similarity_boost: 0.8, speed: 1.11 };
const MAX_CHARS = 240;

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
async function allowed(req) {
  if (req.body?.demo && process.env.NODE_ENV !== "production") return true;
  const got = req.headers["x-tv-key"] || "";
  if (!got || !supabaseAdmin) return false;
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "shop_tv_key").maybeSingle();
  return (data?.value || "").length >= 32 && same(got, data.value);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const text = String(req.body?.text || "").trim().slice(0, MAX_CHARS);
  if (!text) return res.status(400).json({ error: "No text." });
  if (!(await allowed(req))) return res.status(401).json({ error: "Not allowed." });
  if (!process.env.ELEVENLABS_API_KEY || !VOICE) return res.status(501).json({ error: "ElevenLabs isn't set up (ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID)." });

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      const why = await r.json().catch(() => null);
      const detail = why?.detail?.message || why?.detail?.status || (typeof why?.detail === "string" ? why.detail : "");
      return res.status(502).json({ error: `ElevenLabs said ${r.status}${detail ? `: ${detail}` : "."}` });
    }
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    return res.status(502).json({ error: "ElevenLabs didn't answer." });
  }
}
