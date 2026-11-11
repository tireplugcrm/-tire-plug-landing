// Which to-do items count on which day. Safe in the browser and on the server.
// A section whose heading has a date ("## Thursday 11/12") is for that day only; any other section
// ("## Morning") repeats every day. Checks on repeating items clear each morning; checks on dated
// items stay, because that item only comes up once.

const taskText = (l) => l.replace(/^\s*[-*]\s+(\[[ xX]\]\s+)?/, "").trim();

/** [{ text, day }] for every "- " line; day is "MM-DD" for a dated section, else null. */
export function listTasks(text) {
  const out = [];
  let day = null;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const l = raw.trim();
    if (/^##+\s/.test(l)) {
      const m = l.match(/\b(\d{1,2})\/(\d{1,2})\b/);
      day = m ? `${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
    } else if (/^[-*]\s/.test(l)) {
      const t = taskText(l);
      if (t) out.push({ text: t, day });
    }
  }
  return out;
}

/** The items that count today (today = "YYYY-MM-DD"): repeating ones plus today's dated ones. */
export function tasksForDay(text, today) {
  const mmdd = String(today).slice(5);
  return listTasks(text).filter((t) => t.day === null || t.day === mmdd);
}

/**
 * Checks still standing today. `lastDay` is the last day the list was touched: on a new day, checks on
 * repeating items are dropped and checks on dated items stay.
 */
export function ticksForDay({ text, done, skipped, lastDay, today }) {
  const d = Array.isArray(done) ? done : [], s = Array.isArray(skipped) ? skipped : [];
  if (lastDay === today) return { done: d, skipped: s };
  const dated = new Set(listTasks(text).filter((t) => t.day !== null).map((t) => t.text));
  return { done: d.filter((x) => dated.has(x)), skipped: s.filter((x) => dated.has(x)) };
}

/** Today in shop time, "YYYY-MM-DD" (for the browser; the server has shopDay). */
export const shopToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
