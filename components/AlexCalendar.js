// The owner's calendar: his meetings + customer appointments, day by day, a "Schedule a meeting" form
// that texts the staff member, and the iPhone Calendar link. Used by /alex and the admin "Alex" tab.
// Data: /api/alex (call() adds the auth).
import React, { useEffect, useState } from "react";
import { T, Icon, ui } from "./admin/ui.js";

const TZ = "America/Los_Angeles";
const dayKey = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const dayLabel = (k) => new Date(`${k}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
const time = (iso) => new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const todayKey = () => dayKey(new Date().toISOString());
function weekStart(offset) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7); return d; }
function nextHalfHour() { const d = new Date(Date.now() + 60 * 60000); d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }

export default function AlexCalendar({ call }) {
  const [week, setWeek] = useState(0);
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(false);
  const [people, setPeople] = useState(false);

  const range = () => { const from = weekStart(week); const to = new Date(from); to.setDate(to.getDate() + 14); return { from: from.toISOString(), to: to.toISOString() }; };
  async function run(body) {
    setBusy(true); setErr("");
    try { const d = await call({ ...range(), ...body }); setS(d); return d; }
    catch (e) { setErr(e.message); return null; } finally { setBusy(false); }
  }
  useEffect(() => { run({ action: "state" }); /* eslint-disable-next-line */ }, [week]);

  if (!s) return <div style={{ color: T.textMuted, padding: 24, textAlign: "center" }}>{err || "Loading…"}</div>;

  const from = weekStart(week);
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(from); d.setDate(d.getDate() + i); return d.toLocaleDateString("en-CA"); });
  const byDay = {};
  for (const e of s.entries) (byDay[dayKey(e.at)] = byDay[dayKey(e.at)] || []).push(e);
  const today = todayKey();

  return (
    <div style={{ color: T.text }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button style={ui.primary} onClick={() => { setForm(!form); setMsg(""); }}><Icon name={form ? "close" : "event"} size={18} />{form ? "Close" : "Schedule a meeting"}</button>
        {s.feed && <a href={s.feed} style={ui.btn}><Icon name="calendar_add_on" size={18} />Add to iPhone Calendar</a>}
        <button style={ui.btn} onClick={() => setPeople(!people)}><Icon name="contacts" size={18} />People</button>
      </div>
      {msg && <div style={{ ...ui.card, marginBottom: 10, color: T.green, fontSize: 14 }}>{msg}</div>}
      {form && <MeetingForm people={s.people} busy={busy} onSave={async (m) => {
        const d = await run({ action: "addMeeting", ...m, starts_at: new Date(m.local).toISOString() });
        if (d) { setForm(false); setMsg(d.added?.texted ? `Saved, and ${m.with_name} got a text.` : d.added?.text_error ? `Saved. Text not sent: ${d.added.text_error}` : "Saved to your calendar."); }
      }} />}
      {people && <PeopleEditor list={s.people} busy={busy} onSave={async (list) => { if (await run({ action: "people", people: list })) setPeople(false); }} />}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "6px 0 10px" }}>
        <button aria-label="Earlier" style={{ ...ui.btn, width: 40, padding: 0 }} onClick={() => setWeek(week - 1)}><Icon name="chevron_left" /></button>
        <div style={{ fontWeight: 700 }}>{week === 0 ? "This week and next" : `${dayLabel(days[0])} – ${dayLabel(days[13])}`}</div>
        <button aria-label="Later" style={{ ...ui.btn, width: 40, padding: 0 }} onClick={() => setWeek(week + 1)}><Icon name="chevron_right" /></button>
      </div>

      {days.map((k) => {
        const list = byDay[k] || [];
        if (!list.length && k !== today) return null;
        return (
          <div key={k} style={{ ...ui.card, marginBottom: 8, padding: "0.7rem 1rem" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: k === today ? T.amber : T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{k === today ? "Today · " : ""}{dayLabel(k)}</div>
            {!list.length && <div style={{ color: T.textFaint, fontSize: 13.5 }}>Nothing booked.</div>}
            {list.map((e) => (
              <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 0", borderTop: `1px solid ${T.border}` }}>
                <div style={{ width: 64, flex: "none", fontWeight: 600, fontSize: 13.5 }}>{time(e.at)}</div>
                <Icon name={e.kind === "appt" ? "tire_repair" : "groups"} size={18} style={{ color: e.kind === "appt" ? T.textMuted : T.blue, marginTop: 1 }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
                  <div style={{ fontWeight: 600 }}>{e.title}{e.with_name ? <span style={{ color: T.textMuted, fontWeight: 400 }}> · with {e.with_name}</span> : null}</div>
                  <div style={{ color: T.textMuted, fontSize: 12.5 }}>
                    {e.kind === "appt" ? [e.vehicle, "customer appointment"].filter(Boolean).join(" · ") : [`${e.minutes} min`, e.place, e.notes].filter(Boolean).join(" · ")}
                    {e.kind === "meeting" && e.with_name ? (e.texted_at ? " · texted ✓" : e.text_error ? ` · not texted (${e.text_error})` : " · not texted") : ""}
                  </div>
                </div>
                {e.kind === "meeting" && <button aria-label="Remove" style={{ ...ui.btn, width: 30, height: 30, padding: 0 }} disabled={busy} onClick={() => window.confirm(`Remove "${e.title}"? No text goes out.`) && run({ action: "removeMeeting", id: e.id })}><Icon name="close" size={16} /></button>}
              </div>
            ))}
          </div>
        );
      })}
      {err && <p style={{ color: T.red, fontWeight: 600, textAlign: "center" }}>{err}</p>}
    </div>
  );
}

function MeetingForm({ people, busy, onSave }) {
  const [m, setM] = useState({ title: "", with_name: "", local: nextHalfHour(), minutes: 30, place: "", notes: "", text: true });
  const person = people.find((p) => p.name === m.with_name);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(m); }} style={{ ...ui.card, marginBottom: 10, display: "grid", gap: 8 }}>
      <input placeholder="What's it about? (e.g. Weekly check-in)" value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} style={inp} required />
      <select value={m.with_name} onChange={(e) => setM({ ...m, with_name: e.target.value })} style={inp}>
        <option value="" style={{ color: "#111" }}>Just me (no one to text)</option>
        {people.map((p) => <option key={p.name} value={p.name} style={{ color: "#111" }}>{p.name}{p.phone ? "" : " (no phone saved)"}</option>)}
      </select>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <input type="datetime-local" value={m.local} onChange={(e) => setM({ ...m, local: e.target.value })} style={inp} required />
        <select value={m.minutes} onChange={(e) => setM({ ...m, minutes: +e.target.value })} style={inp}>
          {[15, 30, 45, 60, 90, 120].map((n) => <option key={n} value={n} style={{ color: "#111" }}>{n} min</option>)}
        </select>
      </div>
      <input placeholder="Where (blank = the shop)" value={m.place} onChange={(e) => setM({ ...m, place: e.target.value })} style={inp} />
      <input placeholder="Notes (go in the text too)" value={m.notes} onChange={(e) => setM({ ...m, notes: e.target.value })} style={inp} />
      {m.with_name && (
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, color: person?.phone ? T.text : T.textFaint }}>
          <input type="checkbox" checked={m.text && !!person?.phone} disabled={!person?.phone} onChange={(e) => setM({ ...m, text: e.target.checked })} />
          {person?.phone ? `Text ${m.with_name} the details from the shop line` : `No phone saved for ${m.with_name}. Add it under People.`}
        </label>
      )}
      <button style={ui.primary} disabled={busy}>{busy ? "Saving…" : m.with_name && m.text && person?.phone ? `Save & text ${m.with_name}` : "Save"}</button>
    </form>
  );
}

function PeopleEditor({ list, busy, onSave }) {
  const [rows, setRows] = useState(list.map((p) => ({ ...p })).concat([{ name: "", phone: "" }]));
  const set = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div style={{ ...ui.card, marginBottom: 10, display: "grid", gap: 6 }}>
      <div style={{ color: T.textMuted, fontSize: 13 }}>Who you schedule with, and the cell their meeting texts go to.</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <input placeholder="Name" value={r.name} onChange={(e) => set(i, "name", e.target.value)} style={inp} />
          <input placeholder="Cell phone" inputMode="tel" value={r.phone} onChange={(e) => set(i, "phone", e.target.value)} style={inp} />
        </div>
      ))}
      <div style={{ display: "flex", gap: 6 }}>
        <button style={ui.btn} onClick={() => setRows([...rows, { name: "", phone: "" }])}>Add a person</button>
        <button style={ui.primary} disabled={busy} onClick={() => onSave(rows.filter((r) => r.name.trim()))}>Save people</button>
      </div>
    </div>
  );
}

const inp = { height: 38, boxSizing: "border-box", padding: "0 10px", borderRadius: 10, border: `1px solid ${T.borderStrong}`, background: "rgba(0,0,0,0.25)", color: T.text, fontSize: 14, fontFamily: "inherit", minWidth: 0, width: "100%", colorScheme: "dark" };
