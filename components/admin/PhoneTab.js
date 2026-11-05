// Admin → Phone: what Alejandro (the phone AI) did on every call, live. Each call links to the CRM lead or booking it
// made, and lead cards list that caller's calls (LeadCalls / CallDetail, exported).
// Numbers from /api/admin/phone (phone_calls, lib/phone-calls.js report). Refreshes every 30 s while open.
// Click a call for its recording, transcript, quotes and the quality checklist.
import React, { useEffect, useState } from "react";
import { T, Icon, ui } from "./ui.js";

const LA = "America/Los_Angeles";
const ymd = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: LA }).format(d);
const daysAgo = (n) => ymd(new Date(Date.now() - n * 86400000));
const RANGES = [
  { key: "today", label: "Today", from: () => daysAgo(0) },
  { key: "7", label: "7 days", from: () => daysAgo(6) },
  { key: "30", label: "30 days", from: () => daysAgo(29) },
  { key: "90", label: "90 days", from: () => daysAgo(89) },
];
const INTENT = { new_tires: "New tires", used_tires: "Used tires", alignment_only: "Alignment only", flat_repair: "Flat repair", other_service: "Other service", existing_job: "Existing job", business: "Business / fleet", vendor: "Vendor / sales", other: "Other" };
const money = (n) => `$${Math.round(n || 0).toLocaleString("en-US")}`;
const when = (t) => new Date(t).toLocaleString("en-US", { timeZone: LA, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const mins = (s) => (s == null ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
const phone = (p) => (p ? `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}` : "Unknown");
const qColor = (q) => (q == null ? T.textFaint : q >= 85 ? T.green : q >= 65 ? T.amber : T.red);

export default function PhoneTab({ auth, onOpenLead }) {
  const [range, setRange] = useState("7");
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [openId, setOpenId] = useState(null);

  async function call(body) {
    const res = await fetch("/api/admin/phone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  }
  async function load() {
    try { setD(await call({ action: "report", from: RANGES.find((r) => r.key === range).from(), to: daysAgo(0) })); setErr(""); }
    catch (e) { setErr(e.message); }
  }
  useEffect(() => { setD(null); load(); const t = setInterval(load, 30000); return () => clearInterval(t); /* eslint-disable-next-line */ }, [range]);

  const r = d?.report;
  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={ui.h1}>Phone</h1>
        <span style={ui.pill(T.green)}><span style={{ width: 7, height: 7, borderRadius: 9, background: T.green }} />Live</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {RANGES.map((x) => <button key={x.key} onClick={() => setRange(x.key)} style={range === x.key ? ui.primary : ui.btn}>{x.label}</button>)}
        </div>
      </div>
      <p style={{ ...ui.muted, margin: "4px 0 16px" }}>Every call Alejandro answers: what they wanted, what he quoted, whether they booked, and how well he sold. Updates every 30 seconds.</p>

      {err && <div style={{ ...ui.card, color: T.red }}>{err}</div>}
      {!d && !err && <p style={ui.muted}>Loading…</p>}
      {r && (
        <>
          <Grid>
            <Stat label="Calls answered" value={r.calls} note={`${r.minutes} min · ${r.salesCalls} were sales calls`} />
            <Stat label="Booked" value={r.booked} color={T.green} note={r.bookRate == null ? "No sales calls yet" : `${r.bookRate}% of sales calls`} />
            <Stat label="Booked tire sales" value={money(r.bookedValue)} color={T.green} note="Tires only, before install and tax" />
            <Stat label="Leads for reps" value={r.leads} color={T.amber} note={`${r.lost} sales calls left with nothing saved`} />
            <Stat label="Sales quality" value={r.quality == null ? "—" : `${r.quality}/100`} color={qColor(r.quality)} note="Average score on the sales checklist" />
            <Stat label="Answer speed" value={r.avgWait == null ? "—" : `${r.avgWait}s`} note={`Avg wait per reply · ${r.transfers} transferred · ${r.texts} texts`} />
          </Grid>

          <Grid min={320}>
            <Card title="Alignment" icon="tune">
              <Line label="Offered on tire calls" value={r.alignment.offerRate == null ? "—" : `${r.alignment.offered} of ${r.alignment.of} (${r.alignment.offerRate}%)`} warn={r.alignment.offerRate != null && r.alignment.offerRate < 80} />
              <Line label="Customers who added it" value={r.alignment.accepted} />
              <Line label="Asked about alignment" value={r.alignment.questions} />
              <Line label="Called only for an alignment" value={r.alignment.onlyCalls} />
            </Card>
            <Card title="What callers wanted" icon="call">
              {r.intents.length ? r.intents.map((x) => <Line key={x.name} label={INTENT[x.name] || x.name} value={x.n} />) : <Empty />}
            </Card>
            <Card title="Quotes given" icon="request_quote">
              <Line label="Calls with a quote" value={r.quoted} />
              <div style={{ ...ui.muted, fontSize: 12.5, margin: "8px 0 4px" }}>Most asked sizes</div>
              {r.sizes.slice(0, 6).map((x) => <Line key={x.name} label={x.name} value={x.n} />)}
              {!r.sizes.length && <Empty />}
            </Card>
            <Card title="Sizes asked, not on the shelf" icon="inventory_2">
              <p style={{ ...ui.muted, fontSize: 12.5, margin: "0 0 6px" }}>Buy these: callers wanted them and we only had next-day.</p>
              {r.quotedNotInStock.slice(0, 8).map((x) => <Line key={x.name} label={x.name} value={`${x.n} calls`} warn />)}
              {!r.quotedNotInStock.length && <Empty text="Every quoted size was in stock" />}
            </Card>
            <Card title="Used tires" icon="recycling">
              <Line label="Callers asking for used" value={r.used.requests} />
              {r.used.sizes.slice(0, 6).map((x) => <Line key={x.name} label={x.name} value={x.n} />)}
            </Card>
            <Card title="Why they didn't book" icon="trending_down">
              {r.objections.map((x) => <Line key={x.name} label={`Objection: ${x.name}`} value={x.n} />)}
              {r.lostReasons.slice(0, 6).map((x) => <Line key={x.name} label={x.name} value={x.n} />)}
              {!r.objections.length && !r.lostReasons.length && <Empty />}
            </Card>
          </Grid>

          <div style={{ ...ui.card, marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><Icon name="fact_check" size={18} />Sales checklist (all calls)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "6px 20px" }}>
              {Object.entries(r.checks).map(([k, c]) => <Line key={k} label={c.label} value={c.rate == null ? "—" : `${c.rate}% (${c.pass}/${c.of})`} warn={c.rate != null && c.rate < 80} />)}
            </div>
          </div>

          <h2 style={ui.h2}>Calls</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {d.calls.map((c) => <CallRow key={c.id} c={c} open={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} call={call} onOpenLead={onOpenLead} />)}
            {!d.calls.length && <div style={ui.card}><Empty text="No calls in this range yet" /></div>}
          </div>
        </>
      )}
    </div>
  );
}

function CallRow({ c, open, onToggle, call, onOpenLead }) {
  const outcome = c.booked ? ["Booked", T.green] : c.lead_saved ? ["Lead saved", T.amber] : c.transferred ? ["Transferred", T.blue] : ["No sale", T.textFaint];
  return (
    <div style={{ ...ui.card, padding: 0 }}>
      <button onClick={onToggle} style={{ all: "unset", cursor: "pointer", display: "grid", gridTemplateColumns: "minmax(110px,auto) 1fr auto auto", gap: 12, alignItems: "center", padding: "0.75rem 1rem", width: "100%", boxSizing: "border-box" }}>
        <span style={{ ...ui.muted, fontSize: 12.5 }}>{when(c.started_at)}<br />{mins(c.duration_secs)}</span>
        <span style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 600 }}>{c.caller_name || phone(c.caller)}</span>
          <span style={{ ...ui.muted, marginLeft: 8 }}>{[INTENT[c.intent] || c.intent, c.vehicle, c.tire_size].filter(Boolean).join(" · ")}</span>
          <span style={{ ...ui.muted, display: "block", fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {c.booked ? `${c.booking?.when || ""}${c.booking?.tire ? ` · ${c.booking.quantity || 4}× ${c.booking.tire} @ $${c.booking.price}` : ""}` : c.lost_reason || c.summary || ""}
          </span>
        </span>
        <span style={ui.pill(outcome[1])}>{outcome[0]}</span>
        <span title="Sales quality" style={{ fontWeight: 600, color: qColor(c.quality_score), minWidth: 34, textAlign: "right" }}>{c.quality_score ?? "—"}</span>
      </button>
      {open && <CallDetail id={c.id} call={call} onOpenLead={onOpenLead} />}
    </div>
  );
}

const STATUS = { new: "New", called: "Called", booked: "Booked", dead: "Dead" };
// One call: its recording, the CRM lead or booking it made, quotes, checklist and transcript. Phone tab and lead cards.
export function CallDetail({ id, call, onOpenLead, showLead = true }) {
  const [full, setFull] = useState(null);
  useEffect(() => { call({ action: "call", id }).then(setFull).catch((e) => setFull({ error: e.message })); /* eslint-disable-next-line */ }, [id]);
  const l = full?.lead;
  return (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "0.9rem 1rem", display: "grid", gap: 12 }}>
          {!full && <p style={ui.muted}>Loading…</p>}
          {showLead && full?.call && (l ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: T.page, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px" }}>
              <Icon name={l.appointment_at ? "event_available" : "person"} size={18} style={{ color: l.appointment_at ? T.green : T.amber }} />
              <span style={{ fontSize: 13.5 }}><b>{l.appointment_at ? "Booking" : "Lead"}: {l.name || "No name"}</b>{l.appointment_at ? ` · ${when(l.appointment_at)}${l.appt_status === "canceled" ? " (canceled)" : ""}` : ""} <span style={ui.muted}>· {l.service || ""} · {STATUS[l.status] || l.status || "New"}</span></span>
              {onOpenLead && <button onClick={() => onOpenLead(l.id)} style={{ ...ui.btn, marginLeft: "auto" }}><Icon name="open_in_new" size={16} />Open in CRM</button>}
            </div>
          ) : <p style={{ ...ui.muted, fontSize: 13 }}>No CRM lead or booking from this call.</p>)}
          {full?.error && <p style={{ color: T.red }}>{full.error}</p>}
          {full?.call && (
            <>
              {full.audioUrl ? <audio controls preload="none" src={full.audioUrl} style={{ width: "100%" }} /> : <p style={ui.muted}>No recording saved for this call.</p>}
              <div style={ui.muted}>{full.call.summary}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={ui.pill(T.textMuted)}>{phone(full.call.caller)}</span>
                {full.call.alignment_offered && <span style={ui.pill(T.blue)}>Alignment offered</span>}
                {full.call.alignment_accepted && <span style={ui.pill(T.green)}>Alignment added</span>}
                {full.call.used_tire_request && <span style={ui.pill(T.amber)}>Wanted used{full.call.used_tire_size ? ` ${full.call.used_tire_size}` : ""}</span>}
                {full.call.objection && full.call.objection !== "none" && <span style={ui.pill(T.red)}>Objection: {full.call.objection}</span>}
                {full.call.text_sent && <span style={ui.pill(T.textMuted)}>Text sent</span>}
                {full.call.transferred && <span style={ui.pill(T.blue)}>Transferred{full.call.transfer_reason ? `: ${full.call.transfer_reason}` : ""}</span>}
              </div>
              {(full.call.quotes || []).map((q, i) => (
                <div key={i} style={{ fontSize: 13 }}>
                  <b>Quoted {q.size}:</b> {[...q.in_stock.map((t) => `${t.brand} ${t.model} $${t.price ?? "?"}`), ...q.next_day.map((t) => `${t.brand} ${t.model} $${t.price} (next day)`)].join(" · ") || "nothing available"}
                </div>
              ))}
              {full.call.quality && (
                <div style={{ display: "grid", gap: 4 }}>
                  {Object.entries(full.call.quality).map(([k, q]) => (
                    <div key={k} style={{ display: "flex", gap: 8, fontSize: 13 }}>
                      <Icon name={q.result === "success" ? "check_circle" : q.result === "failure" ? "cancel" : "remove"} size={17} style={{ color: q.result === "success" ? T.green : q.result === "failure" ? T.red : T.textFaint }} />
                      <span><b>{k.replace(/_/g, " ")}</b> <span style={ui.muted}>{q.rationale}</span></span>
                    </div>
                  ))}
                </div>
              )}
              <details>
                <summary style={{ cursor: "pointer", ...ui.muted }}>Transcript</summary>
                <div style={{ display: "grid", gap: 4, marginTop: 8, fontSize: 13 }}>
                  {(full.call.transcript || []).filter((x) => x.text || x.tools?.length).map((x, i) => (
                    <div key={i}><span style={{ color: x.role === "agent" ? T.blue : T.text, fontWeight: 600 }}>{x.role === "agent" ? "Alejandro" : "Caller"}</span> <span style={ui.muted}>{mins(x.at)}</span> {x.text}{x.tools?.length ? <span style={{ color: T.textFaint }}> [{x.tools.join(", ")}]</span> : null}</div>
                  ))}
                </div>
              </details>
            </>
          )}
        </div>
  );
}

// Lead card section: every call from this lead's number; click one for its recording and transcript.
export function LeadCalls({ lead, auth }) {
  const [calls, setCalls] = useState(null);
  const [openId, setOpenId] = useState(null);
  async function call(body) {
    const res = await fetch("/api/admin/phone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  }
  useEffect(() => { setCalls(null); setOpenId(null); if (lead.phone) call({ action: "lead-calls", phone: lead.phone }).then((j) => setCalls(j.calls)).catch(() => setCalls([])); /* eslint-disable-next-line */ }, [lead.id]);
  if (!calls?.length) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ color: T.textMuted, fontSize: 13, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><Icon name="call" size={16} />Calls with Alejandro ({calls.length})</div>
      <div style={{ display: "grid", gap: 6 }}>
        {calls.map((c) => (
          <div key={c.id} style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
            <button onClick={() => setOpenId(openId === c.id ? null : c.id)} style={{ all: "unset", cursor: "pointer", display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", width: "100%", boxSizing: "border-box", fontSize: 13.5 }}>
              <Icon name={openId === c.id ? "expand_less" : "play_circle"} size={18} style={{ color: T.blue }} />
              <span>{when(c.started_at)} · {mins(c.duration_secs)}</span>
              <span style={{ ...ui.muted, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.booked ? `Booked ${c.booking?.when || ""}` : c.transferred ? "Transferred" : c.summary || ""}</span>
            </button>
            {openId === c.id && <CallDetail id={c.id} call={call} showLead={false} />}
          </div>
        ))}
      </div>
    </div>
  );
}

const Grid = ({ children, min = 170 }) => <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12, marginBottom: 12 }}>{children}</div>;
const Stat = ({ label, value, color = T.text, note }) => (
  <div style={ui.card}>
    <div style={{ ...ui.muted, fontSize: 12.5 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 600, color }}>{value}</div>
    <div style={{ ...ui.muted, fontSize: 12.5 }}>{note}</div>
  </div>
);
const Card = ({ title, icon, children }) => (
  <div style={ui.card}>
    <div style={{ fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><Icon name={icon} size={18} />{title}</div>
    {children}
  </div>
);
const Line = ({ label, value, warn }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5, padding: "3px 0" }}>
    <span style={{ color: T.textMuted }}>{label}</span><span style={{ fontWeight: 600, color: warn ? T.amber : T.text }}>{value}</span>
  </div>
);
const Empty = ({ text = "Nothing yet" }) => <div style={{ ...ui.muted, fontSize: 12.5 }}>{text}</div>;
