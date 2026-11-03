// 1-on-1 training for Mary (the phone AI): a second agent plays a CUSTOMER and calls the owner, the owner sells
// to it like a real caller, and the owner's own lines go into Mary's playbook (scripts/voice-agent-playbook.md,
// added to her prompt by scripts/voice-agent-setup.mjs) once the owner approves them.
//
//   node --env-file=.env.local scripts/mary-training.mjs call [scenario]   phone the owner as a customer
//   node --env-file=.env.local scripts/mary-training.mjs last               print the last training call's transcript
//
// Scenarios: shopper, two-tires, brakes, objection, spanish, unsure-size, walk-in, special-order (default: random).
// Needs ELEVENLABS_AGENTS_KEY; calls TRAINING_PHONE (default the owner's cell) from the shop's Twilio number.
// The training agent's calls don't go to the call-records webhook, so they never count in Admin > Phone.

const API = "https://api.elevenlabs.io/v1/convai";
const key = process.env.ELEVENLABS_AGENTS_KEY;
if (!key) { console.error("Needs ELEVENLABS_AGENTS_KEY"); process.exit(1); }
const NAME = "Mary training caller";
const SHOP_NUMBER = "+13233288219";
const TO = `+1${String(process.env.TRAINING_PHONE || "5623998942").replace(/\D/g, "").slice(-10)}`;

async function call(method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers: { "xi-api-key": key, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(data).slice(0, 400)}`);
  return data;
}

const SCENARIOS = {
  shopper: "You're price shopping for 4 tires, size 265/70R17, for your truck. You've already called two other shops; the cheapest was $520 out the door. Ask for their best price and whether it includes install. Be a little skeptical.",
  "two-tires": "You need just 2 tires for a 2019 Toyota Corolla LE and don't know the size. You want them today if possible and ask what the total will be.",
  brakes: "Your brakes are squeaking and sometimes grind on a 2018 Honda Civic. You want to know how much brakes cost and how long it takes. Push for a price.",
  objection: "You want 4 tires, size 225/65R17. When you hear the price, say it's too expensive and that you saw cheaper online. See if they can change your mind.",
  spanish: "Speak only Spanish. You need 2 tires for a 2015 Nissan Altima, size 215/60R16, and want to know if they can do it today and how much.",
  "unsure-size": "You don't know your tire size and you're driving. Your car is a 2021 Tesla Model 3. You ask for a price on 4 tires and whether an alignment is needed.",
  "walk-in": "You want 4 tires, size 235/45R18. After hearing the price you say you'll just walk in later. See if they convince you to book.",
  "special-order": "You want Michelin Defender tires, size 285/75R16, for your truck. Ask if they have them and how much.",
};

async function trainingAgent() {
  const prompt = `You are role-playing a CUSTOMER calling The Tire Plug, a tire shop in Los Angeles. The person who answers is the shop's owner, training you so their phone AI can learn their sales lines. Stay in character as a normal LA customer the whole call: natural, a bit busy, short answers, real questions and real objections. Don't make it too easy, but agree when they handle you well. Never say you're an AI or that this is training unless they ask directly. Let them lead; answer what they ask. End the call once you've booked, decided, or after about 4 minutes.\n\nYour situation: {{scenario}}`;
  const body = {
    name: NAME,
    conversation_config: {
      agent: { first_message: "Hi, yeah, I was calling about some tires.", language: "en", prompt: { prompt, llm: "gemini-2.5-flash", temperature: 0.7 } },
      tts: { voice_id: "cjVigY5qzO86Huf0OWal", model_id: "eleven_v4_turbo" }, // a regular male voice, not Mary's
      conversation: { max_duration_seconds: 420 },
    },
    platform_settings: { workspace_overrides: { webhooks: { post_call_webhook_id: null, events: [] } } },
  };
  const list = await call("GET", `/agents?search=${encodeURIComponent(NAME)}&page_size=10`);
  const found = (list.agents || []).find((a) => a.name === NAME);
  if (found) { await call("PATCH", `/agents/${found.agent_id}`, body); return found.agent_id; }
  return (await call("POST", "/agents/create", body)).agent_id;
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "call") {
  const names = Object.keys(SCENARIOS);
  const scenarioName = SCENARIOS[arg] ? arg : names[Math.floor(Math.random() * names.length)];
  const agentId = await trainingAgent();
  const phone = (await call("GET", "/phone-numbers")).find((p) => p.phone_number === SHOP_NUMBER);
  if (!phone) throw new Error(`${SHOP_NUMBER} isn't in ElevenLabs`);
  const r = await call("POST", "/twilio/outbound-call", {
    agent_id: agentId, agent_phone_number_id: phone.phone_number_id, to_number: TO,
    conversation_initiation_client_data: { dynamic_variables: { scenario: SCENARIOS[scenarioName] } },
  });
  console.log(`Calling ${TO.slice(0, 2)}...${TO.slice(-4)} as a customer (${scenarioName}). Conversation ${r.conversation_id}.`);
} else if (cmd === "last") {
  const agentId = await trainingAgent();
  const list = await call("GET", `/conversations?agent_id=${agentId}&page_size=1`);
  const c = list.conversations?.[0];
  if (!c) { console.log("No training calls yet."); process.exit(0); }
  const d = await call("GET", `/conversations/${c.conversation_id}`);
  console.log(`${new Date(d.metadata.start_time_unix_secs * 1000).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}, ${d.metadata.call_duration_secs}s`);
  for (const t of d.transcript || []) if (t.message) console.log(`${t.role === "agent" ? "CUSTOMER" : "OWNER"}: ${t.message}`);
} else {
  console.log("Usage: mary-training.mjs call [shopper|two-tires|brakes|objection|spanish|unsure-size|walk-in|special-order] | last");
}
