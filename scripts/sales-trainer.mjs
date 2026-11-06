// Sales training: a practice customer (ElevenLabs agent) calls the owner's cell from the shop's AI number and plays
// a real tire shopper. The owner sells like on a real call; the transcripts are copied into Alejandro's playbook.
//
//   node --env-file=.env.local scripts/sales-trainer.mjs setup              create/update the practice-customer agent
//   TRAINER_TO=+1... node --env-file=.env.local scripts/sales-trainer.mjs call [n]   place practice call (scenario n, default random)
//   node --env-file=.env.local scripts/sales-trainer.mjs transcripts [k]    print the last k practice calls (default 3)
//
// TRAINER_TO is the owner's cell, passed on the command line (never stored in the repo).
const API = "https://api.elevenlabs.io/v1/convai";
const key = process.env.ELEVENLABS_AGENTS_KEY;
const NAME = "Tire Plug sales trainer (practice customer)";
async function call(method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers: { "xi-api-key": key, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} ${r.status}: ${JSON.stringify(j).slice(0, 400)}`);
  return j;
}

// Built from real calls to Alejandro (Nov 3-5): price shoppers who leave to "check the size", "speak to a person"
// openers, price pushback, far-away callers, Spanish speakers.
const SCENARIOS = [
  { voice: "CwhRBWXzGAHq8TQ4Fs17", lang: "en", text: "You need 2 tires, size 225/65R17, for a 2016 Honda CR-V. Open with just: \"How much for 225 65 17?\" After you hear a price, say you need to double-check the size with your husband/wife and you'll call back. Only book if the seller gives you a real reason not to wait (like holding the price, or offering to check the size from your car's year and model)." },
  { voice: "iP95p4xoKVk53GoZ742B", lang: "en", text: "Open with: \"Yeah, can I speak to somebody?\" You're a little impatient. You need 4 tires for a 2019 Toyota Camry SE (you don't know the size). You saw a 'buy 3 get 1 free' deal somewhere and ask if they have it. You want it done today if the price is right." },
  { voice: "cjVigY5qzO86Huf0OWal", lang: "en", text: "You need 4 tires, 245/45R20, for a 2018 Dodge Charger. You already got a quote from a shop near you that's about twenty dollars a tire cheaper, and you ask for the out-the-door price with install. Push back on price twice. You can be won over by value (warranty, install price, being done today, free flat repairs), not by pressure." },
  { voice: "bIHbv24MWmeRgasZH58o", lang: "en", text: "You live in Northridge (about 25 miles away). You need 2 tires, 235/50R19, for a 2019 Buick Envision. Ask if they have a location closer to you. You're hesitant about the drive. Book only if they make the trip feel worth it." },
  { voice: "N2lVS1w4EtoT3dr4eOWO", lang: "es", text: "Hablas solo español. Necesitas 4 llantas para una Ford F-150 2015, medida 265/70R17. Preguntas cuánto cuestan instaladas y si pueden hoy en la tarde. Pregunta si aceptan efectivo." },
  { voice: "pqHfZKP75CvOlQylNhV4", lang: "en", text: "You're older and not in a hurry. You have a flat on a 2012 Toyota Camry and aren't sure if you need a new tire or a patch. You also ask how long it takes and whether you need an appointment. If they suggest replacing two tires, ask why." },
];

const PROMPT = `You are role-playing a CUSTOMER calling The Tire Plug, a tire shop in Downtown LA. This is a sales-training practice call: the person who answers is the shop's owner practicing how he sells on the phone. Stay in character as the customer the whole call.

YOUR SITUATION:
{{scenario}}

HOW TO PLAY IT:
- Talk like a real LA caller: short, casual, a little distracted. One or two sentences per turn. Use "uh", "yeah", "okay". Don't be overly polite and don't make it easy.
- Never sell or coach; you're the customer. Only answer what you're asked, and only give details (car, size, quantity) when the seller asks or it comes up naturally.
- React honestly: if the seller is pushy, robotic or reads a list, get shorter and look for a way off the phone. If they're friendly, clear and make it easy, warm up and book.
- If you book, give a first name (make one up) and agree to a time they offer.
- Wait for the seller to answer first. Don't say who you are or that this is practice.
- If the seller says "end training", "how did I do" or "feedback": step out of character and give two short sentences: one thing that worked and one thing that would have made you book faster. Then say bye.
- Wrap up naturally once you've booked or decided not to. Keep the whole call under 4 minutes.`;

const [cmd = "setup", arg] = process.argv.slice(2);
const list = await call("GET", `/agents?search=${encodeURIComponent("sales trainer")}&page_size=10`);
let agentId = (list.agents || []).find((a) => a.name === NAME)?.agent_id;

if (cmd === "setup") {
  const body = {
    name: NAME,
    conversation_config: {
      agent: { first_message: "", language: "en", prompt: { prompt: PROMPT, llm: "gemini-2.5-flash", temperature: 0.8 }, dynamic_variables: { dynamic_variable_placeholders: { scenario: SCENARIOS[0].text } } },
      tts: { voice_id: SCENARIOS[0].voice, model_id: "eleven_v4_turbo", stability: 0.45, similarity_boost: 0.75, speed: 1.0 },
      turn: { turn_timeout: 10, turn_eagerness: "normal" },
      conversation: { max_duration_seconds: 360 },
      language_presets: { es: { overrides: { agent: { language: "es" } } } },
    },
    platform_settings: { overrides: { conversation_config_override: { tts: { voice_id: true }, agent: { language: true } } } },
  };
  if (agentId) await call("PATCH", `/agents/${agentId}`, body); else agentId = (await call("POST", "/agents/create", body)).agent_id;
  console.log("Practice-customer agent ready:", agentId);
} else if (cmd === "call") {
  if (!agentId) throw new Error("Run setup first.");
  const to = process.env.TRAINER_TO;
  if (!/^\+1\d{10}$/.test(to || "")) throw new Error("Set TRAINER_TO=+1XXXXXXXXXX (the owner's cell).");
  const nums = await call("GET", "/phone-numbers");
  const from = nums.find((p) => p.phone_number === "+13233288219");
  const i = arg != null ? Number(arg) - 1 : Math.floor(Math.random() * SCENARIOS.length);
  const s = SCENARIOS[i];
  const r = await call("POST", "/twilio/outbound-call", {
    agent_id: agentId, agent_phone_number_id: from.phone_number_id, to_number: to,
    conversation_initiation_client_data: { dynamic_variables: { scenario: s.text }, conversation_config_override: { tts: { voice_id: s.voice }, agent: { language: s.lang } } },
  });
  console.log(`Calling (scenario ${i + 1}):`, JSON.stringify(r));
} else if (cmd === "transcripts") {
  const conv = await call("GET", `/conversations?agent_id=${agentId}&page_size=${Number(arg) || 3}`);
  for (const c of conv.conversations || []) {
    const d = await call("GET", `/conversations/${c.conversation_id}`);
    console.log(`\n=== ${new Date(c.start_time_unix_secs * 1000).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} · ${c.call_duration_secs}s · ${c.conversation_id}`);
    for (const t of d.transcript || []) if (t.message) console.log(`${t.role === "agent" ? "CUSTOMER" : "OWNER"}: ${t.message}`);
  }
}
