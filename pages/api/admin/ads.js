/**
 * Meta Ads — Level 0 (read-only) insights for the admin dashboard.
 *
 * Pulls campaign performance from the Meta Marketing API (spend, reach, results,
 * cost-per-result) and pairs it with booked revenue from our own leads table to
 * show a blended ROAS. Owner/Google gated like every other admin route.
 *
 * This is READ-ONLY (ads_read). It never creates, pauses, or edits a campaign —
 * that's a later level and needs the stricter ads_management permission.
 *
 * Setup (see ADS-SETUP.md): two Vercel env vars —
 *   META_ACCESS_TOKEN     long-lived System User token with ads_read
 *   META_AD_ACCOUNT_ID    the ad account number (with or without the act_ prefix)
 * Optional:
 *   META_GRAPH_VERSION    Graph API version, default v21.0
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

// Meta reports outcomes as an "actions" array. These are the action_types we count
// as a "result" for a tire shop (a lead form, a pixel lead, or a started DM).
const RESULT_ACTIONS = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.messaging_first_reply",
]);

// Supported date windows -> [Meta date_preset, days-back for our revenue match].
const RANGES = {
  last_7d: { preset: "last_7d", days: 7, label: "Last 7 days" },
  last_30d: { preset: "last_30d", days: 30, label: "Last 30 days" },
  last_90d: { preset: "last_90d", days: 90, label: "Last 90 days" },
  this_month: { preset: "this_month", days: null, label: "This month" },
};

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

// Pull the "results" (lead-ish actions) and link clicks out of an insights row.
function summarizeActions(actions) {
  let results = 0, linkClicks = 0;
  for (const a of actions || []) {
    if (RESULT_ACTIONS.has(a.action_type)) results += num(a.value);
    if (a.action_type === "link_click") linkClicks += num(a.value);
  }
  return { results, linkClicks };
}

// Start-of-window as an ISO string, for matching booked revenue to the ad window.
function windowStartISO(range) {
  const now = new Date();
  if (range.days != null) return new Date(now.getTime() - range.days * 86400000).toISOString();
  // this_month -> first of the current month
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });

  const token = process.env.META_ACCESS_TOKEN;
  const rawAccount = process.env.META_AD_ACCOUNT_ID;
  if (!token || !rawAccount) {
    return res.status(200).json({
      ok: false,
      needsSetup: true,
      error: "Meta Ads isn't connected yet.",
    });
  }
  const account = `act_${String(rawAccount).replace(/^act_/, "")}`;

  const range = RANGES[req.body?.range] || RANGES.last_30d;

  try {
    // ---- 1) Ad spend + results from Meta ----
    const params = new URLSearchParams({
      level: "campaign",
      fields: "campaign_id,campaign_name,spend,reach,impressions,clicks,actions",
      date_preset: range.preset,
      limit: "200",
      access_token: token,
    });
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${account}/insights?${params}`;
    const metaRes = await fetch(url);
    const metaJson = await metaRes.json();

    if (metaJson.error) {
      // Bad/expired token or missing permission -> treat as a setup problem so the
      // dashboard shows a friendly "reconnect" card instead of a hard error.
      const m = metaJson.error.message || "Meta API error";
      const isAuth = [190, 102, 10, 200].includes(metaJson.error.code);
      return res.status(200).json({ ok: false, needsSetup: isAuth, error: m });
    }

    const campaigns = (metaJson.data || []).map((row) => {
      const spend = num(row.spend);
      const { results, linkClicks } = summarizeActions(row.actions);
      return {
        id: row.campaign_id,
        name: row.campaign_name || "(unnamed campaign)",
        spend,
        reach: num(row.reach),
        impressions: num(row.impressions),
        clicks: num(row.clicks) || linkClicks,
        results,
        costPerResult: results > 0 ? spend / results : null,
      };
    }).sort((a, b) => b.spend - a.spend);

    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
    const totalResults = campaigns.reduce((s, c) => s + c.results, 0);
    const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);

    // ---- 2) Booked revenue from our own leads, over the same window ----
    // NOTE: this is ALL booked web-lead revenue, not only ad-sourced. True per-ad
    // attribution needs click tracking (UTM/fbclid) — that's the next level up.
    // So the ROAS below is a *blended* signal, labeled as such in the UI.
    let revenue = null, bookedCount = null;
    if (supabaseAdmin) {
      const startISO = windowStartISO(range);
      const { data: booked, error } = await supabaseAdmin
        .from("leads")
        .select("revenue_amount, booked_at")
        .eq("status", "booked")
        .gte("booked_at", startISO);
      if (!error && booked) {
        revenue = booked.reduce((s, l) => s + num(l.revenue_amount), 0);
        bookedCount = booked.length;
      }
    }

    const roas = revenue != null && totalSpend > 0 ? revenue / totalSpend : null;

    return res.status(200).json({
      ok: true,
      range: req.body?.range && RANGES[req.body.range] ? req.body.range : "last_30d",
      rangeLabel: range.label,
      currency: metaJson.data?.[0]?.account_currency || "USD",
      campaigns,
      totals: {
        spend: totalSpend,
        results: totalResults,
        impressions: totalImpressions,
        costPerResult: totalResults > 0 ? totalSpend / totalResults : null,
        revenue,
        bookedCount,
        roas,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Failed to load ads." });
  }
}
