// Simulated phone calls against Mary (the phone AI), using ElevenLabs agent testing: an AI caller
// plays each scenario, and an AI judge checks the call against its success conditions.
// Tire and time lookups hit the real site (read-only). book_appointment, save_lead and text_link are
// mocked, so tests never book, save a lead or text anyone.
//
//   node --env-file=.env.local scripts/voice-agent-tests.mjs [--only=a,b] [--failed=results.json] [--repeat=10] [--limit=N] [--out=dir]
//
// Creates the tests once (named "TP | ..."), updates them when this file changes, runs them,
// waits, and writes results.json + results.md to --out (default: the current directory).
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const API = "https://api.elevenlabs.io/v1/convai";
const key = process.env.ELEVENLABS_AGENTS_KEY;
const agentId = process.env.VOICE_AGENT_ID;
if (!key || !agentId) { console.error("Needs ELEVENLABS_AGENTS_KEY and VOICE_AGENT_ID"); process.exit(1); }
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || "").split("=")[1] || d;
const REPEAT = Number(arg("repeat", 1));
const LIMIT = Number(arg("limit", 0));
const ONLY = arg("only", "");
const OUT = arg("out", ".");
const prev = arg("failed", "") ? JSON.parse(readFileSync(arg("failed"), "utf8")) : null;
const FAILED = prev && new Set(prev.groups.filter((g) => g.fail).map((g) => g.name));
const SEEN = prev && new Set(prev.groups.map((g) => g.name));

async function call(method, p, body) {
  for (let i = 0; ; i++) {
    const r = await fetch(`${API}${p}`, { method, headers: { "xi-api-key": key, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 429 && i < 6) { await new Promise((s) => setTimeout(s, 5000 * (i + 1))); continue; }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${JSON.stringify(data).slice(0, 400)}`);
    return data;
  }
}

// ---- What every call must do, whatever the scenario ----
const ALWAYS = [
  "The agent never stated a tire price, stock level, appointment time, job duration, discount or promise that didn't come from a tool result or the shop's knowledge base. The knowledge base includes: hours (Mon-Fri 9-7, Sat 9-6, Sun 10-4), address 2331 E Olympic Blvd, TPMS sensors $199 for a set of 4 or $60 each, installed and programmed same day, rotation and rebalance $40, $20 off a first-visit service, $10 off per tire with a business license, $49 alignment with a set of 4 Kumho tires, install from $25 a wheel, prices before tax, manufacturer's warranty, free flat repairs for a year on tires bought there, optional road hazard warranty, Snap Finance, used tires inspected but priced by the shop, commercial 17.5-24.5 inch tires carry-out only. Guessing a factory tire size from the vehicle is allowed. Mentioning that install is extra and adding up tires x price is allowed.",
  "The agent asked at most one question per turn, kept replies short, and never asked for the caller's name again after the caller gave it.",
];

// ---- Situations: what the caller wants and what success looks like ----
const SIZE_STOCKED = "225/65R17"; // on the shelf today (real stock)
const S = [
  ["size-quote-book", `You need 4 new tires, size ${SIZE_STOCKED}. You give the size when asked, pick the cheapest, and book the first afternoon time offered tomorrow. Your name is Dana.`,
    ["The agent quoted prices from check_tires for 225/65R17 and booked an appointment with book_appointment (name Dana, a time from check_times).", "After the caller agreed to a time, the agent offered a wheel alignment once."]],
  ["vehicle-quote", "You don't know your tire size. You drive a 2019 Toyota Camry SE. You want a price for 4 tires, then say you'll think about it and hang up politely after one more pitch. Your name is Luis, cell 323-555-0142.",
    ["The agent worked out a likely tire size from the vehicle (asking about trim if needed) and quoted real prices instead of refusing or insisting on a photo.", "When the caller hesitated, the agent tried once more to book and then saved a lead or texted the prices before the call ended."]],
  ["vehicle-truck", "You drive a 2018 Ford F-150 XLT and want all-terrain tires. You don't know the size. Ask what they have and how much, then book for Saturday morning. Your name is Mike.",
    ["The agent figured out or asked enough to get a tire size, quoted from check_tires, and booked or saved a lead.", "The agent did not invent all-terrain models or prices that weren't in the check_tires result."]],
  ["used-tires", "You want 2 used tires, size 205/55R16, as cheap as possible. Ask how much used tires are. Your name is Rosa, cell 213-555-0199.",
    ["The agent did not make up a used tire price; it took the size and saved a lead (or booked a visit) so the team can follow up with used options.", "The agent may mention new tire prices from check_tires as an alternative, but only real ones."]],
  ["alignment-only", "You only want a wheel alignment because your car pulls to the right. Ask how much an alignment is and if you can come today. Your name is Kevin, cell 562-555-0110.",
    ["The agent did not invent an alignment price (except the $49 Kumho bundle); it offered to book the alignment visit or saved a lead for a text quote.", "The agent stayed on the alignment and didn't push a tire sale the caller didn't ask for."]],
  ["flat-repair", "You have a nail in your tire and want it fixed today. Ask how much a flat repair costs and how long it takes. Your name is Tasha.",
    ["The agent did not invent a flat repair price; it offered a time today or a walk-in, or saved a lead.", "The agent mentioned free flat repairs only as applying to tires bought there in the first year, not as free for everyone."]],
  ["tpms-light", "Your tire pressure light is on and a shop told you a sensor is bad. Ask how much TPMS sensors cost. Book if the price sounds OK. Your name is Ana.",
    ["The agent quoted TPMS sensors correctly: $199 for a set of 4 or $60 each.", "The agent asked for the appointment with specific time choices."]],
  ["rotation-deal", "You saw a rotation deal online. Ask how much a rotation and balance is, then book it for tomorrow morning. Your name is Chris.",
    ["The agent quoted the rotation and rebalance at $40 (normally $60) and booked or offered specific times."]],
  ["oil-change", "You want an oil change and ask the price for full synthetic. Your name is Brenda, cell 310-555-0177.",
    ["The agent did not invent an oil change price; it offered to book the visit or saved a lead so the shop can give the exact price."]],
  ["commercial-22", "You run a box truck and need 2 tires size 11R22.5 mounted today. Your name is Ray, cell 626-555-0123.",
    ["The agent explained that commercial 22.5 tires are carry-out only (no installation) and did not promise to mount them.", "The agent saved a lead or offered a text quote."]],
  ["warranty", "You bought tires elsewhere. Ask what warranty comes with tires at The Tire Plug and what happens if a tire can't be repaired. Then say thanks and goodbye.",
    ["The agent explained the manufacturer's warranty covers defects (not road damage), free flat repairs for the first year on repairable punctures, and the optional Road Hazard Warranty for tires that can't be repaired, without inventing a road hazard price."]],
  ["tax", `Ask the price of 4 tires in ${SIZE_STOCKED}, then ask if that includes tax, then ask the total for 4 with install. Then say you'll come by and hang up. Your name is Omar.`,
    ["When asked about tax the agent said prices are before tax, without transferring the call.", "Any total with install was given as approximate ('about'), using install from $25 a wheel."]],
  ["hours-location", "You only want to know where the shop is and if they're open on Sunday. Then say thanks and hang up.",
    ["The agent gave the address (2331 E Olympic Blvd) and Sunday hours (10 AM to 4 PM) correctly.", "The agent ended the call politely when the caller was done (it may offer help once, but must not keep pushing)."]],
  ["spanish", `Speak only Spanish. You need 4 tires size ${SIZE_STOCKED} and want to know the price and when you can come. Your name is Maria.`,
    ["The agent switched to Spanish and stayed in Spanish.", "The agent quoted real prices from check_tires and offered appointment times or booked."]],
  ["impatient", `You're in a hurry and annoyed. Say: just tell me the cheapest ${SIZE_STOCKED} price, I don't have time for questions. Push back if the agent asks too much. Your name is Jay.`,
    ["The agent gave the cheapest price quickly without making the caller answer several questions first.", "The agent stayed calm and friendly and still offered a time or a quick booking."]],
  ["walk-in", `You want 4 tires ${SIZE_STOCKED}. After hearing prices, say you'll just walk in later today. Your name is Sam.`,
    ["The agent said walk-ins are welcome but offered to hold a time (booking makes sure the tires are ready).", "The agent did not argue or pressure the caller more than once."]],
  ["price-objection", `You want 4 tires ${SIZE_STOCKED}. After hearing prices, say that's too expensive, another shop is cheaper. Your name is Pat, cell 818-555-0133.`,
    ["The agent handled the price objection by pointing to the lowest option or the value (free flat repairs, install from $25) without inventing a discount or price match.", "The agent tried once to book or saved a lead."]],
  ["wants-person", "You want to talk to a real person about a car that's at the shop right now. Insist politely.",
    ["The agent transferred the call to a person (transfer_to_number) instead of trying to sell tires."]],
  ["existing-job", "You dropped off your car this morning for brakes and want to know if it's ready. Your name is Gloria.",
    ["The agent did not make up a status; it transferred to a person or offered to have the shop call back."]],
  ["vendor", "You are a salesperson from a tire distributor wanting to talk to the owner about pricing.",
    ["The agent did not pitch tires to the vendor; it transferred or took a message, briefly."]],
  ["fleet", "You manage 12 work vans and want a business price on tires. Your name is Derek, cell 323-555-0188.",
    ["The agent mentioned $10 off every tire with a business license (no other invented discount) and saved a lead or transferred for the fleet account."]],
  ["next-day-tire", "You want 4 premium tires for a 2021 BMW 330i (225/45R18) and only want a name brand like Michelin. If it's only available next day, that's fine; book the earliest time. Your name is Elena.",
    ["If the tire chosen was next-day, the agent did not offer a same-day time (it used check_times with next_day true or offered tomorrow or later).", "The agent only offered brands and prices that check_tires returned."]],
  ["wrong-number", "You think you're calling a pizza place and want to order a large pepperoni.",
    ["The agent politely said this is a tire shop and ended the call without a sales pitch beyond one friendly line."]],
  ["discount-ask", `You want 4 tires ${SIZE_STOCKED} and ask if there are any discounts or coupons. Your name is Nina.`,
    ["The agent only mentioned real discounts ($20 off a first visit service, $10 off per tire with a business license, the $40 rotation deal) and invented none.", "The agent asked for the appointment."]],
  ["financing", `You want 4 tires ${SIZE_STOCKED} but can't pay all today. Ask if they have financing. Your name is Tony.`,
    ["The agent mentioned financing through Snap Finance without promising approval or rates.", "The agent still offered to book or saved a lead."]],
  ["no-info", "You don't know your tire size or even the exact car year; it's 'a silver Honda'. You want a price. Your name is Beth, cell 909-555-0101.",
    ["The agent tried to narrow it down with one question at a time and, if it couldn't get a size, offered to text for a sidewall photo or saved a lead, without inventing a price."]],
  ["repeat-question", `Ask for prices on ${SIZE_STOCKED}, then ask again "wait, what was the cheapest one?" and "how much for all four?" Then book for tomorrow. Your name is Hector.`,
    ["The agent repeated the cheapest option and the 4-tire total correctly and consistently with the check_tires result.", "The agent booked or offered specific times."]],
  ["text-me", `You want prices for ${SIZE_STOCKED} texted to you because you're driving. Your cell is the number you're calling from. Your name is Ivy.`,
    ["The agent used text_link to text the caller (with the size) and kept the call short.", "The agent saved a lead or offered one appointment time before ending."]],
  ["road-trip", `You're leaving on a road trip tomorrow and need 4 tires ${SIZE_STOCKED} today. Your name is Marcus.`,
    ["The agent treated it as urgent: led with in-stock tires and offered the earliest time check_times returned (if nothing was open today, saying walk-ins are welcome today is right).", "The call ended with a booked appointment, a saved lead, or the caller clearly planning to walk in today."]],
  ["brakes", "Your brakes squeak on a 2012 Toyota Camry and you want a price for front brakes. Push twice for a phone price. If you get a starting price or a free inspection offer, book for tomorrow. Your name is Alex, cell 323-555-0170.",
    ["The agent asked about the problem and vehicle, never invented a brake price, and did not just repeat that it can't give a price: it offered the free inspection and/or a texted estimate.", "The call ended with a booked appointment or a saved lead with the vehicle and problem."]],
  ["kumho-alignment", "You want 4 Kumho tires for a 2017 Honda Civic LX (215/55R16) and ask if there's any deal with an alignment. Your name is Jess.",
    ["The agent quoted only check_tires prices. If no Kumho tire came back from check_tires, the agent did not offer the $49 alignment as if it applied (explaining that the deal is only with a Kumho set is fine).", "The agent offered or booked an appointment."]],
];

// Three ways each caller can sound.
const PERSONAS = [
  ["calm", "Speak naturally and answer questions when asked."],
  ["short", "Give short, one- or two-word answers and don't volunteer information unless asked."],
  ["chatty", "Be chatty: ask a side question or two (like how long it takes) before getting to the point, and interrupt once."],
];

const tests = S.flatMap(([id, scenario, checks]) => PERSONAS.map(([pid, style]) => ({
  name: `TP | ${id} | ${pid}`,
  scenario: `You are calling The Tire Plug, a tire shop in Los Angeles. ${scenario} ${style} End the call when you're done.`,
  checks: [...checks, ...ALWAYS],
}))).filter((t) => !ONLY || ONLY.split(",").some((o) => t.name.includes(o)))
  // --failed=<results.json>: rerun only what failed in that run (use --only for new tests).
  .filter((t) => !FAILED || FAILED.has(t.name))
  .slice(0, LIMIT || undefined);

// ---- Mocks for the tools with side effects ----
const toolList = (await call("GET", "/tools")).tools || [];
const toolId = (name) => toolList.find((t) => t.tool_config?.name === name)?.id;
const MOCKS = {
  // No time in the mock: it can't echo the slot the caller picked, so the agent repeats the one it booked.
  book_appointment: { ok: true, say: "Booked for the time the caller picked. A confirmation text is on its way if they said OK. Address is 2331 East Olympic Boulevard." },
  save_lead: { ok: true, say: "Saved. Tell them someone from the shop will follow up, and they can call back anytime." },
  text_link: { ok: true, say: "Sent. Tell the caller the link is on its way by text." },
};
const mocked = Object.keys(MOCKS).map((n) => [n, toolId(n)]);
if (mocked.some(([, id]) => !id)) throw new Error(`Missing tool ids: ${mocked.filter(([, id]) => !id).map(([n]) => n)}`);

// ---- Create or update the tests ----
const existing = new Map();
for (let cursor = null, i = 0; i < 20; i++) {
  const page = await call("GET", `/agent-testing?page_size=100${cursor ? `&cursor=${cursor}` : ""}`);
  for (const t of page.tests || []) existing.set(t.name, t.id);
  if (!page.has_more) break;
  cursor = page.next_cursor;
}
const ids = [];
for (const t of tests) {
  const body = {
    name: t.name, type: "simulation",
    simulation_scenario: t.scenario, simulation_max_turns: 14,
    success_conditions: t.checks,
    dynamic_variables: { system__caller_id: "+13235550142" },
    tool_mock_config: { mocking_strategy: "selected", fallback_strategy: "raise_error", mocked_tool_ids: mocked.map(([, id]) => id) },
    tool_mock_overrides: Object.fromEntries(mocked.map(([n, id]) => [id, [{ mock_result: JSON.stringify(MOCKS[n]), parameter_conditions: [] }]])),
    conversation_initiation_source: "twilio",
  };
  const id = existing.get(t.name);
  if (id) { await call("PUT", `/agent-testing/${id}`, body); ids.push(id); }
  else ids.push((await call("POST", "/agent-testing/create", body)).id);
}
console.log(`${ids.length} tests ready; running each ${REPEAT}x = ${ids.length * REPEAT} calls`);

// ---- Run in chunks and wait ----
const runs = [];
for (let i = 0; i < ids.length; i += 25) {
  const inv = await call("POST", `/agents/${agentId}/run-tests`, { tests: ids.slice(i, i + 25).map((test_id) => ({ test_id })), repeat_count: REPEAT, name: `Tire Plug suite ${new Date().toISOString().slice(0, 16)}` });
  for (;;) {
    await new Promise((s) => setTimeout(s, 15000));
    const cur = await call("GET", `/test-invocations/${inv.id}`);
    const pending = cur.test_runs.filter((r) => r.status === "pending").length;
    process.stdout.write(`\r  batch ${i / 25 + 1}: ${cur.test_runs.length - pending}/${cur.test_runs.length} done   `);
    if (!pending) { runs.push(...cur.test_runs); break; }
  }
  console.log("");
}

// ---- Report ----
const byTest = new Map();
for (const r of runs) {
  const g = byTest.get(r.test_name) || { name: r.test_name, pass: 0, fail: 0, credits: 0, failures: [] };
  g[r.status === "passed" ? "pass" : "fail"]++;
  g.credits += r.credits_used || 0;
  if (r.status !== "passed") g.failures.push({
    why: (r.condition_result?.rationale?.messages || []).filter((m) => /failed/i.test(m)).join(" ") || r.condition_result?.rationale?.summary || "no reason given",
    transcript: (r.agent_responses || []).map((m) => `${m.role === "agent" ? "Mary" : "Caller"}: ${m.message || (m.tool_calls || []).map((c) => `[${c.tool_name} ${c.params_as_json}]`).join(" ")}`).join("\n"),
  });
  byTest.set(r.test_name, g);
}
const groups = [...byTest.values()].sort((a, b) => b.fail - a.fail);
const pass = runs.filter((r) => r.status === "passed").length;
const credits = runs.reduce((a, r) => a + (r.credits_used || 0), 0);
mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ at: new Date().toISOString(), runs: runs.length, pass, credits, groups }, null, 1));
writeFileSync(path.join(OUT, "results.md"), [
  `# Mary test calls: ${pass}/${runs.length} passed (${Math.round((100 * pass) / runs.length)}%)`,
  `Credits used: ${credits}`, "",
  ...groups.map((g) => `- ${g.fail ? "❌" : "✅"} ${g.name}: ${g.pass}/${g.pass + g.fail}`),
  "", "## Failures", "",
  ...groups.filter((g) => g.fail).flatMap((g) => [`### ${g.name}`, ...g.failures.slice(0, 2).flatMap((f) => [`**Why:** ${f.why}`, "```", f.transcript, "```"])]),
].join("\n"));
console.log(`Passed ${pass}/${runs.length} (${Math.round((100 * pass) / runs.length)}%), credits ${credits}. Report: ${path.join(OUT, "results.md")}`);
