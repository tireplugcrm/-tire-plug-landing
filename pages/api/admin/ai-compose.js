/**
 * AI assistant for the leads dashboard (password gated).
 * mode "quote" — turn the rep-entered quote box into a friendly customer text.
 * mode "reply" — draft the next reply to the customer's question, using the
 *                shop facts sheet (hours, locations, warranties, services).
 *
 * Returns { draft }. Never invents prices — quote numbers come only from the rep.
 * Uses ANTHROPIC_API_KEY (same as the hiring AI). Human reviews before sending.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { SHOP_FACTS, AI_VOICE } from "../../../lib/shop-facts.js";

const MODEL = process.env.LEADS_AI_MODEL || "claude-sonnet-4-6";

async function askClaude(prompt, maxTokens = 350) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  return (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

function firstName(name) { return (name || "").trim().split(/\s+/)[0] || "there"; }

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  const { lead_id, mode, quotes, road_hazard, services } = req.body || {};
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "AI is not set up (missing key)." });
  if (!supabaseAdmin || !lead_id) return res.status(400).json({ error: "Missing config or lead." });

  // Load the lead + recent conversation
  const { data: lead } = await supabaseAdmin.from("leads").select("*").eq("id", lead_id).single();
  if (!lead) return res.status(404).json({ error: "Lead not found." });

  const { data: msgs } = await supabaseAdmin
    .from("lead_messages").select("direction, body, created_at")
    .eq("lead_id", lead_id).order("created_at", { ascending: true }).limit(20);

  const convo = (msgs || []).slice(-12)
    .map((m) => `${m.direction === "outbound" ? "Shop" : "Customer"}: ${m.body}`)
    .join("\n") || "(no messages yet)";

  const fn = firstName(lead.name);

  let prompt;
  if (mode === "quote") {
    const rows = (quotes && quotes.length ? quotes : lead.quotes || []).filter((r) => r.brand && r.price);
    if (!rows.length) return res.status(400).json({ error: "Enter at least one brand and price in the quote box first." });
    const lines = rows.map((r) => {
      const qty = Number(r.qty) || 0;
      const total = (Number(r.price) || 0) * qty;
      return `- ${r.brand}: $${r.price} each${qty ? ` x ${qty} = $${total}` : ""}${r.warranty ? ` (warranty: ${r.warranty})` : ""}`;
    }).join("\n");

    const rh = Number(road_hazard != null && road_hazard !== "" ? road_hazard : lead.road_hazard_per_tire) || 0;
    const rhLine = rh > 0
      ? `\nOPTIONAL ADD-ON the rep set — Road Hazard Warranty: $${rh} per tire (covers pothole, nail, curb & debris damage). Mention it briefly as an optional upgrade.`
      : "";

    const svc = services || lead.services || {};
    const svcParts = [];
    if (svc.alignment) svcParts.push(`- Wheel Alignment: $${svc.alignment}`);
    if (svc.oilChange) svcParts.push(`- Oil Change: $${svc.oilChange}`);
    if (svc.tpmsSet || svc.tpmsEach) {
      const t = [];
      if (svc.tpmsSet) t.push(`$${svc.tpmsSet} for all 4`);
      if (svc.tpmsEach) t.push(`$${svc.tpmsEach} each`);
      svcParts.push(`- TPMS Sensors: ${t.join(" or ")}`);
    }
    const svcLines = svcParts.join("\n");
    const svcBlock = svcLines ? `\n\nADD-ON SERVICES the rep also quoted (offer these too, exact prices):\n${svcLines}` : "";

    prompt = `You are a rep at The Tire Plug texting a customer their tire quote.

VOICE: ${AI_VOICE}

CUSTOMER FIRST NAME: ${fn}
VEHICLE: ${lead.vehicle || "their vehicle"}

THE QUOTE THE REP ENTERED (use these exact numbers — do not add or change any price):
${lines}${rhLine}${svcBlock}

RECENT CONVERSATION:
${convo}

Write a short, friendly text presenting this quote: per-tire price and the full set total for each option (and mention the mileage warranty when one is listed).
${rh > 0 ? "Briefly offer the optional Road Hazard Warranty at its per-tire price. " : ""}${svcLines ? "Also offer the add-on services with their prices. " : ""}Use ONLY the brand name(s) given — do NOT invent a tire model name or any detail not listed above. End with a light call to action to book or come in. Keep it to 2-5 sentences. Output ONLY the message text, nothing else.`;
  } else {
    // mode "reply"
    prompt = `You are a rep at The Tire Plug texting with a potential customer. Write the next reply.

VOICE: ${AI_VOICE}

SHOP FACTS (the ONLY facts you may state; never invent anything, especially prices):
${SHOP_FACTS}

CUSTOMER FIRST NAME: ${fn}

CONVERSATION SO FAR:
${convo}

Write the shop's next text reply to the customer's most recent message. Answer their question (hours,
locations, warranties, services, etc.) using only the shop facts. If they ask about price and no quote
has been given, tell them you're getting an exact quote / they can call 562-513-0217 — do not guess a price.
If something isn't in the facts, say you'll confirm rather than make it up. Keep it short and natural.
Output ONLY the message text, nothing else.`;
  }

  try {
    const draft = await askClaude(prompt);
    if (!draft) return res.status(502).json({ error: "AI returned nothing — try again." });
    return res.status(200).json({ draft });
  } catch (err) {
    return res.status(502).json({ error: "AI request failed — try again." });
  }
}
