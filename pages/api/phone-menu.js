/**
 * Shop line phone menu TwiML (lib/phone-menu.js has the plan). Twilio calls this while a call runs:
 *   (no step)      caller: "Press 1 for a tire quote, press 2 for location, hours..."
 *   step=choice    caller: 1 -> hold queue + ring the person on calls; anything else -> the AI
 *   step=wait      caller, every hold tick: music + "check tireplugla.com"; after max_wait -> AI
 *   step=left      caller left the queue: timed out -> AI, otherwise done
 *   step=agent     person on calls picked up: "Tire quote caller waiting, press 1 to take it"
 *   step=accept    they pressed 1: bridge them to the first caller in line
 *   step=agent-next  that caller hung up: offer the next one in line
 *   step=agent-status  their call leg ended (Twilio status callback): ring again if anyone waits
 * Every path that doesn't reach a person ends at the AI agent, so no call is dropped.
 */
import { AI_URL_DEFAULT, QUEUE, liveNow, menuSettings, queueSize, ringAgent, signatureOk } from "../../lib/phone-menu.js";
import { SITE } from "../../lib/invoices.js";

const A = (f) => `${SITE}/audio/phone/${f}.mp3`;
const U = (step) => `${SITE}/api/phone-menu?step=${step}`;
const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);
const twiml = (res, body) => { res.setHeader("Content-Type", "text/xml"); return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`); };
const toAI = (s) => `<Redirect method="POST">${esc(s.ai_url || AI_URL_DEFAULT)}</Redirect>`;

export default async function handler(req, res) {
  const q = { ...req.query, ...(typeof req.body === "object" ? req.body : {}) };
  const step = String(req.query.step || "");
  let s;
  try { s = await menuSettings(); } catch { s = { ai_url: AI_URL_DEFAULT }; }

  try {
    if (!step) {
      if (!liveNow(s, new Date(), q.From)) return twiml(res, toAI(s));
      const ask = `<Gather numDigits="1" timeout="5" action="${U("choice")}" method="POST"><Play>${A("menu")}</Play></Gather>`;
      return twiml(res, ask + ask + toAI(s)); // asked twice, then the AI picks up
    }

    // Steps that ring a phone or bridge calls only run for genuine Twilio requests.
    const twilioOk = signatureOk(req);
    if (!twilioOk) console.warn(`phone-menu: bad Twilio signature on step=${step}`);

    if (step === "choice") {
      if (q.Digits !== "1" || !twilioOk || !liveNow(s, new Date(), q.From)) return twiml(res, toAI(s));
      await ringAgent(s, { why: "press1" }).catch((e) => console.error("phone-menu ring:", e.message));
      return twiml(res, `<Enqueue waitUrl="${U("wait")}" waitUrlMethod="POST" action="${U("left")}" method="POST">${QUEUE}</Enqueue>`);
    }

    if (step === "wait") {
      if (Number(q.QueueTime) >= Number(s.max_wait || 180) || !twilioOk) return twiml(res, `<Leave/>`);
      await ringAgent(s, { why: "tick" }).catch((e) => console.error("phone-menu ring:", e.message));
      return twiml(res, `<Play>${A("hold")}</Play>`);
    }

    if (step === "left") {
      // bridged / hangup: the call is over. leave (timed out) / error: hand it to the AI.
      return twiml(res, ["bridged", "hangup"].includes(q.QueueResult) ? `<Hangup/>` : toAI(s));
    }

    if (!twilioOk) return twiml(res, `<Hangup/>`);

    if (step === "agent" || step === "agent-next") {
      if (step === "agent-next" && (await queueSize()) === 0) return twiml(res, `<Hangup/>`);
      const f = step === "agent" ? "whisper" : "next";
      return twiml(res, `<Gather numDigits="1" timeout="8" action="${U("accept")}" method="POST"><Play>${A(f)}</Play></Gather><Hangup/>`);
    }

    if (step === "accept") {
      if (q.Digits !== "1") return twiml(res, `<Hangup/>`);
      if ((await queueSize()) === 0) return twiml(res, `<Play>${A("gone")}</Play><Hangup/>`);
      return twiml(res, `<Dial action="${U("agent-next")}" method="POST"><Queue>${QUEUE}</Queue></Dial>`);
    }

    if (step === "agent-status") {
      if ((await queueSize()) > 0) await ringAgent(s, { why: `after ${q.CallStatus}` }).catch((e) => console.error("phone-menu ring:", e.message));
      return res.status(204).end();
    }

    return twiml(res, toAI(s));
  } catch (e) {
    console.error(`phone-menu step=${step}:`, e.message);
    return twiml(res, step.startsWith("agent") || step === "accept" ? `<Hangup/>` : toAI(s));
  }
}
