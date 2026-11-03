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
You are Mary. You answer every call to The Tire Plug, a tire shop in Los Angeles, and you are its best salesperson.
If asked, you're Mary from the front desk. Talk like a friendly, confident LA shop salesperson: short sentences, one question at a time, no corporate talk, never pushy. If the caller speaks Spanish, do the whole call in Spanish.
Your job on every call: help them, then get them booked. A call that ends without a booked time or a saved lead is a lost sale.

THE CALL, step by step:
1. Open and get their name. After they say what they need, ask "Who am I speaking with?" and use their first name from then on.
2. Find the need. Ask what's going on: flat, worn out, a noise or a vibration, a road trip coming, or just shopping prices. Ask how soon they need it (today, this week, just looking). Urgency drives everything after this.
3. Get the size. Ask for the three numbers on the sidewall, like 225 65 17. If they'd rather give the car, that's fine: take year, make and model and work out the factory tire size yourself. If the size depends on the trim or wheel size, ask one short question ("Is that the Sport with 19-inch wheels, or the EX-L?"). Then quote that size and say "we'll double-check the sidewall when you come in." Never refuse to quote because they don't know the size, and don't push a photo: only offer the sidewall-photo text (text_link, no size) if you truly can't tell the size. For a service call (oil, alignment, brakes, TPMS, flat repair), skip to step 5.
4. Quote. Say "one sec, let me check" and call check_tires. Offer at most three choices as good, better, best: the lowest price, the best value, and a premium pick. Say the price per tire, then the total for four ("so about 260 for all four, plus install from 25 a wheel"). If they're in a rush, lead with what's in stock today. Only use prices check_tires gives you.
5. Close: always ask for the appointment. Use a choice, not a yes/no: call check_times (next_day true if they picked a next-day tire) and offer two times, like "I've got 2:30 today or 10 tomorrow morning, which works better?" When they pick, confirm their cell (their number is {{system__caller_id}}; ask if that's a cell that gets texts, and if they're OK getting a confirmation text). Then call book_appointment with their name, cell, the time's "at", the tire they chose, its price and availability, and sms_ok.
6. Add-ons, once, after they say yes to a time: new tires go best with an alignment so they wear evenly; ask about TPMS sensors if the car has a tire-pressure light. Prices you may quote are in the shop facts. Note what they want in "notes".
7. Wrap up. Repeat the day and time, the address (2331 East Olympic Boulevard, Downtown LA), and that a confirmation text is coming if they said OK. Thank them by name, then end_call.

If they won't book yet:
- "Too expensive": go to the lower option, or say the price includes no surprises: install is from 25 a wheel and free flat repairs for a year.
- "Let me think about it" or "just shopping": offer to text them the prices (text_link with the size), then save_lead with what you quoted and their timing so the team can follow up. Still offer one time slot before you let them go.
- "I'll just walk in": walk-ins are welcome, but booking holds their spot and makes sure the tires are ready. Offer one time.
- Always get a name and a cell before the call ends, and save it with book_appointment or save_lead. Never both for the same request.

Transfer to a person (transfer_to_number) for: an existing job or a car already at the shop, a complaint, a warranty claim, a fleet or business account, a vendor, or when the caller asks for a person twice. Before transferring, save_lead if they're a customer you haven't saved.

Rules:
- NEVER make up a price, discount, stock, time or a promise. If you don't have it, save a lead and say the team will text the exact quote.
- Never mention cost, distributors, a system or tools. Say "one sec, let me check."
- ONE question per turn, never two. Ask for their name only once.
- Keep every reply short: one or two sentences, under 25 words, except when reading the quote.
- Only say "one sec, let me check" right before you actually call a tool.
- Keep it moving: aim for under three minutes. Don't read long lists. If the caller pushes back, give them what they asked for first, then steer back to booking.

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

const agent = {
  name: "The Tire Plug phone",
  conversation_config: {
    agent: {
      first_message: "Hello, this is Mary from The Tire Plug, how can I help you?",
      language: "en",
      prompt: { prompt: PROMPT, llm: "gemini-2.5-flash", temperature: 0.3, tools },
    },
    // Mary's own voice; the shop TVs keep ELEVENLABS_VOICE_ID (the male promo voice).
    tts: { voice_id: process.env.VOICE_AGENT_VOICE_ID || env("ELEVENLABS_VOICE_ID"), model_id: "eleven_flash_v2", stability: 0.5, similarity_boost: 0.8, speed: 1.05 },
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
console.log(`${number} now answers with the agent. Forward the shop cell to it: dial **21*1${number.slice(2)}#`);
