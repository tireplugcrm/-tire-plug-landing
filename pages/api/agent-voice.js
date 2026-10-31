/**
 * Jarvis phone calls (lib/agent.js placeCall). Twilio fetches these while the call runs:
 *   ?id&t                 TwiML: play the question, listen for 1/2 or "yes"/"no"
 *   ?id&t&step=answer     TwiML: save the answer on the approval, say "Got it"
 *   ?id&t&step=audio&say= the spoken audio (ElevenLabs shop voice, same as the shop TVs)
 * t is an HMAC of the approval id with the agent key, so only links Jarvis made work.
 * Without ElevenLabs the call falls back to Twilio's own voice.
 */
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { callToken, approval } from "../../lib/agent.js";
import { SITE } from "../../lib/invoices.js";

const VOICE = process.env.ELEVENLABS_VOICE_ID;
const MODEL = process.env.ELEVENLABS_MODEL_ID || "eleven_v4";
const SETTINGS = { stability: 0.5, similarity_boost: 0.8, speed: 1.05 };

const LINES = {
  yes: "Got it, approved. I'll take care of it. Bye.",
  no: "Got it, I'll leave it. Bye.",
  none: "I didn't catch that. I'll text you the question too. Bye.",
  info: "That's all. Bye.",
};
const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);

function spoken(a, say) {
  if (say && LINES[say]) return LINES[say];
  const q = String(a.question).replace(/\$(\d+)\.00\b/g, "$$$1");
  return a.status === "info"
    ? `Hey, it's Jarvis from The Tire Plug. ${q}`
    : `Hey, it's Jarvis from The Tire Plug. ${q} Press 1 or say yes to approve. Press 2 or say no.`;
}

function play(a, t, say) {
  const text = spoken(a, say);
  if (!process.env.ELEVENLABS_API_KEY || !VOICE) return `<Say voice="Polly.Matthew">${esc(text)}</Say>`;
  const url = `${SITE}/api/agent-voice?id=${a.id}&t=${t}&step=audio${say ? `&say=${say}` : ""}`;
  return `<Play>${esc(url)}</Play>`;
}

const twiml = (res, body) => { res.setHeader("Content-Type", "text/xml"); return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`); };

export default async function handler(req, res) {
  const q = { ...req.query, ...(typeof req.body === "object" ? req.body : {}) };
  const { id, t, step, say } = q;
  if (!id || !t || t !== (await callToken(id))) return res.status(401).end();
  const a = await approval(id);
  if (!a) return res.status(404).end();

  if (step === "audio") {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: spoken(a, say).slice(0, 900), model_id: MODEL, voice_settings: SETTINGS }),
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);
    if (!r?.ok) return res.status(502).end();
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(Buffer.from(await r.arrayBuffer()));
  }

  if (step === "answer") {
    const heard = `${q.Digits || ""} ${q.SpeechResult || ""}`.trim().toLowerCase();
    const status = /^1\b|\b(yes|yeah|yep|approve|approved|okay|ok|sure|do it|go ahead)\b/.test(heard) ? "yes"
      : /^2\b|\b(no|nope|don't|do not|leave it|pass)\b/.test(heard) ? "no" : null;
    if (!status) return twiml(res, play(a, t, "none"));
    if (a.status === "open") {
      await supabaseAdmin.from("agent_approvals")
        .update({ status, answer: `Phone call: ${q.Digits ? `pressed ${q.Digits}` : `said "${q.SpeechResult}"`}`, answered_at: new Date().toISOString() })
        .eq("id", a.id).eq("status", "open");
    }
    return twiml(res, play(a, t, status));
  }

  if (a.status === "info") return twiml(res, `${play(a, t)}${play(a, t, "info")}`);
  const action = `${SITE}/api/agent-voice?id=${a.id}&amp;t=${t}&amp;step=answer`;
  return twiml(res,
    `<Gather input="dtmf speech" numDigits="1" timeout="7" speechTimeout="auto" hints="yes, no, approve" action="${action}" method="POST">${play(a, t)}</Gather>` +
    play(a, t, "none"));
}
