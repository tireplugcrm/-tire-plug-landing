// Admin home: the Front Desk agent. Shows what needs a person right now (unanswered leads,
// today's appointments, tires to order, customers to call), what the agent did on its own,
// and one-tap actions. Server side: /api/admin/front-desk and lib/front-desk.js.
import React, { useState, useEffect, useCallback } from "react";

const RED = "#E01B22", GREEN = "#1a8f4c", AMBER = "#b26b00";
const TZ = "America/Los_Angeles";
const card = { background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: "0.9rem 1.1rem" };
const btn = { display: "inline-flex", alignItems: "center", gap: 4, background: "#fff", color: "#1a1a1a", padding: "0.45rem 0.8rem", fontSize: "0.76rem", fontWeight: 700, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", whiteSpace: "nowrap" };
const primary = { ...btn, background: "#111", color: "#fff", borderColor: "#111" };
const h2 = { fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(0,0,0,0.5)", margin: "1.6rem 0 0.7rem" };
const pill = (color) => ({ display: "inline-block", fontSize: "0.68rem", fontWeight: 800, padding: "0.15rem 0.55rem", borderRadius: 50, background: `${color}14`, color, border: `1px solid ${color}33`, whiteSpace: "nowrap" });

const time = (s) => new Date(s).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const dayKey = (s) => new Date(s).toLocaleDateString("en-CA", { timeZone: TZ });
const dayLabel = (s) => new Date(s).toLocaleDateString("en-US", { timeZone: TZ, weekday: "long", month: "short", day: "numeric" });
function ago(s) {
  const m = Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / 60000));
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${Math.floor(m / 1440)}d`;
}
const needsTires = (l) => /new tires|used tires/i.test(l.service || "");
const ICON = { new_lead: "🆕", booked: "📅", confirmation: "✉️", reminder: "⏰", alert: "🚨", no_show: "❓", checked_in: "🔧", done: "✅", canceled: "❌", rescheduled: "🔁", handled: "📞", tires: "🛞" };
const STATUS = { confirmed: ["Confirmed", "#2563eb"], checked_in: ["In the shop", AMBER], done: ["Done", GREEN], no_show: ["No-show", "#999"], canceled: ["Canceled", "#999"] };

export default function FrontDesk({ auth, onOpenLead }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [, tick] = useState(0);

  const call = useCallback(async (body) => {
    const r = await fetch("/api/admin/front-desk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? j : { error: j.error || `Request failed (${r.status})` };
  }, [auth]);
  const load = useCallback(async () => { const j = await call({ action: "board" }); if (j.error) setErr(j.error); else { setErr(""); setD(j); } }, [call]);

  useEffect(() => { load(); const a = setInterval(load, 60000); const b = setInterval(() => tick((x) => x + 1), 30000); return () => { clearInterval(a); clearInterval(b); }; }, [load]);

  async function act(action, id, extra = {}) {
    setBusy(`${action}:${id}`);
    const j = await call({ action, id, ...extra });
    if (j.error) alert(j.error);
    await load(); setBusy("");
  }

  if (err) return <div style={{ ...card, borderColor: `${RED}55` }}><strong>Front Desk can't load:</strong> {err}</div>;
  if (!d) return <p style={{ color: "rgba(0,0,0,0.5)" }}>Loading the front desk…</p>;

  const today = d.appointments.filter((a) => dayKey(a.appointment_at) === d.today && a.appt_status !== "canceled");
  const upcoming = d.appointments.filter((a) => dayKey(a.appointment_at) > d.today && a.appt_status === "confirmed");
  const tiresToOrder = d.appointments.filter((a) => a.appt_status === "confirmed" && needsTires(a) && !a.tires_ordered_at);
  const callToConfirm = d.appointments.filter((a) => a.appt_status === "confirmed" && !a.contactable && dayKey(a.appointment_at) >= d.today);
  const overdue = d.unanswered.filter((l) => Date.now() - new Date(l.created_at).getTime() > 10 * 60000);
  const minsSinceRun = d.lastRun ? (Date.now() - new Date(d.lastRun).getTime()) / 60000 : Infinity;
  const watching = minsSinceRun < 15;
  const todo = d.unanswered.length + tiresToOrder.length + callToConfirm.length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: "1.5rem", alignItems: "start" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.7rem", fontWeight: 900, letterSpacing: "-0.02em" }}>Front Desk</h1>
            <div style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.86rem", marginTop: 2 }}>
              {todo === 0 ? "You're all caught up. The agent is watching the website for you." : `${todo} thing${todo === 1 ? "" : "s"} need${todo === 1 ? "s" : ""} you.`}
            </div>
          </div>
          <span style={pill(watching ? GREEN : AMBER)} title={d.lastRun ? `Last check ${new Date(d.lastRun).toLocaleTimeString()}` : "Never ran"}>
            {watching ? `● Agent watching · checked ${Math.max(0, Math.round(minsSinceRun))} min ago` : "● Agent only checks while this screen is open"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "0.6rem", marginTop: "1rem" }}>
          {[["Need a reply", d.unanswered.length, overdue.length ? RED : null], ["Today's appointments", today.length], ["Tires to order", tiresToOrder.length, tiresToOrder.length ? AMBER : null], ["Call to confirm", callToConfirm.length, callToConfirm.length ? AMBER : null]].map(([l, n, c]) => (
            <div key={l} style={{ ...card, borderColor: c ? `${c}55` : card.border, background: c ? `${c}0a` : "#fff" }}>
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: c || "#111", lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(0,0,0,0.55)", marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>

        <h2 style={h2}>Needs a reply</h2>
        {!d.unanswered.length && <div style={{ ...card, color: "rgba(0,0,0,0.5)" }}>✓ Every lead has been answered.</div>}
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {d.unanswered.map((l) => {
            const late = Date.now() - new Date(l.created_at).getTime() > 10 * 60000;
            return (
              <div key={l.id} style={{ ...card, display: "flex", gap: "0.9rem", alignItems: "center", borderLeft: `4px solid ${late ? RED : "#2563eb"}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <strong>{l.name || "Unknown"}</strong>
                    {l.lead_priority === "HOT" && <span style={pill(RED)}>HOT</span>}
                    {l.appointment_at && <span style={pill("#2563eb")}>📅 {dayLabel(l.appointment_at).split(",")[0]} {time(l.appointment_at)}</span>}
                    {l.channel && l.channel !== "web" && <span style={pill("#666")}>{l.channel === "instagram" ? "Instagram" : "Text"}</span>}
                  </div>
                  <div style={{ color: "rgba(0,0,0,0.6)", fontSize: "0.8rem", marginTop: 2 }}>{[l.service, l.vehicle, l.tire_size && !/help me|N\/A/i.test(l.tire_size) && !(l.service || "").includes(l.tire_size) ? l.tire_size : null, l.price ? `$${l.price}/tire` : null, l.service_timing].filter(Boolean).join(" · ")}</div>
                </div>
                <div style={{ textAlign: "right", minWidth: 70 }}>
                  <div style={{ fontWeight: 900, color: late ? RED : "#111" }}>{ago(l.created_at)}</div>
                  <div style={{ fontSize: "0.66rem", color: "rgba(0,0,0,0.45)" }}>waiting</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {l.phone && <a href={`tel:${l.phone}`} style={btn}>📞 Call</a>}
                  <button onClick={() => onOpenLead && onOpenLead(l.id)} style={btn}>💬 Open</button>
                  <button disabled={busy === `handled:${l.id}`} onClick={() => act("handled", l.id)} style={primary}>✓ Reached out</button>
                </div>
              </div>
            );
          })}
        </div>

        <h2 style={h2}>Today · {dayLabel(new Date())}</h2>
        {!today.length && <div style={{ ...card, color: "rgba(0,0,0,0.5)" }}>No online appointments today.</div>}
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {today.map((a) => <Appt key={a.id} a={a} busy={busy} act={act} call={call} onOpenLead={onOpenLead} big />)}
        </div>

        {upcoming.length > 0 && <>
          <h2 style={h2}>Coming up</h2>
          {Object.entries(upcoming.reduce((g, a) => { (g[dayKey(a.appointment_at)] = g[dayKey(a.appointment_at)] || []).push(a); return g; }, {})).map(([k, list]) => (
            <div key={k} style={{ marginBottom: "0.8rem" }}>
              <div style={{ fontWeight: 800, fontSize: "0.85rem", margin: "0 0 0.4rem" }}>{dayLabel(list[0].appointment_at)} <span style={{ color: "rgba(0,0,0,0.45)", fontWeight: 600 }}>· {list.length}</span></div>
              <div style={{ display: "grid", gap: "0.4rem" }}>{list.map((a) => <Appt key={a.id} a={a} busy={busy} act={act} call={call} onOpenLead={onOpenLead} />)}</div>
            </div>
          ))}
        </>}
      </div>

      <aside style={{ position: "sticky", top: 16, display: "grid", gap: "1rem" }}>
        <div style={card}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>🤖 What the agent does</div>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "rgba(0,0,0,0.65)", fontSize: "0.8rem", lineHeight: 1.6 }}>
            <li>Texts + emails you the second a lead or booking comes in</li>
            <li>Nags you at 10 min, 30 min and 2 h if nobody replied</li>
            <li>Confirms every booking (email + calendar invite, text if allowed)</li>
            <li>Reminds customers the day before and 2 hours before</li>
            <li>Tells you which tires to order, and flags no-shows</li>
          </ul>
          <div style={{ fontSize: "0.74rem", color: "rgba(0,0,0,0.5)", marginTop: 8, lineHeight: 1.5 }}>
            Texts: {d.alerts.phones.length ? d.alerts.phones.join(", ") : <strong style={{ color: AMBER }}>none yet (set ADMIN_ALERT_PHONE in Vercel)</strong>}{d.alerts.phones.length && !d.alerts.smsOn ? " (texting not set up)" : ""}<br />
            Emails: {d.alerts.emails.join(", ")}{d.alerts.emailOn ? "" : " (email not set up)"}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", marginTop: 10 }}>
            Cars per 30-min slot
            <select value={d.capacity} onChange={async (e) => { await call({ action: "settings", capacity: e.target.value }); load(); }} style={{ ...btn, padding: "0.25rem 0.4rem" }}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Activity</div>
          {!d.events.length && <div style={{ fontSize: "0.8rem", color: "rgba(0,0,0,0.5)" }}>Nothing yet. New website leads and bookings will show up here.</div>}
          <div style={{ display: "grid", gap: 8, maxHeight: 560, overflowY: "auto" }}>
            {d.events.map((e) => (
              <div key={e.id} style={{ display: "flex", gap: 8, fontSize: "0.78rem", lineHeight: 1.4 }}>
                <span>{ICON[e.type] || "•"}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ color: "#222", cursor: e.lead_id ? "pointer" : "default" }} onClick={() => e.lead_id && onOpenLead && onOpenLead(e.lead_id)}>{e.message}</span>
                  <div style={{ color: "rgba(0,0,0,0.4)", fontSize: "0.68rem" }}>{ago(e.created_at)} ago</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Appt({ a, busy, act, call, onOpenLead, big }) {
  const [more, setMore] = useState(false);
  const [days, setDays] = useState(null);
  const [pick, setPick] = useState("");
  const [st, color] = STATUS[a.appt_status] || ["", "#666"];
  const b = (action) => busy === `${action}:${a.id}`;
  const late = a.appt_status === "confirmed" && Date.now() - new Date(a.appointment_at).getTime() > 15 * 60000;

  return (
    <div style={{ ...card, padding: big ? "0.9rem 1.1rem" : "0.65rem 1rem", opacity: ["done", "no_show"].includes(a.appt_status) ? 0.6 : 1 }}>
      <div style={{ display: "flex", gap: "0.9rem", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ width: 74, fontWeight: 900, fontSize: big ? "1.05rem" : "0.9rem", color: late ? RED : "#111" }}>{time(a.appointment_at)}</div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ cursor: "pointer" }} onClick={() => onOpenLead && onOpenLead(a.id)}>{a.name || "Customer"}</strong>
            <span style={pill(color)}>{late ? "Late" : st}</span>
            {needsTires(a) && a.appt_status === "confirmed" && (a.tires_ordered_at ? <span style={pill(GREEN)}>🛞 Tires ordered</span> : <span style={pill(AMBER)}>🛞 Order tires</span>)}
            {!a.contactable && a.appt_status === "confirmed" && <span style={pill(AMBER)}>📞 Call to confirm</span>}
          </div>
          <div style={{ color: "rgba(0,0,0,0.6)", fontSize: "0.8rem", marginTop: 2 }}>{[a.service, a.vehicle, a.tire_size && !/help me|N\/A/i.test(a.tire_size) && !(a.service || "").includes(a.tire_size) ? a.tire_size : null, a.price ? `$${a.price}/tire${a.quantity ? ` · $${a.price * a.quantity} for ${a.quantity}` : ""}` : null].filter(Boolean).join(" · ")}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {a.phone && <a href={`tel:${a.phone}`} style={btn}>📞</a>}
          {a.appt_status === "confirmed" && needsTires(a) && !a.tires_ordered_at && <button disabled={b("tires")} onClick={() => act("tires", a.id)} style={btn}>🛞 Tires ordered</button>}
          {a.appt_status === "confirmed" && big && <button disabled={b("check_in")} onClick={() => act("check_in", a.id)} style={primary}>Check in</button>}
          {a.appt_status === "checked_in" && <button disabled={b("done")} onClick={() => act("done", a.id)} style={{ ...primary, background: GREEN, borderColor: GREEN }}>✓ Done</button>}
          {a.appt_status === "confirmed" && <button onClick={() => setMore((m) => !m)} style={btn}>⋯</button>}
        </div>
      </div>
      {more && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "1px solid #f0f0f0" }}>
          {big && <button disabled={b("no_show")} onClick={() => confirm(`Mark ${a.name || "this customer"} as a no-show and send a "pick a new time" message?`) && act("no_show", a.id)} style={btn}>❓ No-show</button>}
          <button disabled={b("resend")} onClick={() => act("resend", a.id)} style={btn}>✉️ Resend confirmation</button>
          {!days ? <button onClick={async () => { const j = await call({ action: "slots", id: a.id }); setDays(j.days || []); }} style={btn}>🔁 Reschedule</button> : (
            <>
              <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ ...btn, fontWeight: 600 }}>
                <option value="">Pick a new time…</option>
                {days.map((dd) => <optgroup key={dd.date} label={dd.label}>{dd.slots.map((s) => <option key={s.at} value={s.at}>{dd.label.split(",")[0]} {s.label}</option>)}</optgroup>)}
              </select>
              <button disabled={!pick || b("reschedule")} onClick={() => act("reschedule", a.id, { at: pick })} style={primary}>Move</button>
            </>
          )}
          <button disabled={b("cancel")} onClick={() => confirm(`Cancel ${a.name || "this"} appointment?`) && act("cancel", a.id)} style={{ ...btn, color: RED }}>Cancel appt</button>
        </div>
      )}
    </div>
  );
}
