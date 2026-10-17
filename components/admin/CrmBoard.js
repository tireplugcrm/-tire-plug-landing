// Admin → CRM: website leads as a board, one column per sales stage, worked left to right
// (Tekmetric Job Board style). Clicking a card opens the lead drawer (texting, quote builder,
// status, reminders). Stages are read from the lead itself, so nothing needs dragging:
// replying, quoting, booking and marking won/lost move the card on their own.
import React, { useMemo, useState } from "react";
import { T, Icon, ui } from "./ui.js";

const TZ = "America/Los_Angeles";
const COLUMNS = [
  { key: "new", label: "New", hint: "Reply first", color: T.red },
  { key: "contacted", label: "Contacted", hint: "Send a quote", color: "#7c3aed" },
  { key: "quoted", label: "Quoted", hint: "Follow up", color: T.amber },
  { key: "booked", label: "Booked", hint: "Appointment set", color: T.blue },
  { key: "won", label: "Won", hint: "Last 30 days", color: T.green },
  { key: "lost", label: "Lost", hint: "Last 30 days", color: T.textMuted },
];
const SOURCES = [
  { key: "web", label: "Website", match: (l) => !l.channel || l.channel === "web" },
  { key: "instagram", label: "Instagram", match: (l) => l.channel === "instagram" },
  { key: "sms", label: "Text", match: (l) => l.channel === "sms" },
  { key: "all", label: "All", match: () => true },
];

// Off the board: closed out by hand (crm_closed_at), or Contacted/Quoted with no activity for
// 30 days. A reply from the customer after that brings the card back.
const STALE_MS = 30 * 864e5;
const lastActivity = (l) => Math.max(...[l.created_at, l.first_response_at, l.quoted_at, l.last_reply_at, l.appt_booked_at].filter(Boolean).map((t) => new Date(t).getTime()));
export function onBoard(l, stage = crmStage(l)) {
  const replied = l.last_reply_at && (!l.crm_closed_at || new Date(l.last_reply_at) > new Date(l.crm_closed_at));
  if (l.crm_closed_at && !replied) return false;
  if ((stage === "contacted" || stage === "quoted") && Date.now() - lastActivity(l) > STALE_MS) return false;
  return true;
}

export function crmStage(l) {
  if (l.status === "dead") return "lost";
  if (l.status === "booked" || l.appt_status === "done") return "won";
  if (l.appt_status === "confirmed" || l.appt_status === "checked_in") return "booked";
  if (l.quoted_at || (l.quotes || []).some((q) => q && q.price)) return "quoted";
  if (l.status === "called" || l.first_response_at) return "contacted";
  return "new";
}

const ago = (s) => {
  const m = Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / 60000));
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
};
const when = (s) => new Date(s).toLocaleString("en-US", { timeZone: TZ, weekday: "short", hour: "numeric", minute: "2-digit" });
const phoneFmt = (p) => { const d = String(p || "").replace(/\D/g, "").slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p || ""; };

function quoteTotal(l) {
  const q = (l.quotes || []).filter((x) => x && Number(x.price));
  if (!q.length) return null;
  const tot = Math.min(...q.map((x) => Number(x.price) * (Number(x.qty) || 1)));
  return q.length > 1 ? `from $${Math.round(tot)}` : `$${Math.round(tot)}`;
}

// The one thing a rep should know about this card at a glance.
function badge(l, stage) {
  const mins = (Date.now() - new Date(l.created_at).getTime()) / 60000;
  if (stage === "new") return mins > 10 ? ["Waiting " + ago(l.created_at), T.red] : ["New", T.red];
  if (stage === "quoted") {
    if (l.last_reply_at && l.quoted_at && new Date(l.last_reply_at) > new Date(l.quoted_at)) return ["Replied", T.blue];
    const since = l.quoted_at ? (Date.now() - new Date(l.quoted_at).getTime()) / 60000 : 0;
    return since > 1440 ? ["Cold", T.textMuted] : since > 30 ? ["Follow up", T.amber] : ["Quote sent", T.amber];
  }
  if (stage === "booked") return [l.appt_status === "checked_in" ? "In the shop" : "Confirmed", T.blue];
  if (stage === "won") return ["Won", T.green];
  if (stage === "lost") return ["Lost", T.textMuted];
  return ["Contacted", "#7c3aed"];
}

export default function CrmBoard({ leads, unreadByLead = {}, onOpen }) {
  const [source, setSource] = useState("web");
  const [q, setQ] = useState("");

  const cols = useMemo(() => {
    const src = SOURCES.find((s) => s.key === source) || SOURCES[0];
    const t = q.trim().toLowerCase();
    const recent = Date.now() - 30 * 864e5;
    const by = Object.fromEntries(COLUMNS.map((c) => [c.key, []]));
    for (const l of leads) {
      if (!src.match(l)) continue;
      if (t && !`${l.name} ${l.phone} ${l.email} ${l.vehicle} ${l.service} ${l.tire_size}`.toLowerCase().includes(t)) continue;
      const s = crmStage(l);
      if (!onBoard(l, s)) continue;
      if ((s === "won" || s === "lost") && new Date(l.booked_at || l.created_at).getTime() < recent) continue;
      by[s].push(l);
    }
    by.new.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // oldest waiting first
    by.booked.sort((a, b) => new Date(a.appointment_at) - new Date(b.appointment_at));
    for (const k of ["contacted", "quoted", "won", "lost"]) by[k].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return by;
  }, [leads, source, q]);

  const open = COLUMNS.slice(0, 4).reduce((n, c) => n + cols[c.key].length, 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h1 style={ui.h1}>CRM</h1>
          <div style={{ ...ui.muted, marginTop: 2 }}>{open} open lead{open === 1 ? "" : "s"}. Work each column left to right; cards move on their own as you reply, quote and book.</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 380 }}>
          <Icon name="search" size={20} style={{ position: "absolute", left: 10, top: 9, color: T.textFaint }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, vehicle, tire size" style={{ ...ui.input, marginBottom: 0, paddingLeft: 38 }} />
        </div>
        <div style={{ display: "inline-flex", border: `1px solid ${T.borderStrong}`, borderRadius: 6, overflow: "hidden", background: T.surface }}>
          {SOURCES.map((s, i) => (
            <button key={s.key} onClick={() => setSource(s.key)} style={{ height: 36, padding: "0 14px", border: "none", borderLeft: i ? `1px solid ${T.borderStrong}` : "none", background: source === s.key ? T.blueSoft : T.surface, color: source === s.key ? T.blue : T.text, fontWeight: source === s.key ? 600 : 500, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>{s.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(272px, 1fr)", gap: 12, overflowX: "auto", paddingBottom: 8, alignItems: "start" }}>
        {COLUMNS.map((c) => (
          <section key={c.key} style={{ background: "#eceef1", borderRadius: 8, minHeight: 200, display: "flex", flexDirection: "column" }}>
            <header style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: c.color }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>{c.label}</span>
              <span style={{ color: T.textMuted, fontSize: 13 }}>({cols[c.key].length})</span>
              <span style={{ marginLeft: "auto", color: T.textFaint, fontSize: 12 }}>{c.hint}</span>
            </header>
            <div style={{ display: "grid", gap: 8, padding: 8, maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}>
              {!cols[c.key].length && <div style={{ color: T.textFaint, fontSize: 13, textAlign: "center", padding: "18px 6px" }}>No leads here</div>}
              {cols[c.key].map((l) => <Card key={l.id} l={l} stage={c.key} unread={unreadByLead[l.id] || 0} onOpen={onOpen} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Card({ l, stage, unread, onOpen }) {
  const [label, color] = badge(l, stage);
  const quote = quoteTotal(l);
  const hot = l.lead_priority === "HOT" && stage === "new";
  return (
    <div onClick={() => onOpen && onOpen(l.id)} className="adminRow" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "10px 12px", cursor: "pointer", display: "grid", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={ui.pill(color)}>{label}</span>
        {hot && <span style={ui.pill(T.red)}>HOT</span>}
        {unread > 0 && <span style={{ ...ui.pill(T.blue), gap: 3 }}><Icon name="chat" size={14} />{unread}</span>}
        <span style={{ marginLeft: "auto", color: T.textFaint, fontSize: 12 }}>{ago(l.created_at)} ago</span>
      </div>
      <div style={{ fontSize: 14 }}>
        <span style={{ fontWeight: 600 }}>{l.name || "No name"}</span>
        {l.phone && <a href={`tel:${l.phone}`} onClick={(e) => e.stopPropagation()} style={{ color: T.text, textDecoration: "none", marginLeft: 6 }}>· {phoneFmt(l.phone)}</a>}
      </div>
      <div style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.4 }}>
        {[l.vehicle, l.service].filter(Boolean).join(" · ") || "No details yet"}
      </div>
      {(l.tire_size || quote || l.appointment_at) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12.5, color: T.textMuted }}>
          {l.tire_size && !/help me|N\/A/i.test(l.tire_size) && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Icon name="tire_repair" size={15} />{l.tire_size}</span>}
          {l.appointment_at && l.appt_status !== "canceled" && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: T.blue }}><Icon name="event" size={15} />{when(l.appointment_at)}</span>}
          {quote && <span style={{ marginLeft: "auto", fontWeight: 600, color: T.text, fontSize: 14 }}>{stage === "won" && l.revenue_amount ? `$${Math.round(l.revenue_amount)}` : quote}</span>}
        </div>
      )}
    </div>
  );
}
