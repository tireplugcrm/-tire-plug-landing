// ElevenLabs credit balance (Mary the phone AI, the shop TV voice and Jarvis's calls all draw on it).
// Reads the plan with ELEVENLABS_AGENTS_KEY (needs the read-only "User" permission). When credits run
// out Mary may stop answering, so Jarvis's watchdog and the daily phone report flag it early.
// Burn rate = credits used so far this billing month / days into the month.

const MONTH = 30 * 864e5;
export const LOW_PCT = 25;   // flag under this share left
export const LOW_DAYS = 3;   // or when it runs out within this many days at the current pace

export async function elevenCredits() {
  const key = process.env.ELEVENLABS_AGENTS_KEY;
  if (!key) return null;
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { error: `ElevenLabs ${r.status}` };
    const s = await r.json();
    const resetsAt = s.next_character_count_reset_unix * 1000;
    const daysIn = Math.max(0.5, (Date.now() - (resetsAt - MONTH)) / 864e5);
    const left = s.character_limit - s.character_count;
    const perDay = s.character_count / daysIn;
    const daysLeft = perDay > 0 ? Math.round((10 * left) / perDay) / 10 : null;
    const pctLeft = Math.round((100 * left) / s.character_limit);
    const resetsInDays = Math.round((10 * (resetsAt - Date.now())) / 864e5) / 10;
    return {
      plan: s.tier, used: s.character_count, limit: s.character_limit, left, pct_left: pctLeft,
      per_day: Math.round(perDay), days_left: daysLeft, resets_at: new Date(resetsAt).toISOString(), resets_in_days: resetsInDays,
      // Low: under 25% left, or at this pace it runs out in 3 days AND before the plan resets.
      low: pctLeft < LOW_PCT || (daysLeft != null && daysLeft < LOW_DAYS && daysLeft < resetsInDays),
      minutes_left_est: Math.round(left / 460), // Mary uses about 460 credits a minute of call
    };
  } catch (e) {
    return { error: e.message };
  }
}

export const creditsLine = (c) => (!c || c.error ? null
  : `ElevenLabs credits: ${c.left.toLocaleString("en-US")} left (${c.pct_left}%, about ${c.minutes_left_est} min of calls), resets in ${Math.round(c.resets_in_days)} days.${c.low ? " LOW: upgrade or add credits so Alejandro keeps answering." : ""}`);
