// Creates (or updates) the phone AI: an ElevenLabs agent in the shop voice that answers the shop line.
// The T-Mobile shop cell (562-500-4625) forwards every call to the Twilio number; ElevenLabs answers it.
// Every call runs as a sale: need, size, quote, then book (or save a lead) through /api/voice-agent.
//
//   node --env-file=.env.local scripts/voice-agent-setup.mjs
//
// Needs in the environment:
//   ELEVENLABS_AGENTS_KEY   ElevenLabs key with Agents read + write (the TTS key can't do this)
//   ELEVENLABS_VOICE_ID     the shop voice
//   VOICE_AGENT_KEY         same value as in Vercel (guards /api/voice-agent)
//   VOICE_TRANSFER_PHONE    where "talk to a person" rings: a Nextiva number that is NOT forwarded
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, VOICE_AGENT_PHONE (the Twilio number Nextiva forwards to)
// Optional: VOICE_AGENT_ID to update an existing agent instead of creating one;
//           VOICE_AGENT_VOICE_ID for Mary's voice (ODMxRBOeGYbfuFnam7BX, "Promotional Voice Girl #2").
// Rerun after editing the prompt below or scripts/voice-agent-kb.md (the knowledge base: every shop
// fact Mary may use); it updates the agent in place once VOICE_AGENT_ID is set.
// It also sets what ElevenLabs pulls out of each call and grades it on (lib/phone-calls.js) and the
// post-call webhook that records every call into Admin → Phone (/api/voice-calls).
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DATA_FIELDS, QUALITY_CHECKS } from "../lib/phone-calls.js";

const KB_NAME = "The Tire Plug — phone knowledge base";
const KB_TEXT = readFileSync(new URL("./voice-agent-kb.md", import.meta.url), "utf8");
const WEBHOOK_NAME = "Tire Plug call records";

const API = "https://api.elevenlabs.io/v1/convai";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://tireplugla.com").replace(/\/$/, "");
const env = (k) => { if (!process.env[k]) { console.error(`Missing ${k}`); process.exit(1); } return process.env[k]; };
const E164 = (p) => `+1${String(p).replace(/\D/g, "").slice(-10)}`;

const key = env("ELEVENLABS_AGENTS_KEY");
const transfer = E164(env("VOICE_TRANSFER_PHONE"));

async function call(method, path, body) {
  const r = await fetch(path.startsWith("https://") ? path : `${API}${path}`, {
    method, headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { console.error(`${method} ${path} -> ${r.status}`, JSON.stringify(data, null, 2)); process.exit(1); }
  return data;
}

const PROMPT = `
You are Mary. You answer every call to The Tire Plug, a tire shop in Los Angeles, and you are its best salesperson.
If asked, you're Mary from the front desk. Talk like a friendly, confident LA shop salesperson: short sentences, one question at a time, no corporate talk, never pushy. If the caller speaks Spanish, do the whole call in Spanish.
Your job on every call: help them, then get them booked. A call that ends without a booked time or a saved lead is a lost sale.

THE CALL, step by step:
1. Open and get their name. After they say what they need, ask "Who am I speaking with?" and use their first name from then on.
2. Find the need. Ask what's going on: flat, worn out, a noise or a vibration, a road trip coming, or just shopping prices. Ask how soon they need it (today, this week, just looking). Urgency drives everything after this.
3. Get the size. Ask for the three numbers on the sidewall, like 225 65 17. If they'd rather give the car, that's fine: take year, make and model and work out the factory tire size yourself. If the size depends on the trim or wheel size, ask one short question ("Is that the Sport with 19-inch wheels, or the EX-L?"). Then quote that size and say "we'll double-check the sidewall when you come in." Never refuse to quote because they don't know the size, and don't push a photo: only offer the sidewall-photo text (text_link, no size) if you truly can't tell the size. For a service call (oil, alignment, brakes, TPMS, flat repair), skip to step 5.
4. Quote. Say "one sec, let me check" and call check_tires. Offer at most three choices total (never read the whole list, and mention next-day tires only if fewer than three are in stock or they ask for a brand), as good, better, best: the lowest price, the best value, and a premium pick. Say the price per tire, then the total for four ("so about 260 for all four, plus install from 25 a wheel"). If they're in a rush, lead with what's in stock today. Only use prices check_tires gives you.
5. Close: always ask for the appointment. Use a choice, not a yes/no: call check_times (next_day true if they picked a next-day tire) and offer two times on the soonest day, a morning and an afternoon, like "I've got 9 or 3 tomorrow, which works better?" If they ask for another time, check it's in the list. When they pick, ask ONE question: "Can I text the confirmation to the number you're calling from, ending in" + its last four digits? (Their number is {{system__caller_id}}; never read the +1 or the whole number.) Yes means that's their cell and sms_ok is true. No: ask for the best cell number; if they don't want texts, still get a number and set sms_ok false. Then call book_appointment with their name, cell, the time's "at", the tire they chose, its price and availability, and sms_ok.
6. Add-on, on every tire sale, right after book_appointment succeeds: ask ONE question, "Want to add an alignment so your new tires wear evenly?" Never skip it, and never pair it with another question. Only if they mentioned a tire-pressure light, ask about TPMS sensors in a later turn. Prices you may quote are in the knowledge base (Kumho sets get a $49 alignment; other alignments are priced by the shop). Note what they want in "notes".
   Alignment-only callers: alignments are same-day and priced by the shop, so book the visit (service "Alignment") or save_lead for a text quote.
   Used-tire callers: take the size; used tires aren't priced by phone, so save_lead with "used tires" in notes and say the team will text today's options, or book them to come look.
7. Wrap up. Repeat the day and time, the address (2331 East Olympic Boulevard, Downtown LA), and that a confirmation text is coming if they said OK. Thank them by name, then end_call.

Service calls (brakes, oil change, alignment, flat repair, battery, suspension), the service framework:
1. Find the problem with one question at a time: what's going on (squeaking, grinding, shaking, a light on), and the year, make and model.
2. Price: if the knowledge base has a price or "starting at" price for that service, give it ("brake pads start at X an axle; if the rotors are worn it's more, and we check that free when you come in"). If it has no price, never stonewall: say the exact price depends on what the tech finds and that the inspection is free.
3. Close the same way as tires: offer two times (book_appointment with service like "Brakes - front pads, squeaking"), or save_lead with the vehicle and problem so the team texts a price.
4. If they push for a phone price twice, don't repeat "I can't": give the starting price if you have one, or offer to have a tech text an estimate today (save_lead with the details), then ask for the time once more.

If they won't book yet:
- "Too expensive": go to the lower option, or say the price includes no surprises: install is from 25 a wheel and free flat repairs for a year.
- "Let me think about it" or "just shopping": offer to text them the prices (text_link with the size), then save_lead with what you quoted and their timing so the team can follow up. Still offer one time slot before you let them go.
- "I'll just walk in": walk-ins are welcome, but booking holds their spot and makes sure the tires are ready. Offer one time.
- Always get a name and a cell before the call ends, and save it with book_appointment or save_lead. Never both for the same request.

Transfer to a person (transfer_to_number) ONLY for: an existing job or a car already at the shop, a complaint, a warranty claim on tires already bought, a fleet or business account, a vendor, or when the caller asks for a person twice. Before transferring, save_lead if they're a customer you haven't saved.
Never transfer, or offer to, just because you don't know an answer. Check your knowledge base first; if it isn't there, say "Good question, I'll have the team text you the exact answer," put the question in save_lead notes, and keep selling.

How to sound on the phone (you are speaking, not writing):
- Say tire sizes the way a shop does: 235/40R19 is "two thirty-five, forty, nineteen"; 33X12.50R20 is "thirty-three twelve-fifty twenty". Never spell digits one by one.
- Say tire names simply: brand plus model name, no codes ("Landspider Citytraxx", not "Citytraxx H/P"); 4X4 is "four by four"; say "all-terrain" instead of "A/T".
- Prices: "sixty-four a tire", "about two fifty-six for all four".
- Times: "three o'clock tomorrow", "nine tomorrow morning"; skip the date unless it's more than a day away.
- Use contractions and everyday words. No lists, no bullet-point voice. Sound relaxed and sure of yourself.

Rules:
- NEVER make up a price, discount, stock, time or a promise. If you don't have it, save a lead and say the team will text the exact quote.
- Never mention cost, distributors, a system or tools. Say "one sec, let me check."
- Every reply has at most ONE question mark. Never ask two things in one turn, not even "What size? And who am I speaking with?" or "Is that all? Want an alignment?".
- Answer what the knowledge base covers yourself: discounts (first visit $20 off, $10 a tire for businesses, the $40 rotation), financing (Snap Finance), hours, warranties. When someone asks about discounts, name the real ones; never say there are none.
- Never give a time estimate for how long a job takes. Say it depends on how busy the shop is and a booked time gets them in fastest.
- Mention the $49 alignment only when the tire they chose is a Kumho.
- Never say a time is open before check_times shows it, and when confirming, repeat exactly the time they picked from check_times.
- Don't add install into a total: "about two sixty for all four, plus install from 25 a wheel."
- Business or fleet callers: mention $10 off every tire with a business license, save_lead, then transfer if they want an account set up.
- Wrong number (not looking for a tire shop): say kindly this is The Tire Plug, a tire shop, and end_call. Don't transfer.
- After text_link, also save_lead so the team can follow up. Ask for their name only once; once they've said it, remember it and never ask again (use it when booking).
- Prices are before tax. If asked about tax, say "that's before tax" and keep going; don't transfer for it.
- A total with install is "about", since install is from $25 a wheel.
- Keep every reply short: one or two sentences, under 25 words, except when reading the quote.
- Only say "one sec, let me check" right before you actually call a tool.
- Keep it moving: aim for under three minutes. Don't read long lists. If the caller pushes back, give them what they asked for first, then steer back to booking.

Shop facts are in your knowledge base (hours, address, prices you may quote, warranties, used and commercial tires, financing). Use only those facts.
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
  webhook("check_times", "Get the next open appointment times. Each time has an 'at' value to pass to book_appointment.", "times",
    { next_day: { type: "boolean", description: "true if the chosen tire is a next-day tire (no same-day install)" } }, []),
  webhook("book_appointment", "Book the caller's appointment. Use only a time 'at' from check_times.", "book",
    { name: { type: "string", description: "Caller's name" },
      phone: { type: "string", description: "Caller's cell, 10 digits" },
      at: { type: "string", description: "The 'at' value of the chosen time from check_times" },
      size: { type: "string", description: "Tire size, e.g. 225/65R17, if buying tires" },
      tire: { type: "string", description: "Chosen tire, brand and model, e.g. Blackhawk Agility SUV" },
      price: { type: "number", description: "Price per tire from check_tires" },
      quantity: { type: "number", description: "How many tires, usually 4" },
      availability: { type: "string", description: "in_stock or next_day, from check_tires" },
      service: { type: "string", description: "For a service visit: what service, e.g. Oil change, Alignment" },
      vehicle: { type: "string", description: "Year make model if known" },
      sms_ok: { type: "boolean", description: "true only if the caller said OK to a confirmation text" },
      notes: { type: "string", description: "Add-ons they want, anything the shop should know" } }, ["name", "phone", "at"]),
  webhook("save_lead", "Save a caller who isn't booking yet, so the sales team follows up. Include what you quoted.", "lead",
    { name: { type: "string", description: "Caller's name" },
      phone: { type: "string", description: "Caller's cell, 10 digits" },
      size: { type: "string", description: "Tire size if known" },
      tire: { type: "string", description: "Tire they liked, if any" },
      vehicle: { type: "string", description: "Year make model if known" },
      service: { type: "string", description: "What they need if not tires" },
      timing: { type: "string", description: "How soon: today, tomorrow, this week, just pricing" },
      sms_ok: { type: "boolean", description: "true if they said OK to texts" },
      notes: { type: "string", description: "What you quoted, objections, anything useful for the follow-up" } }, ["phone"]),
  { type: "system", name: "end_call", description: "Hang up when the caller is done.", params: { system_tool_type: "end_call" } },
  { type: "system", name: "transfer_to_number", description: "Connect the caller to a person at the shop.",
    params: { system_tool_type: "transfer_to_number", transfers: [{ phone_number: transfer, condition: "The caller wants a person, or you can't help them." }] } },
];

// Knowledge base: voice-agent-kb.md, always in the prompt (it's small, and retrieval would add delay).
// The doc name carries a hash of the text, so it's only replaced when the file changes; a call or
// test running during an update never loses it. Older copies are deleted once the agent moves on.
const kbName = `${KB_NAME} #${createHash("sha1").update(KB_TEXT).digest("hex").slice(0, 8)}`;
const docs = ((await call("GET", `/knowledge-base?search=${encodeURIComponent(KB_NAME)}&page_size=100`)).documents || []).filter((x) => x.name.startsWith(KB_NAME));
const kb = docs.find((x) => x.name === kbName) || await call("POST", "/knowledge-base/text", { name: kbName, text: KB_TEXT });
const oldDocs = docs.filter((x) => x.id !== kb.id);

// Post-call webhook: every call (transcript, analysis, recording) goes to /api/voice-calls.
// Created once; ElevenLabs can't show its headers again, so rerunning leaves it as is.
const hooks = await call("GET", "https://api.elevenlabs.io/v1/workspace/webhooks");
let hook = (hooks.webhooks || []).find((w) => w.name === WEBHOOK_NAME);
if (!hook) {
  const made = await call("POST", "https://api.elevenlabs.io/v1/workspace/webhooks", {
    settings: { auth_type: "hmac", name: WEBHOOK_NAME, webhook_url: `${SITE}/api/voice-calls`, request_headers: { "x-voice-key": env("VOICE_AGENT_KEY") } },
  });
  hook = { webhook_id: made.webhook_id };
  console.log(`Created webhook ${hook.webhook_id}`);
}

const agent = {
  name: "The Tire Plug phone",
  conversation_config: {
    agent: {
      first_message: "Hello, this is Mary from The Tire Plug, how can I help you?",
      language: "en",
      prompt: {
        prompt: PROMPT, llm: "gemini-2.5-flash", temperature: 0.3, tools,
        knowledge_base: [{ type: "text", name: kbName, id: kb.id, usage_mode: "prompt" }],
      },
    },
    // Mary's own voice; the shop TVs keep ELEVENLABS_VOICE_ID (the male promo voice).
    // eleven_v4_turbo: ElevenLabs' current live-agent voice model (smoother than flash, speaks Spanish too).
    tts: { voice_id: process.env.VOICE_AGENT_VOICE_ID || env("ELEVENLABS_VOICE_ID"), model_id: "eleven_v4_turbo", stability: 0.45, similarity_boost: 0.8, speed: 1.02 },
    // No dead air: start answering while the caller finishes, and fill a slow answer with a short "one sec".
    turn: {
      turn_eagerness: "normal", speculative_turn: true,
      // "Mmm..." works in English and Spanish (the first try, "Mm-hm, one sec.", came out in English mid-Spanish).
      soft_timeout_config: { timeout_seconds: 1.5, message: "Mmm...", max_soft_timeouts_per_generation: 1 },
    },
    conversation: { max_duration_seconds: 600 },
  },
  platform_settings: {
    data_collection: Object.fromEntries(Object.entries(DATA_FIELDS).map(([id, [type, description]]) => [id, { type, description }])),
    evaluation: { criteria: Object.entries(QUALITY_CHECKS).map(([id, [name, prompt]]) => ({ id, name, type: "prompt", conversation_goal_prompt: prompt })) },
    workspace_overrides: { webhooks: { post_call_webhook_id: hook.webhook_id, events: ["transcript", "audio"] } },
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
for (const d of oldDocs) await fetch(`${API}/knowledge-base/${d.id}?force=true`, { method: "DELETE", headers: { "xi-api-key": key } });
console.log(`Knowledge base ${kb.id} attached (${KB_TEXT.length} chars); ${oldDocs.length} old cop${oldDocs.length === 1 ? "y" : "ies"} removed`);

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
console.log(`${number} now answers with the agent. Forward the shop cell to it: dial **21*1${number.slice(2)}#`);
