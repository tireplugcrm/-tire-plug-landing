// Owner's "is she using it?" card at the top of the admin Belen tab: when Belen last opened /belen,
// which of the last 7 days she opened it, today's to-do progress, and a timeline of what she did.
// Data: /api/belen action "activity" (lib/staff-activity.js) + her to-do list (/api/admin/todo).
import React, { useEffect, useState } from "react";
import { T, ui, Icon } from "./ui.js";
import { tasksForDay } from "../../lib/todo-days.js";

const TZ = "America/Los_Angeles";
const dayOf = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const time = (iso) => new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const TAB = { today: "Today", know: "Good to know", pay: "My pay", commission: "Commission", bonus: "My bonus" };

function when(iso) {
  if (!iso) return "Never";
  const d = dayOf(iso), today = dayOf(new Date().toISOString()), yest = dayOf(new Date(Date.now() - 864e5).toISOString());
  const label = d === today ? "Today" : d === yest ? "Yesterday" : new Date(iso).toLocaleDateString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });
  return `${label}, ${time(iso)}`;
}
function say(e) {
  if (e.event === "open") return "Opened her page";
  if (e.event === "tab") return `Looked at ${TAB[e.detail] || e.detail}`;
  if (e.event === "tick") return `Checked off: ${e.detail}`;
  if (e.event === "untick") return `Unchecked: ${e.detail}`;
  if (e.event === "skip") return `Scratched: ${e.detail}`;
  if (e.event === "unskip") return `Un-scratched: ${e.detail}`;
  if (e.event === "reminder") return `Reminder text sent (${e.detail})`;
  if (e.event === "add_account") return `Added a business: ${e.detail}`;
  return e.event;
}
const ICON = { open: "login", tab: "tab", tick: "check_circle", untick: "radio_button_unchecked", skip: "cancel", unskip: "undo", reminder: "sms", add_account: "add_business" };

export default function BelenActivity({ auth }) {
  const [events, setEvents] = useState(null);
  const [todo, setTodo] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);

  const post = async (url, body) => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Request failed");
    return j;
  };
  const load = () => {
    post("/api/belen", { action: "activity" }).then((j) => setEvents(j.events)).catch((e) => setErr(e.message));
    post("/api/admin/todo", { action: "get", who: "belen", list: "todo" }).then(setTodo).catch(() => {});
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <div style={{ ...ui.card, color: T.red, marginBottom: 12, fontSize: 13.5 }}>Activity: {err}</div>;
  if (!events) return <div style={{ ...ui.card, ...ui.muted, marginBottom: 12 }}>Loading Belen&apos;s activity…</div>;

  const today = dayOf(new Date().toISOString());
  const opens = events.filter((e) => e.event === "open");
  const lastSeen = events[0]?.at || null;
  const todayEv = events.filter((e) => dayOf(e.at) === today);
  const week = Array.from({ length: 7 }, (_, i) => {
    const iso = new Date(Date.now() - (6 - i) * 864e5).toISOString();
    const d = dayOf(iso);
    return { d, label: new Date(iso).toLocaleDateString("en-US", { timeZone: TZ, weekday: "narrow" }), on: events.some((e) => dayOf(e.at) === d) };
  });
  const todayTasks = todo ? tasksForDay(todo.text, today).map((t) => t.text) : [];
  const tasks = todayTasks.length;
  const done = todo ? todayTasks.filter((t) => todo.done.includes(t)).length : 0;
  const scratched = todo ? todayTasks.filter((t) => (todo.skipped || []).includes(t) && !todo.done.includes(t)).length : 0;
  const reminders = todayEv.filter((e) => e.event === "reminder").length;
  const seenToday = lastSeen && dayOf(lastSeen) === today;

  return (
    <div style={{ ...ui.card, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 99, background: seenToday ? T.green : lastSeen ? T.amber : T.red }} />
          <span style={{ fontWeight: 700 }}>Is Belen using it?</span>
        </div>
        <button style={{ ...ui.btn, height: 30 }} onClick={load} title="Refresh"><Icon name="refresh" size={17} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 10 }}>
        <Stat k="Last on her page" v={when(lastSeen)} warn={!seenToday} />
        <Stat k="Opened today" v={`${todayEv.filter((e) => e.event === "open").length} time${todayEv.filter((e) => e.event === "open").length === 1 ? "" : "s"}`} />
        <Stat k="To-do checked off" v={tasks ? `${done} of ${tasks}${scratched ? ` · ${scratched} scratched` : ""}` : "—"} warn={tasks > 0 && done + scratched < tasks} />
        <Stat k="Reminders texted today" v={String(reminders)} />
        <Stat k="Businesses added (14 days)" v={String(events.filter((e) => e.event === "add_account").length)} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
        <span style={{ ...ui.muted, fontSize: 12, marginRight: 4 }}>Last 7 days</span>
        {week.map((w) => (
          <span key={w.d} title={`${w.d}: ${w.on ? "used it" : "didn't open it"}`} style={{ width: 26, height: 26, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, background: w.on ? "rgba(52,211,153,0.25)" : T.hover, border: `1px solid ${w.on ? "rgba(52,211,153,0.6)" : T.border}`, color: w.on ? T.text : T.textFaint }}>{w.label}</span>
        ))}
        <span style={{ ...ui.muted, fontSize: 12, marginLeft: 4 }}>{week.filter((w) => w.on).length}/7 · {opens.length} opens in 14 days</span>
      </div>

      <button onClick={() => setOpen(!open)} style={{ ...ui.btn, height: 30, marginTop: 12 }}>
        <Icon name={open ? "expand_less" : "expand_more"} size={18} />{open ? "Hide" : "Show"} what she did
      </button>
      {open && (
        <div style={{ marginTop: 8, maxHeight: 320, overflowY: "auto" }}>
          {events.length === 0 && <div style={ui.muted}>Nothing yet. She hasn&apos;t opened tireplugla.com/belen since tracking started.</div>}
          {events.slice(0, 100).map((e, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0", borderTop: i ? `1px solid ${T.border}` : "none", fontSize: 13.5 }}>
              <Icon name={ICON[e.event] || "circle"} size={18} style={{ color: e.event === "tick" ? T.green : T.textMuted, marginTop: 1 }} />
              <span style={{ flex: 1, minWidth: 0 }}>{say(e)}</span>
              <span style={{ color: T.textFaint, fontSize: 12, whiteSpace: "nowrap" }}>{when(e.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ k, v, warn }) {
  return (
    <div>
      <div style={{ color: T.textMuted, fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: warn ? T.amber : T.text }}>{v}</div>
    </div>
  );
}
