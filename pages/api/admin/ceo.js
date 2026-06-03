/**
 * CEO Agent — reads the live scoreboard (TireBase) + the CRM leads and writes
 * a plain-English daily briefing with specific recommendations. Password/Google gated.
 */
import { requireAdmin } from "../../../lib/adminAuth.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { fetchDayScoreboard } from "../../../lib/tirebase.js";

const MODEL = process.env.LEADS_AI_MODEL || "claude-sonnet-4-6";

async function askClaude(prompt, maxTokens = 600) {
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "AI is not set up (missing key)." });

  // 1) Live scoreboard (today)
  let sb = null;
  try { sb = await fetchDayScoreboard({ date: (req.body || {}).date, store_id: 1 }); } catch (e) { sb = null; }

  // 2) Lead stats
  let leadStats = {};
  if (supabaseAdmin) {
    try {
      const { data: leads } = await supabaseAdmin.from("leads").select("status, lead_priority, source, revenue_amount, booked_at, created_at");
      const ym = new Date().toISOString().slice(0, 7);
      const all = leads || [];
      const active = all.filter((l) => l.status === "new" || l.status === "called");
      const bookedMonth = all.filter((l) => l.status === "booked" && String(l.booked_at || "").slice(0, 7) === ym);
      const monthRev = bookedMonth.reduce((s, l) => s + Number(l.revenue_amount || 0), 0);
      // revenue by source this month
      const bySource = {};
      bookedMonth.forEach((l) => { const s = l.source || "unknown"; bySource[s] = (bySource[s] || 0) + Number(l.revenue_amount || 0); });
      leadStats = {
        activeLeads: active.length,
        uncontacted: all.filter((l) => l.status === "new").length,
        hotActive: active.filter((l) => l.lead_priority === "HOT").length,
        bookedThisMonth: bookedMonth.length,
        leadRevenueThisMonth: Math.round(monthRev),
        revenueBySource: bySource,
      };
      const { data: rem } = await supabaseAdmin.from("reminders").select("due_at").eq("done", false);
      const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
      leadStats.followUpsDue = (rem || []).filter((r) => new Date(r.due_at) <= endToday).length;
    } catch (e) { /* leave leadStats partial */ }
  }

  // 3) Ops snapshot — jobs on the floor + reactivation opportunity
  let ops = { jobs: { waiting: 0, in_bay: 0, done: 0 }, dueForTires: 0 };
  if (supabaseAdmin) {
    try {
      const { data: wos } = await supabaseAdmin.from("work_orders").select("status").eq("archived", false);
      for (const w of wos || []) { if (ops.jobs[w.status] != null) ops.jobs[w.status] += 1; }
      const _d = new Date(); _d.setDate(_d.getDate() - 365 * 3);
      const threeYrAgo = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, "0")}-${String(_d.getDate()).padStart(2, "0")}`;
      const { count } = await supabaseAdmin.from("customers").select("*", { count: "exact", head: true }).lt("last_tire_date", threeYrAgo);
      ops.dueForTires = count || 0;
    } catch (e) { /* leave ops default */ }
  }

  const prompt = `You are the sharp, no-nonsense operations advisor (CEO agent) for The Tire Plug, a Los Angeles tire & auto shop with daily goals.

TODAY'S LIVE NUMBERS (from the register):
${sb ? JSON.stringify({ revenue: sb.revenue, invoices: sb.invoices, services_vs_goals: Object.fromEntries(Object.keys(sb.goals).map((k) => [k, `${sb.services[k]}/${sb.goals[k]}`])), payments: sb.payments }) : "(scoreboard unavailable right now)"}

CRM / LEADS:
${JSON.stringify(leadStats)}

SHOP FLOOR (open jobs) + REACTIVATION OPPORTUNITY:
${JSON.stringify(ops)}

Write a daily briefing for the owner. Use ONLY these numbers — never invent data. Format:
- 2-3 punchy sentences summarizing where the day stands (revenue pace, what's strong, what's lagging).
- Then a blank line, then 2-4 bullet recommendations starting with "•", each a specific action (what to push, which lagging goal to chase, which leads to chase, jobs stuck on the floor, and how many customers are due for new tires to call back). Be direct and concrete with the numbers.
Keep it tight and useful. Output ONLY the briefing text.`;

  try {
    const briefing = await askClaude(prompt);
    if (!briefing) return res.status(502).json({ error: "AI returned nothing — try again." });
    return res.status(200).json({ briefing, scoreboard: sb, leadStats, ops });
  } catch (e) {
    return res.status(502).json({ error: "AI request failed — try again." });
  }
}
