// Admin home: the Front Desk agent. Shows what needs a person right now (unanswered leads,
// today's appointments, tires to order, customers to call), what the agent did on its own,
// and one-tap actions. Server side: /api/admin/front-desk and lib/front-desk.js.
import React, { useState, useEffect, useCallback } from "react";
import { T, Icon, ui } from "./ui.js";

const RED = T.red, GREEN = T.green, AMBER = T.amber, BLUE = T.blue;
const TZ = "America/Los_Angeles";
const card = ui.card;
const btn = ui.btn;
const primary = ui.primary;
const h2 = ui.h2;
const pill = ui.pill;

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
const needsOrder = (l) => needsTires(l) && l.availability !== "in_stock"; // in-stock tires are on the shelf
const ICON = { new_lead: ["person_add", BLUE], booked: ["event_available", BLUE], confirmation: ["mail", T.textMuted], reminder: ["schedule", T.textMuted], alert: ["notifications_active", RED], no_show: ["help", AMBER], checked_in: ["car_repair", AMBER], done: ["check_circle", GREEN], canceled: ["event_busy", T.textMuted], rescheduled: ["update", BLUE], handled: ["call", GREEN], tires: ["tire_repair", GREEN] };
const STATUS = { confirmed: ["Confirmed", BLUE], checked_in: ["In the shop", AMBER], done: ["Done", GREEN], no_show: ["No-show", T.textMuted], canceled: ["Canceled", T.textMuted] };

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
  if (!d) return <p style={{ color: T.textMuted }}>Loading the front desk…</p>;

  const today = d.appointments.filter((a) => dayKey(a.appointment_at) === d.today && a.appt_status !== "canceled");
  const upcoming = d.appointments.filter((a) => dayKey(a.appointment_at) > d.today && a.appt_status === "confirmed");
  const tiresToOrder = d.appointments.filter((a) => a.appt_status === "confirmed" && needsOrder(a) && !a.tires_ordered_at);
  const callToConfirm = d.appointments.filter((a) => a.appt_status === "confirmed" && !a.contactable && dayKey(a.appointment_at) >= d.today);
  const overdue = d.unanswered.filter((l) => Date.now() - new Date(l.created_at).getTime() > 10 * 60000);
  const minsSinceRun = d.lastRun ? (Date.now() - new Date(d.lastRun).getTime()) / 60000 : Infinity;
  const watching = minsSinceRun < 15;
  const todo = d.unanswered.length + tiresToOrder.length + callToConfirm.length;

  return (
    <div className="fd-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: "1.5rem", alignItems: "start" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h1 style={ui.h1}>Front Desk</h1>
            <div style={{ color: T.textMuted, fontSize: 14, marginTop: 2 }}>
              {todo === 0 ? "You're all caught up. The agent is watching the website for you." : `${todo} thing${todo === 1 ? "" : "s"} need${todo === 1 ? "s" : ""} you.`}
            </div>
          </div>
          <span style={{ ...pill(watching ? GREEN : AMBER), height: 26, padding: "0 10px" }} title={d.lastRun ? `Last check ${new Date(d.lastRun).toLocaleTimeString()}` : "Never ran"}>
            {watching ? `Agent watching · checked ${Math.max(0, Math.round(minsSinceRun))} min ago` : "Agent only checks while this screen is open"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "0.6rem", marginTop: "1rem" }}>
          {[["Need a reply", d.unanswered.length, overdue.length ? RED : null], ["Today's appointments", today.length], ["Tires to order", tiresToOrder.length, tiresToOrder.length ? AMBER : null], ["Call to confirm", callToConfirm.length, callToConfirm.length ? AMBER : null]].map(([l, n, c]) => (
            <div key={l} style={{ ...card, borderColor: c ? `${c}55` : card.border, background: c ? `${c}0a` : "#fff" }}>
              <div style={{ fontSize: 26, fontWeight: 600, color: c || T.text, lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.textMuted, marginTop: 6 }}>{l}</div>
            </div>
          ))}
        </div>

        <h2 style={h2}>Needs a reply</h2>
        {!d.unanswered.length && <div style={{ ...card, color: T.textMuted, display: "flex", alignItems: "center", gap: 8 }}><Icon name="check_circle" style={{ color: GREEN }} />Every lead has been answered.</div>}
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {d.unanswered.map((l) => {
            const late = Date.now() - new Date(l.created_at).getTime() > 10 * 60000;
            return (
              <div key={l.id} style={{ ...card, display: "flex", flexWrap: "wrap", gap: "0.6rem 0.9rem", alignItems: "center", borderLeft: `4px solid ${late ? RED : BLUE}`, borderRadius: 0 }}>
                <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <strong>{l.name || "Unknown"}</strong>
                    {l.lead_priority === "HOT" && <span style={pill(RED)}>HOT</span>}
                    {l.appointment_at && <span style={pill(BLUE)}><Icon name="event" size={14} />{dayLabel(l.appointment_at).split(",")[0]} {time(l.appointment_at)}</span>}
                    {l.channel && l.channel !== "web" && <span style={pill("#666")}>{l.channel === "instagram" ? "Instagram" : "Text"}</span>}
                  </div>
                  <div style={{ color: T.textMuted, fontSize: 13, marginTop: 2 }}>{[l.service, l.vehicle, l.tire_size && !/help me|N\/A/i.test(l.tire_size) && !(l.service || "").includes(l.tire_size) ? l.tire_size : null, l.price ? `$${l.price}/tire` : null, l.service_timing].filter(Boolean).join(" · ")}</div>
                </div>
                <div style={{ textAlign: "right", minWidth: 70 }}>
                  <div style={{ fontWeight: 600, color: late ? RED : T.text }}>{ago(l.created_at)}</div>
                  <div style={{ fontSize: 12, color: T.textFaint }}>waiting</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {l.phone && <a href={`tel:${l.phone}`} style={btn}><Icon name="call" size={18} />Call</a>}
                  <button onClick={() => onOpenLead && onOpenLead(l.id)} style={btn}><Icon name="chat" size={18} />Open</button>
                  <button disabled={busy === `handled:${l.id}`} onClick={() => act("handled", l.id)} style={primary}><Icon name="check" size={18} />Reached out</button>
                </div>
              </div>
            );
          })}
        </div>

        <h2 style={h2}>Today · {dayLabel(new Date())}</h2>
        {!today.length && <div style={{ ...card, color: T.textMuted }}>No online appointments today.</div>}
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {today.map((a) => <Appt key={a.id} a={a} busy={busy} act={act} call={call} onOpenLead={onOpenLead} big />)}
        </div>

        {upcoming.length > 0 && <>
          <h2 style={h2}>Coming up</h2>
          {Object.entries(upcoming.reduce((g, a) => { (g[dayKey(a.appointment_at)] = g[dayKey(a.appointment_at)] || []).push(a); return g; }, {})).map(([k, list]) => (
            <div key={k} style={{ marginBottom: "0.8rem" }}>
              <div style={{ fontWeight: 600, fontSize: 14, margin: "0 0 0.4rem" }}>{dayLabel(list[0].appointment_at)} <span style={{ color: T.textFaint, fontWeight: 600 }}>· {list.length}</span></div>
              <div style={{ display: "grid", gap: "0.4rem" }}>{list.map((a) => <Appt key={a.id} a={a} busy={busy} act={act} call={call} onOpenLead={onOpenLead} />)}</div>
            </div>
          ))}
        </>}
      </div>

      <aside style={{ position: "sticky", top: 16, display: "grid", gap: "1rem" }}>
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><Icon name="smart_toy" style={{ color: BLUE }} />What the agent does</div>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: T.textMuted, fontSize: 13, lineHeight: 1.6 }}>
            <li>Texts + emails you the second a lead or booking comes in</li>
            <li>Nags you at 10 min, 30 min and 2 h if nobody replied</li>
            <li>Confirms every booking (email + calendar invite, text if allowed)</li>
            <li>Reminds customers the day before and 2 hours before</li>
            <li>Tells you which tires to order (not in-stock ones), emails the customer when they arrive, and warns you the evening before if they haven't</li>
            <li>Flags no-shows</li>
          </ul>
          <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 8, lineHeight: 1.5 }}>
            Texts: {d.alerts.phones.length ? d.alerts.phones.join(", ") : <strong style={{ color: AMBER }}>none yet (set ADMIN_ALERT_PHONE in Vercel)</strong>}{d.alerts.phones.length && !d.alerts.smsOn ? " (texting not set up)" : ""}<br />
            Emails: {d.alerts.emails.join(", ")}{d.alerts.emailOn ? "" : " (email not set up)"}
          </div>
          <SampleEmails call={call} defaultTo={d.alerts.emails[0] || ""} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 10 }}>
            Cars per 30-min slot
            <select value={d.capacity} onChange={async (e) => { await call({ action: "settings", capacity: e.target.value }); load(); }} style={{ ...btn, padding: "0.25rem 0.4rem" }}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Activity</div>
          {!d.events.length && <div style={{ fontSize: 13, color: T.textMuted }}>Nothing yet. New website leads and bookings will show up here.</div>}
          <div style={{ display: "grid", gap: 8, maxHeight: 560, overflowY: "auto" }}>
            {d.events.map((e) => (
              <div key={e.id} style={{ display: "flex", gap: 8, fontSize: 13, lineHeight: 1.4 }}>
                <Icon name={(ICON[e.type] || ["circle", T.textFaint])[0]} size={18} style={{ color: (ICON[e.type] || ["", T.textFaint])[1], marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ color: "#222", cursor: e.lead_id ? "pointer" : "default" }} onClick={() => e.lead_id && onOpenLead && onOpenLead(e.lead_id)}>{e.message}</span>
                  <div style={{ color: T.textFaint, fontSize: 12 }}>{ago(e.created_at)} ago</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

// Sends the 5 customer emails of the booking sequence to you, so you can read the wording.
function SampleEmails({ call, defaultTo }) {
  const [to, setTo] = useState(defaultTo);
  const [r, setR] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 12, paddingTop: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>Customer emails</div>
      <div style={{ color: T.textMuted, fontSize: 12.5, marginBottom: 8 }}>See all 6 booking emails (confirmation, tires arrived, reminders, no-show, thank-you) as samples.</div>
      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="you@example.com" style={{ ...ui.input, height: 34, fontSize: 13, marginBottom: 6 }} />
      <button disabled={busy || !to} onClick={async () => { setBusy(true); setR(await call({ action: "samples", to: to.trim() })); setBusy(false); }} style={{ ...btn, width: "100%" }}>
        <Icon name="forward_to_inbox" size={18} />{busy ? "Sending…" : "Email me samples"}
      </button>
      {r && <div style={{ fontSize: 12.5, marginTop: 6, color: r.error ? RED : GREEN }}>{r.error || `Sent ${r.sent} of 6 to ${r.to}. Check spam if you don't see them.`}</div>}
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
        <div style={{ width: 74, fontWeight: 600, fontSize: big ? 15 : 14, color: late ? RED : T.text }}>{time(a.appointment_at)}</div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ cursor: "pointer" }} onClick={() => onOpenLead && onOpenLead(a.id)}>{a.name || "Customer"}</strong>
            <span style={pill(color)}>{late ? "Late" : st}</span>
            {needsTires(a) && a.appt_status === "confirmed" && (
              !needsOrder(a) ? <span style={pill(GREEN)}><Icon name="inventory_2" size={14} />In stock</span>
              : a.tires_arrived_at ? <span style={pill(GREEN)}><Icon name="tire_repair" size={14} />Tires here</span>
              : a.tires_ordered_at ? <span style={pill(BLUE)}><Icon name="local_shipping" size={14} />Tires ordered</span>
              : <span style={pill(AMBER)}><Icon name="tire_repair" size={14} />Order tires{a.availability === "next_day" ? " (next-day)" : ""}</span>)}
            {!a.contactable && a.appt_status === "confirmed" && <span style={pill(AMBER)}><Icon name="call" size={14} />Call to confirm</span>}
          </div>
          <div style={{ color: T.textMuted, fontSize: 13, marginTop: 2 }}>{[a.service, a.vehicle, a.tire_size && !/help me|N\/A/i.test(a.tire_size) && !(a.service || "").includes(a.tire_size) ? a.tire_size : null, a.price ? `$${a.price}/tire${a.quantity ? ` · $${a.price * a.quantity} for ${a.quantity}` : ""}` : null].filter(Boolean).join(" · ")}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {a.phone && <a href={`tel:${a.phone}`} style={btn} aria-label="Call"><Icon name="call" size={18} /></a>}
          {a.appt_status === "confirmed" && needsOrder(a) && !a.tires_ordered_at && <button disabled={b("tires")} onClick={() => act("tires", a.id)} style={btn}><Icon name="local_shipping" size={18} />Tires ordered</button>}
          {a.appt_status === "confirmed" && needsOrder(a) && a.tires_ordered_at && !a.tires_arrived_at && <button disabled={b("arrived")} onClick={() => confirm(`Mark ${a.name || "these"} tires as arrived and let the customer know?`) && act("arrived", a.id)} style={btn}><Icon name="inventory" size={18} />Tires arrived</button>}
          {a.appt_status === "confirmed" && big && <button disabled={b("check_in")} onClick={() => act("check_in", a.id)} style={primary}><Icon name="login" size={18} />Check in</button>}
          {a.appt_status === "checked_in" && <button disabled={b("done")} onClick={() => act("done", a.id)} style={{ ...primary, background: GREEN, borderColor: GREEN }}><Icon name="check" size={18} />Done</button>}
          {a.appt_status === "confirmed" && <button onClick={() => setMore((m) => !m)} style={btn} aria-label="More actions"><Icon name="more_horiz" size={18} /></button>}
        </div>
      </div>
      {more && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "1px solid #f0f0f0" }}>
          {big && <button disabled={b("no_show")} onClick={() => confirm(`Mark ${a.name || "this customer"} as a no-show and send a "pick a new time" message?`) && act("no_show", a.id)} style={btn}><Icon name="person_off" size={18} />No-show</button>}
          <button disabled={b("resend")} onClick={() => act("resend", a.id)} style={btn}><Icon name="forward_to_inbox" size={18} />Resend confirmation</button>
          {!days ? <button onClick={async () => { const j = await call({ action: "slots", id: a.id }); setDays(j.days || []); }} style={btn}><Icon name="update" size={18} />Reschedule</button> : (
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
