// Creates (or updates) the phone AI: an ElevenLabs agent in the shop voice that answers the shop line.
// Nextiva forwards every call on 562-500-4625 to the Twilio number; ElevenLabs answers it there.
// The agent looks up tires with /api/voice-agent, texts links, and transfers to a person.
//
//   node --env-file=.env.local scripts/voice-agent-setup.mjs
//
// Needs in the environment:
//   ELEVENLABS_AGENTS_KEY   ElevenLabs key with Agents read + write (the TTS key can't do this)
//   ELEVENLABS_VOICE_ID     the shop voice
//   VOICE_AGENT_KEY         same value as in Vercel (guards /api/voice-agent)
//   VOICE_TRANSFER_PHONE    where "talk to a person" rings: a Nextiva number that is NOT forwarded
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, VOICE_AGENT_PHONE (the Twilio number Nextiva forwards to)
// Optional: VOICE_AGENT_ID to update an existing agent instead of creating one.
// Rerun after editing the prompt below; it updates the agent in place once VOICE_AGENT_ID is set.
import { ADDRESS, HOURS_TEXT, PHONE } from "../lib/shop.js";

// lib/shop-facts.js is written for texts (and won't load in plain node); these are the spoken facts.
const SHOP_FACTS = `
Address: ${ADDRESS.oneLine}, in ${ADDRESS.area}. Hours: ${HOURS_TEXT}. Shop phone: ${PHONE.plain}. Website: tireplugla.com.
Services: new and used tires, flat repair, mount and balance, wheel alignment, TPMS sensors, rotation, brakes, oil change, battery, free tire inspection and air check.
Mount and balance is extra, from $25 a wheel. TPMS sensors: $199 for a set of 4, or $60 each.
Every tire has the manufacturer's warranty, plus free flat repairs for the first year. Road hazard warranty is an optional add-on; a person quotes its price.
Businesses with a business license get $10 off every tire.
`.trim();

const API = "https://api.elevenlabs.io/v1/convai";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://tireplugla.com").replace(/\/$/, "");
const env = (k) => { if (!process.env[k]) { console.error(`Missing ${k}`); process.exit(1); } return process.env[k]; };
const E164 = (p) => `+1${String(p).replace(/\D/g, "").slice(-10)}`;

const key = env("ELEVENLABS_AGENTS_KEY");
const transfer = E164(env("VOICE_TRANSFER_PHONE"));

async function call(method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method, headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { console.error(`${method} ${path} -> ${r.status}`, JSON.stringify(data, null, 2)); process.exit(1); }
  return data;
}

const PROMPT = `
You are the phone receptionist for The Tire Plug, a tire shop in Los Angeles. You answer every call to the shop.
Talk like a friendly, quick LA shop guy: short sentences, one question at a time, no corporate talk. If the caller speaks Spanish, answer in Spanish.

What callers usually want, and what to do:
- Tire prices or "do you have my size": ask for the size on the sidewall (three numbers, like 225 65 17). If they don't know it, ask year, make and model and tell them the sidewall size is the surest; offer to text them so they can send a photo. Then call check_tires with the size. Read back at most three options, cheapest first, with the price per tire. Only say prices that check_tires gives you.
- Ready to come in: they can walk in, or book online. Offer to text the link with text_link (use the size if you have one). Same day works for tires in stock; next-day tires are installed tomorrow or later.
- Anything you can't answer, an existing job, a complaint, a sales or business call, or the caller asks for a person: say you'll connect them and use transfer_to_number.
- The caller's number is {{system__caller_id}}. Before texting, confirm it's a cell that gets texts; if not, ask for one.

Rules:
- NEVER make up a price, discount, stock or time. If you don't have it, offer a text quote or transfer.
- Never mention costs, distributors or that you are looking anything up in a system. Just say "one sec, let me check."
- Keep it under two minutes when you can. When the caller is done, say bye and use end_call.

Shop facts you can rely on:
${SHOP_FACTS}
`.trim();

const webhook = (name, description, action, properties, required) => ({
  type: "webhook", name, description,
  response_timeout_secs: 15,
  api_schema: {
    url: `${SITE}/api/voice-agent?action=${action}`, method: "POST",
    request_headers: { "x-voice-key": env("VOICE_AGENT_KEY") },
    request_body_schema: { type: "object", properties, required },
  },
});

const tools = [
  webhook("check_tires", "Look up the tires we have in a size, with our price per tire, plus next-day options. Read the 'say' field.", "tires",
    { size: { type: "string", description: "Tire size as digits, e.g. 225/65R17 or 33X12.50R20" } }, ["size"]),
  webhook("text_link", "Text the caller a link: the size page with prices if a size is known, else the booking page.", "text",
    { phone: { type: "string", description: "Caller's cell, 10 digits. Default {{system__caller_id}}." },
      size: { type: "string", description: "Tire size if known, e.g. 225/65R17" } }, ["phone"]),
  { type: "system", name: "end_call", description: "Hang up when the caller is done.", params: { system_tool_type: "end_call" } },
  { type: "system", name: "transfer_to_number", description: "Connect the caller to a person at the shop.",
    params: { system_tool_type: "transfer_to_number", transfers: [{ phone_number: transfer, condition: "The caller wants a person, or you can't help them." }] } },
];

const agent = {
  name: "The Tire Plug phone",
  conversation_config: {
    agent: {
      first_message: "Thanks for calling The Tire Plug! What can I help you with?",
      language: "en",
      prompt: { prompt: PROMPT, llm: "gemini-2.5-flash", temperature: 0.3, tools },
    },
    tts: { voice_id: env("ELEVENLABS_VOICE_ID"), model_id: "eleven_flash_v2", stability: 0.5, similarity_boost: 0.8, speed: 1.05 },
    conversation: { max_duration_seconds: 600 },
  },
};

let agentId = process.env.VOICE_AGENT_ID;
if (agentId) {
  await call("PATCH", `/agents/${agentId}`, agent);
  console.log(`Updated agent ${agentId}`);
} else {
  agentId = (await call("POST", "/agents/create", agent)).agent_id;
  console.log(`Created agent ${agentId}  (save as VOICE_AGENT_ID)`);
}

// The Twilio number: import it once, then point it at the agent.
// If it's already imported (ElevenLabs > Phone Numbers > Import), Twilio keys aren't needed here.
const number = E164(env("VOICE_AGENT_PHONE"));
const existing = (await call("GET", "/phone-numbers")).find?.((p) => p.phone_number === number);
if (!existing && !process.env.TWILIO_AUTH_TOKEN) {
  console.log(`${number} isn't in ElevenLabs yet: import it there (Phone Numbers > Import from Twilio), then rerun with VOICE_AGENT_ID=${agentId}.`);
  process.exit(0);
}
const phoneId = existing?.phone_number_id || (await call("POST", "/phone-numbers", {
  provider: "twilio", phone_number: number, label: "Shop line (from Nextiva)",
  sid: env("TWILIO_ACCOUNT_SID"), token: env("TWILIO_AUTH_TOKEN"),
})).phone_number_id;
await call("PATCH", `/phone-numbers/${phoneId}`, { agent_id: agentId });
console.log(`${number} now answers with the agent. Forward Nextiva 562-500-4625 to it.`);
