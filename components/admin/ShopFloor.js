// Shop Floor: today's appointments, the cars checked in, and the cars completed. The front desk and
// techs move jobs here (phone, tablet or computer); the shop TVs (/shop-tv) show the same board live.
import React, { useState, useEffect, useRef } from "react";
import { T, Icon, ui } from "./ui.js";
import {
  COLUMNS, JOB_TYPES, HOLD_REASONS, REMOVE_REASONS, tireLine, tireName, apptStatus, apptTime,
  boardTimer, fmtMins, sortJobs, floorStats, EMPTY_RO, roSheet, roFields, roMoney,
  TECHS, SOURCES, ROTATIONS, jobTechs, jobWheels, jobRotation,
} from "../../lib/shop-floor.js";
import TireDiagram from "../TireDiagram.js";

const LEVEL_COLOR = { ok: T.textMuted, slow: T.amber, late: T.red };
const EMPTY = { customer_name: "", phone: "", vehicle: "", tire_size: "", tire_qty: "4", tire_brand: "", tire_model: "", tire_img: "", service: "", job_types: [], promised: "", rush: false, waiter: false, note: "", ro: EMPTY_RO };
// What the front desk usually types for each kind of job when adding a labor line.
const LABOR_DESC = { tires: "Mount & balance", used: "Mount & balance", repair: "Flat repair", alignment: "4-wheel alignment", rotate: "Rotate & balance", tpms: "TPMS service", wheels: "Wheel install", brakes: "Brake service", other: "" };
const str = (v) => (v == null ? "" : String(v));
// A saved job's RO back into form fields (numbers -> text).
const roForm = (ro) => {
  const r = { ...EMPTY_RO, ...(ro || {}) };
  const line = (l) => ({ ...l, price: str(l.price) });
  return { ...r, tire_price: str(r.tire_price), labor: (r.labor || []).map(line) };
};
// "Promised by" choices: every half hour of the shop day.
const SLOTS = Array.from({ length: 25 }, (_, i) => { const m = 7 * 60 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}`; });
const slotLabel = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

// Copy the job as plain text in Tekmetric's repair-order order.
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    const ok = document.execCommand("copy"); t.remove(); return ok;
  }
}
// Tekmetric's boxes take one value each: copy one field at a time.
function CopyIcon({ value, style }) {
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) return undefined; const t = setTimeout(() => setDone(false), 1500); return () => clearTimeout(t); }, [done]);
  return (
    <button type="button" disabled={!value} onClick={async () => setDone(await copyText(String(value)))} title={value ? `Copy "${value}"` : "Nothing to copy"} aria-label="Copy"
      style={{ position: "absolute", right: 4, top: 5, width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: 4, background: "transparent", color: done ? T.green : value ? T.blue : T.borderStrong, cursor: value ? "pointer" : "default", padding: 0, ...style }}>
      <Icon name={done ? "check" : "content_copy"} size={17} />
    </button>
  );
}
// A form input with its copy button inside the right edge.
function Copyable({ value, children, style }) {
  return <div style={{ position: "relative", minWidth: 0, ...style }}>{children}<CopyIcon value={value} /></div>;
}
const withCopy = { paddingRight: 34 };

// Every RO value in Tekmetric's order, one row each. Tap a row to copy it; copied rows stay ticked.
function TekmetricFields({ o, techName }) {
  const [copied, setCopied] = useState({});
  const sections = roFields(o, techName);
  const copy = async (key, v) => { if (await copyText(v)) setCopied((c) => ({ ...c, [key]: true })); };
  if (!sections.length) return <div style={{ ...ui.muted, marginTop: 8 }}>Nothing to copy yet.</div>;
  return (
    <div style={{ marginTop: 10, border: `1px solid ${T.border}`, borderRadius: 6, background: T.surface, overflow: "hidden" }}>
      <div style={{ padding: "6px 10px", fontSize: 12.5, color: T.textMuted, background: "#f8fafc", borderBottom: `1px solid ${T.border}` }}>Tap a value, then paste it into the same box in Tekmetric.</div>
      {sections.map((sec) => (
        <div key={sec.title}>
          <div style={{ padding: "6px 10px 2px", fontSize: 11.5, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.3 }}>{sec.title}</div>
          {sec.rows.map((r) => {
            const key = `${sec.title}|${r.l}|${r.v}`;
            const done = copied[key];
            return (
              <button key={key} type="button" onClick={() => copy(key, r.v)} className="tp-nav-item"
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "5px 10px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 13.5 }}>
                <span style={{ width: 96, flexShrink: 0, color: T.textMuted, fontSize: 12.5 }}>{r.l}</span>
                <span style={{ flex: 1, minWidth: 0, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.v}</span>
                <Icon name={done ? "check_circle" : "content_copy"} size={17} style={{ color: done ? T.green : T.blue, flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// "14:30" today -> ISO; ISO -> "14:30" (shop's local time on this device)
function timeToIso(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d.toISOString();
}
function isoToTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const clock = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const colStyle = { background: "#eef0f3", borderRadius: 8, padding: 8, minHeight: 120 };

// demo: run against the local sample shop (/api/shop-demo) instead of Supabase — see pages/shop-demo.js.
export default function ShopFloor({ auth, demo }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState("");
  const [, tick] = useState(0);

  async function post(url, body) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  }
  const call = (body) => post(demo ? "/api/shop-demo" : "/api/admin/work-orders", body);
  const searchTires = async (q) => (await post(demo ? "/api/shop-demo" : "/api/admin/shelf-tires", { action: "shelf", q })).tires;

  async function load() {
    try { setData(await call({ action: "list" })); setErr(""); } catch (e) { setErr(e.message); }
  }
  // Stay current with other phones and the front desk; timers tick every 30s.
  useEffect(() => {
    load();
    const a = setInterval(load, demo ? 3000 : 10000), b = setInterval(() => tick((n) => n + 1), 30000);
    return () => { clearInterval(a); clearInterval(b); };
    // eslint-disable-next-line
  }, []);

  async function act(body) {
    setBusy(true);
    try { const j = await call(body); setData(j); setErr(""); setWarn(j.warning || ""); return true; } catch (e) { setErr(e.message); return false; } finally { setBusy(false); }
  }
  // Same check-in as the Front Desk: the appointment becomes a job under "Checked in".
  async function checkIn(id) {
    setBusy(true);
    try { await post(demo ? "/api/shop-demo" : "/api/admin/front-desk", { action: "check_in", id }); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function openTv() {
    if (demo) return window.open("/shop-tv?demo=live", "_blank", "noopener");
    try { const { url } = await call({ action: "tvLink" }); window.open(url, "_blank", "noopener"); } catch (e) { setErr(e.message); }
  }

  if (!data && !err) return <p style={ui.muted}>Loading the shop floor…</p>;
  const d = data || { orders: [], staff: [], todayDone: [], appointments: [], showAppointments: true };
  const appts = d.appointments || [];
  const showAppts = d.showAppointments !== false;
  const techName = Object.fromEntries(d.staff.map((s) => [s.id, s.name]));
  const s = floorStats(d.orders, d.todayDone);

  return (
    <div style={{ containerType: "inline-size" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={ui.h1}>Shop Floor</h1>
          <div style={ui.muted}>Every car from check-in to pickup. The shop TVs show this board live.</div>
        </div>
        <button onClick={() => act({ action: "showAppointments", on: !showAppts })} style={ui.btn} role="switch" aria-checked={showAppts} title="Show or hide the Appointments column here and on the TVs">
          <Toggle on={showAppts} />Appointments
        </button>
        <button onClick={openTv} style={ui.btn}><Icon name="tv" size={18} />TV display</button>
        <button onClick={() => setShowNew((v) => !v)} style={ui.primary}><Icon name={showNew ? "close" : "add"} size={18} />{showNew ? "Close" : "New check-in"}</button>
      </div>

      <div className="sf-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
        {showAppts && <Stat label="Appointments left" value={appts.length} hint="Booked for today, not here yet" />}
        <Stat label="Checked in" value={s.active} />
        <Stat label="Completed today" value={s.doneToday} />
        <Stat label="Behind" value={s.late} color={s.late ? T.red : undefined} hint="Past promise time or in the shop too long" />
        <Stat label="Avg turnaround" value={s.avgTurn != null ? fmtMins(s.avgTurn) : "—"} hint="Check-in to completed, today" />
      </div>

      {err && <div style={{ ...ui.card, borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b", marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}><Icon name="error" size={18} />{err}</div>}
      {warn && <div style={{ ...ui.card, borderColor: "#fde68a", background: "#fffbeb", color: T.amber, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}><Icon name="warning" size={18} />{warn}</div>}

      {showNew && (
        <div style={{ ...ui.card, marginBottom: 16 }}>
          <JobForm initial={EMPTY} submitLabel="Check in" busy={busy} searchTires={searchTires} onCancel={() => setShowNew(false)}
            onSubmit={async (f) => { if (await act({ action: "create", order: f })) setShowNew(false); }} />
        </div>
      )}

      <div className="sf-cols" style={{ display: "grid", gridTemplateColumns: `repeat(${showAppts ? 3 : 2}, minmax(0, 1fr))`, gap: 12, alignItems: "start" }}>
        {showAppts && (
          <section style={colStyle}>
            <ColHead icon="event" color={T.textMuted} label="Appointments" count={appts.length} />
            <div style={{ display: "grid", gap: 8 }}>
              {appts.length === 0 && <Nothing>No more today</Nothing>}
              {appts.map((a) => <ApptCard key={a.id} a={a} busy={busy} onCheckIn={() => checkIn(a.id)} />)}
            </div>
          </section>
        )}
        {COLUMNS.map((col) => {
          const items = sortJobs(d.orders.filter((o) => col.statuses.includes(o.status)));
          return (
            <section key={col.k} style={colStyle}>
              <ColHead icon={col.icon} color={col.c} label={col.l} count={items.length}
                action={col.k === "done" && items.length > 0 && <ClearAll count={items.length} busy={busy} onClear={() => act({ action: "clearCompleted" })} />} />
              <div style={{ display: "grid", gap: 8 }}>
                {items.length === 0 && <Nothing>Nothing here</Nothing>}
                {items.map((o) => <JobCard key={o.id} o={o} col={col} staff={d.staff} techName={techName} busy={busy} act={act} searchTires={searchTires} />)}
              </div>
            </section>
          );
        })}
      </div>
      <style dangerouslySetInnerHTML={{ __html: SF_CSS }} />
    </div>
  );
}

// Columns follow the board's own width (admin page or half of the split-screen demo), not the window's.
const SF_CSS = `
  @container (max-width: 760px) { .sf-cols { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }
  @container (max-width: 520px) {
    .sf-cols { grid-template-columns: minmax(0, 1fr) !important; }
    .sf-stats { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 6px !important; }
    .sf-stats > div { padding: 6px 8px !important; }
    .sf-stats > div > div:first-child { font-size: 11px !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sf-stats > div > div:last-child { font-size: 17px !important; }
  }
`;

function Toggle({ on }) {
  return (
    <span aria-hidden="true" style={{ width: 30, height: 18, borderRadius: 9, background: on ? T.blue : T.borderStrong, position: "relative", transition: "background .15s" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 14 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
    </span>
  );
}
function ColHead({ icon, color, label, count, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 4px 10px", minHeight: 30 }}>
      <Icon name={icon} size={18} style={{ color }} />
      <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
      <span style={{ color: T.textMuted, fontSize: 13 }}>{count}</span>
      {action && <span style={{ marginLeft: "auto" }}>{action}</span>}
    </div>
  );
}

// Mark every completed car as picked up (asks once more first).
function ClearAll({ count, busy, onClear }) {
  const [sure, setSure] = useState(false);
  useEffect(() => { if (!sure) return undefined; const t = setTimeout(() => setSure(false), 5000); return () => clearTimeout(t); }, [sure]);
  const small = { ...ui.btn, height: 28, padding: "0 8px", fontSize: 12.5 };
  return sure ? (
    <span style={{ display: "inline-flex", gap: 4 }}>
      <button disabled={busy} onClick={() => { setSure(false); onClear(); }} style={{ ...small, background: T.blue, borderColor: T.blue, color: "#fff" }}>Clear {count}</button>
      <button onClick={() => setSure(false)} style={small}>Cancel</button>
    </span>
  ) : (
    <button onClick={() => setSure(true)} style={small} title="Mark every completed car as picked up"><Icon name="clear_all" size={16} />Clear all</button>
  );
}
const Nothing = ({ children }) => <div style={{ color: T.textFaint, fontSize: 13, padding: "4px 6px 10px" }}>{children}</div>;

function Stat({ label, value, color, hint }) {
  return (
    <div title={hint} style={{ ...ui.card, padding: "10px 14px" }}>
      <div style={{ color: T.textMuted, fontSize: 12.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: color || T.text, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// The tire a job takes off our shelf: photo, brand and model, quantity and size.
function TireBlock({ o, name }) {
  const line = tireLine(o);
  const label = name || tireName(o);
  if (!line && !label) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, padding: 6, background: "#f8fafc", border: `1px solid ${T.border}`, borderRadius: 6 }}>
      {o.tire_img ? <img src={o.tire_img} alt="" style={{ width: 44, height: 44, objectFit: "contain", flexShrink: 0 }} />
        : <span style={{ width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", color: T.textFaint, flexShrink: 0 }}><Icon name="tire_repair" size={26} /></span>}
      <div style={{ minWidth: 0 }}>
        {label && <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>}
        {line && <div style={{ fontSize: 13, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>{line}</div>}
      </div>
    </div>
  );
}

// Which wheels get the new tires (fewer than 4) and the rotation pattern, as on the shop TVs.
function WheelsBlock({ o }) {
  const wheels = jobWheels(o), rot = jobRotation(o);
  if (!wheels.length && !rot) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
      <TireDiagram wheels={wheels} rotation={rot?.k} size={64} />
      <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.5 }}>
        {wheels.length > 0 && <div><b style={{ color: T.blue }}>New:</b> {wheels.join(", ")}</div>}
        {rot && <div><b style={{ color: T.amber }}>Rotate:</b> {rot.l}</div>}
      </div>
    </div>
  );
}

function ApptCard({ a, busy, onCheckIn }) {
  const st = apptStatus(a.appointment_at);
  return (
    <div style={{ ...ui.card, padding: 12, borderLeft: `3px solid ${T.borderStrong}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{apptTime(a.appointment_at)}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: LEVEL_COLOR[st.level] }}>{st.text}</span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 15 }}>{a.vehicle || "Vehicle not set"}</div>
      <div style={{ color: T.textMuted, fontSize: 13 }}>{a.name || "—"}{a.phone ? ` · ${a.phone}` : ""}</div>
      <TireBlock o={a} name={a.tire_name} />
      {a.service && !a.tire_size && <div style={{ fontSize: 13, marginTop: 6 }}>{a.service}</div>}
      <button disabled={busy} onClick={onCheckIn} style={{ ...ui.primary, height: 36, width: "100%", marginTop: 10 }}><Icon name="login" size={18} />Check in</button>
    </div>
  );
}

function JobCard({ o, col, staff, techName, busy, act, searchTires }) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [fields, setFields] = useState(false);
  const { mins, level } = boardTimer(o);
  const types = JOB_TYPES.filter((j) => (o.job_types || []).includes(j.k));
  const hold = HOLD_REASONS.find((h) => h.k === o.hold_reason);
  const small = { ...ui.btn, height: 36, padding: "0 10px", fontSize: 13 };
  const techs = jobTechs(o, techName);
  const source = SOURCES.find((x) => x.k === o.ro?.source);

  if (editing) {
    return (
      <div style={{ ...ui.card, padding: 12, borderColor: T.blue }}>
        <JobForm compact busy={busy} submitLabel="Save" searchTires={searchTires} onCancel={() => setEditing(false)}
          initial={{ ...EMPTY, ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v ?? EMPTY[k] ?? ""])), tire_qty: o.tire_qty ? String(o.tire_qty) : "", promised: isoToTime(o.promised_at), job_types: o.job_types || [], rush: !!o.rush, waiter: !!o.waiter, ro: roForm({ ...o.ro, techs: jobTechs(o, techName) }) }}
          onSubmit={async (f) => { if (await act({ action: "update", id: o.id, patch: f })) setEditing(false); }} />
      </div>
    );
  }

  return (
    <div style={{ ...ui.card, padding: 12, borderLeft: `3px solid ${o.rush ? T.red : col.c}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
        {o.ticket_no != null && <span style={{ color: T.textMuted, fontSize: 12.5, fontWeight: 600 }}>#{o.ticket_no}</span>}
        {o.rush && <span style={ui.pill(T.red)}>Rush</span>}
        {o.waiter && <span style={ui.pill(T.blue)} title="Customer is waiting in the shop"><Icon name="chair" size={14} />Waiting</span>}
        <span style={{ flex: 1 }} />
        <span title={o.status === "done" ? "Since completed" : "Since check-in"} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12.5, fontWeight: 600, color: LEVEL_COLOR[level] }}>
          <Icon name="schedule" size={15} />{fmtMins(mins)}
        </span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 15 }}>{o.vehicle || "Vehicle not set"}</div>
      <div style={{ color: T.textMuted, fontSize: 13 }}>{o.customer_name || "—"}{o.phone ? ` · ${o.phone}` : ""}</div>
      <TireBlock o={o} />
      <WheelsBlock o={o} />
      {types.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {types.map((j) => <span key={j.k} style={ui.pill("#374151")}><Icon name={j.icon} size={14} />{j.l}</span>)}
        </div>
      )}
      {o.service && <div style={{ fontSize: 13, marginTop: 6 }}>{o.service}</div>}
      {o.note && <div style={{ fontSize: 12.5, marginTop: 4, color: T.textMuted }}>{o.note}</div>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", marginTop: 8, fontSize: 12.5, color: T.textMuted }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: techs.length ? T.text : T.amber }}>
          <Icon name="person" size={15} />{techs.join(" & ") || "No tech"}
        </span>
        {source && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }} title="How the customer reached us"><Icon name={source.icon} size={15} />{source.l}</span>}
        {o.promised_at && o.status !== "done" && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: level === "late" ? T.red : undefined }}><Icon name="alarm" size={15} />Promised {clock(o.promised_at)}</span>}
      </div>
      {(() => { const t = roSheet(o).totals.subtotal; return t ? <div style={{ marginTop: 6, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>Subtotal <b>{roMoney(t)}</b> <span style={{ color: T.textMuted }}>before tax</span></div> : null; })()}
      {o.status === "on_hold" && hold && <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: T.red }}>{hold.l}</div>}

      {removing ? (
        <div style={{ display: "grid", gap: 6, marginTop: 10, padding: 8, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#991b1b" }}>Take this car off the board? Pick why:</div>
          {REMOVE_REASONS.map((r) => (
            <button key={r.k} disabled={busy} onClick={() => act({ action: "remove", id: o.id, reason: r.k })} style={{ ...small, height: 32, justifyContent: "flex-start", background: T.surface }}>{r.l}</button>
          ))}
          <button onClick={() => setRemoving(false)} style={{ ...small, height: 32, color: T.textMuted, background: T.surface }}>Keep it</button>
        </div>
      ) : (
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        {o.status !== "done" ? (
          <button disabled={busy} onClick={() => act({ action: "setStatus", id: o.id, status: "done" })} style={{ ...ui.primary, height: 36, flex: 1, background: T.green, borderColor: T.green }}><Icon name="check" size={18} />Complete</button>
        ) : (
          <>
            <button disabled={busy} onClick={() => act({ action: "archive", id: o.id })} style={{ ...ui.primary, height: 36, flex: 1 }}><Icon name="directions_car" size={18} />Picked up</button>
            <button disabled={busy} onClick={() => act({ action: "setStatus", id: o.id, status: "waiting" })} style={small} title="Move back to checked in"><Icon name="undo" size={18} /></button>
          </>
        )}
        <button onClick={() => setFields((v) => !v)} aria-pressed={fields} style={{ ...small, ...(fields ? { background: T.blueSoft, color: T.blue, borderColor: T.blue } : {}) }} title="Copy into Tekmetric, one field at a time"><Icon name="content_copy" size={18} /></button>
        <button onClick={() => setEditing(true)} style={small} title="Edit job"><Icon name="edit" size={18} /></button>
        <button onClick={() => setRemoving(true)} style={{ ...small, color: T.red }} title="Remove from board"><Icon name="delete" size={18} /></button>
      </div>
      )}
      {fields && <TekmetricFields o={o} techName={techName} />}
    </div>
  );
}

// Search our shelf (the website's inventory) and pick the tire this job takes.
function TirePicker({ f, set, searchTires }) {
  const [q, setQ] = useState(f.tire_size || "");
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(!f.tire_brand);
  const timer = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults(null); return undefined; }
    timer.current = setTimeout(async () => { try { setResults(await searchTires(q)); } catch { setResults([]); } }, 250);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line
  }, [q, open]);
  // A shelf tire is a new tire: the job becomes "New tires", never "Used tires".
  const pick = (t) => {
    const job_types = f.job_types.filter((k) => k !== "used");
    set({ tire_brand: t.brand, tire_model: t.model, tire_img: t.imgGeneric ? "" : t.img, tire_size: t.size, job_types: job_types.includes("tires") ? job_types : ["tires", ...job_types] });
    setOpen(false);
  };
  const clear = () => { set({ tire_brand: "", tire_model: "", tire_img: "" }); setOpen(true); };
  const inp = { ...ui.input, marginBottom: 0 };
  const qty = (
    <select style={{ ...inp, width: 96 }} value={f.tire_qty} onChange={(e) => set({ tire_qty: e.target.value })} aria-label="How many tires">
      <option value="">Qty</option>{["1", "2", "3", "4", "5", "6"].map((n) => <option key={n} value={n}>{n} tire{n === "1" ? "" : "s"}</option>)}
    </select>
  );

  if (f.job_types.includes("used")) {
    return (
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {qty}
          <input style={{ ...inp, flex: 1 }} placeholder="Used tire size (275/65R18)" value={f.tire_size} onChange={(e) => set({ tire_size: e.target.value.toUpperCase() })} />
        </div>
        <div style={ui.muted}>Used tires aren't on the website shelf, so there's no photo. Turn off Used tires to pick new tires from the shelf.</div>
      </div>
    );
  }
  if (!open && f.tire_brand) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, border: `1px solid ${T.blue}`, background: T.blueSoft, borderRadius: 6 }}>
        {f.tire_img ? <img src={f.tire_img} alt="" style={{ width: 52, height: 52, objectFit: "contain" }} /> : <Icon name="tire_repair" size={30} style={{ color: T.textMuted }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{f.tire_brand} {f.tire_model}</div>
          <div style={{ fontSize: 13, color: T.textMuted }}>{f.tire_size} · from our shelf</div>
        </div>
        {qty}
        <button type="button" onClick={clear} style={{ ...ui.btn, height: 34 }}>Change</button>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {qty}
        <div style={{ position: "relative", flex: 1 }}>
          <Icon name="search" size={18} style={{ position: "absolute", left: 10, top: 10, color: T.textFaint }} />
          <input style={{ ...inp, paddingLeft: 34 }} placeholder="Tire off our shelf: size or brand (225/45R17, falken 18)" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {results && (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, maxHeight: 260, overflowY: "auto", background: T.surface }}>
          {results.length === 0 && <div style={{ ...ui.muted, padding: 10 }}>Nothing on the shelf matches. You can still type the size below.</div>}
          {results.map((t) => (
            <button key={`${t.brand}|${t.model}|${t.size}`} type="button" onClick={() => pick(t)} className="tp-nav-item"
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "6px 10px", border: "none", borderBottom: `1px solid ${T.border}`, background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
              <img src={t.img} alt="" style={{ width: 40, height: 40, objectFit: "contain", flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: 13.5, color: T.text }}>{t.brand} {t.model}</span>
                <span style={{ display: "block", fontSize: 12.5, color: T.textMuted }}>{t.size}{t.category ? ` · ${t.category}` : ""}</span>
              </span>
              <span style={ui.pill(t.level === "in" ? T.green : T.amber)}>{t.level === "in" ? "In stock" : "Low"}</span>
            </button>
          ))}
        </div>
      )}
      <input style={inp} placeholder="Or just the tire size (not on the shelf)" value={f.tire_size} onChange={(e) => set({ tire_size: e.target.value.toUpperCase() })} />
    </div>
  );
}

// A section of the check-in, named like Tekmetric's repair order.
function Section({ icon, title, children, action }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.3 }}>
        <Icon name={icon} size={16} />{title}{action && <span style={{ marginLeft: "auto", textTransform: "none", letterSpacing: 0 }}>{action}</span>}
      </div>
      {children}
    </div>
  );
}
function Price({ value, onChange, label, width = 130 }) {
  return (
    <div style={{ position: "relative", width, flexShrink: 0 }}>
      <span style={{ position: "absolute", left: 10, top: 10, color: T.textFaint, fontSize: 14 }}>$</span>
      <input style={{ ...ui.input, marginBottom: 0, paddingLeft: 22, ...withCopy, textAlign: "right", fontVariantNumeric: "tabular-nums" }} inputMode="decimal" placeholder="0.00" aria-label={label}
        value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))} />
      <CopyIcon value={value && !Number.isNaN(Number(value)) ? Number(value).toFixed(2) : ""} />
    </div>
  );
}
// Labor lines: which job, description and price.
function Lines({ lines, onChange, jobs, placeholder }) {
  const inp = { ...ui.input, marginBottom: 0 };
  const edit = (i, patch) => onChange(lines.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  return lines.map((l, i) => (
    <div key={i} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {jobs && jobs.length > 1 && (
        <select style={{ ...inp, width: 150, flexShrink: 0 }} value={l.job || jobs[0]} onChange={(e) => edit(i, { job: e.target.value, ...(l.desc === LABOR_DESC[l.job || jobs[0]] ? { desc: LABOR_DESC[e.target.value] } : {}) })} aria-label="Job">
          {jobs.map((k) => <option key={k} value={k}>{JOB_TYPES.find((j) => j.k === k)?.l}</option>)}
        </select>
      )}
      <Copyable value={l.desc} style={{ flex: 1, minWidth: 160 }}><input style={{ ...inp, ...withCopy }} placeholder={placeholder} value={l.desc} onChange={(e) => edit(i, { desc: e.target.value })} /></Copyable>
      <Price value={l.price} onChange={(v) => edit(i, { price: v })} label="Price" />
      <button type="button" onClick={() => onChange(lines.filter((_, n) => n !== i))} style={{ ...ui.btn, height: 38, padding: "0 8px", color: T.textMuted }} title="Remove line"><Icon name="close" size={18} /></button>
    </div>
  ));
}
// Pick-one buttons (customer source, rotation pattern). Tapping the picked one clears it.
function Choice({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => {
        const on = value === o.k;
        return (
          <button key={o.k} type="button" onClick={() => onChange(on ? "" : o.k)} aria-pressed={on}
            style={{ ...ui.btn, height: 32, fontSize: 13, ...(on ? { background: T.blueSoft, color: T.blue, borderColor: T.blue } : {}) }}>
            {o.icon && <Icon name={o.icon} size={16} />}{o.l}
          </button>
        );
      })}
    </div>
  );
}

// The check-in, in Tekmetric repair-order order: customer, vehicle, concern, jobs (parts + labor),
// totals, how the customer reached us. Shop-floor details (techs, promise time) come last.
function JobForm({ initial, submitLabel, onSubmit, onCancel, busy, compact, searchTires }) {
  const [f, setF] = useState(initial);
  const [fields, setFields] = useState(false);
  const set = (k, v) => setF((x) => (typeof k === "object" ? { ...x, ...k } : { ...x, [k]: v }));
  const setRo = (k, v) => setF((x) => ({ ...x, ro: { ...x.ro, [k]: v } }));
  // Used tires don't come off the website shelf: choosing them drops the shelf tire (the size stays).
  const toggleType = (k) => {
    const on = !f.job_types.includes(k);
    const job_types = on ? [...f.job_types, k] : f.job_types.filter((x) => x !== k);
    set(on && k === "used" ? { job_types, tire_brand: "", tire_model: "", tire_img: "" } : { job_types });
  };
  const qty = Number(f.tire_qty) || 0;
  // Fewer than 4 tires: tap the wheels they go on (never more wheels than tires).
  const toggleWheel = (k) => {
    const cur = f.ro.positions || [];
    setRo("positions", cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k].slice(-qty));
  };
  const setTech = (i, name) => {
    const t = [...(f.ro.techs || [])]; t[i] = name;
    setRo("techs", [...new Set(t.filter(Boolean))]);
  };
  const hasTech = (f.ro.techs || []).length > 0;
  const ok = (f.customer_name.trim() || f.vehicle.trim()) && hasTech;
  const inp = { ...ui.input, marginBottom: 0 };
  const grid = { display: "grid", gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 };
  const small = { ...ui.btn, height: 28, padding: "0 8px", fontSize: 12.5 };
  const { totals } = roSheet(f);
  const hasTire = f.tire_size || f.tire_brand;
  const pickWheels = hasTire && qty > 0 && qty < 4;
  const rotating = f.job_types.includes("rotate");
  // A new labor line goes to the first job that has none yet.
  const addLabor = () => { const k = f.job_types.find((j) => !f.ro.labor.some((l) => l.job === j)) || f.job_types[0] || "tires"; setRo("labor", [...f.ro.labor, { job: k, desc: LABOR_DESC[k] || "", price: "" }]); };
  const slots = f.promised && !SLOTS.includes(f.promised) ? [f.promised, ...SLOTS] : SLOTS;

  function submit() {
    if (!ok) return;
    onSubmit({
      customer_name: f.customer_name, phone: f.phone, vehicle: f.vehicle,
      tire_size: f.tire_size, tire_qty: f.tire_qty, tire_brand: f.tire_brand, tire_model: f.tire_model, tire_img: f.tire_img,
      job_types: f.job_types, rush: f.rush, waiter: f.waiter, promised_at: timeToIso(f.promised),
      ro: { ...f.ro, positions: pickWheels ? f.ro.positions : [], rotation: rotating ? f.ro.rotation : "" },
    });
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Section icon="person" title="Customer">
        <div style={grid}>
          <Copyable value={f.customer_name}><input style={{ ...inp, ...withCopy }} placeholder="Customer name" value={f.customer_name} onChange={(e) => set("customer_name", e.target.value)} /></Copyable>
          <Copyable value={f.phone.replace(/\D/g, "")}><input style={{ ...inp, ...withCopy }} placeholder="Phone (not shown on TVs)" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Copyable>
        </div>
      </Section>
      <Section icon="directions_car" title="Vehicle">
        <div style={grid}>
          <Copyable value={f.vehicle}><input style={{ ...inp, ...withCopy }} placeholder="Year make model (2019 Toyota Camry)" value={f.vehicle} onChange={(e) => set("vehicle", e.target.value)} /></Copyable>
          <Copyable value={f.ro.plate}><input style={{ ...inp, ...withCopy }} placeholder="License plate" value={f.ro.plate} onChange={(e) => setRo("plate", e.target.value.toUpperCase())} /></Copyable>
          <Copyable value={f.ro.vin}><input style={{ ...inp, ...withCopy }} placeholder="VIN" maxLength={17} value={f.ro.vin} onChange={(e) => setRo("vin", e.target.value.toUpperCase())} /></Copyable>
          <Copyable value={f.ro.mileage}><input style={{ ...inp, ...withCopy }} placeholder="Mileage in" inputMode="numeric" value={f.ro.mileage} onChange={(e) => setRo("mileage", e.target.value.replace(/\D/g, ""))} /></Copyable>
        </div>
      </Section>
      <Section icon="report" title="Concern">
        <Copyable value={f.ro.concern}><input style={{ ...inp, ...withCopy }} placeholder="What the customer says (front tires worn, pulls right…)" value={f.ro.concern} onChange={(e) => setRo("concern", e.target.value)} /></Copyable>
      </Section>
      <Section icon="build" title="Jobs" action={<button type="button" onClick={addLabor} style={small}><Icon name="add" size={16} />Labor</button>}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {JOB_TYPES.map((j) => {
            const on = f.job_types.includes(j.k);
            return (
              <button key={j.k} type="button" onClick={() => toggleType(j.k)} aria-pressed={on}
                style={{ ...ui.btn, height: 32, fontSize: 13, ...(on ? { background: T.blueSoft, color: T.blue, borderColor: T.blue } : {}) }}>
                <Icon name={j.icon} size={16} />{j.l}
              </button>
            );
          })}
        </div>
        <TirePicker f={f} set={set} searchTires={searchTires} />
        {hasTire && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: T.textMuted, flexWrap: "wrap" }}>
            Tire price each <Price value={f.ro.tire_price} onChange={(v) => setRo("tire_price", v)} label="Tire price each" />
            <span style={{ fontVariantNumeric: "tabular-nums" }}>× {qty || 1} = <b style={{ color: T.text }}>{roMoney(totals.parts)}</b></span>
          </div>
        )}
        {(pickWheels || rotating) && (
          <div style={{ display: "flex", gap: 14, alignItems: "center", padding: 10, border: `1px solid ${T.border}`, borderRadius: 6, background: "#f8fafc", flexWrap: "wrap" }}>
            <TireDiagram wheels={pickWheels ? f.ro.positions : []} rotation={rotating ? f.ro.rotation : ""} onToggle={pickWheels ? toggleWheel : undefined} size={130} labels />
            <div style={{ display: "grid", gap: 8, flex: 1, minWidth: 200 }}>
              {pickWheels && (
                <div style={{ fontSize: 13.5 }}>
                  <b>Tap the {qty === 1 ? "wheel" : `${qty} wheels`} getting new tires</b>
                  <div style={ui.muted}>{f.ro.positions.length}/{qty} picked. They light up on the shop TVs.{qty === 2 ? " New pairs usually go on the rear, even when the customer is replacing the fronts." : ""}</div>
                </div>
              )}
              {rotating && (
                <div style={{ display: "grid", gap: 6 }}>
                  <b style={{ fontSize: 13.5 }}>Rotation pattern</b>
                  <Choice options={ROTATIONS} value={f.ro.rotation} onChange={(v) => setRo("rotation", v)} />
                </div>
              )}
            </div>
          </div>
        )}
        <Lines lines={f.ro.labor} onChange={(v) => setRo("labor", v)} jobs={f.job_types.length ? f.job_types : null} placeholder="Labor (mount & balance)" />
      </Section>
      <Section icon="payments" title="Totals">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", fontSize: 13.5, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>
          <span>Parts {roMoney(totals.parts)}</span><span>Labor {roMoney(totals.labor)}</span>
          <span style={{ color: T.text, fontWeight: 600 }}>Subtotal {roMoney(totals.subtotal)}</span><span>Tax is added in Tekmetric</span>
        </div>
      </Section>
      <Section icon="contact_phone" title="Customer source">
        <Choice options={SOURCES} value={f.ro.source} onChange={(v) => setRo("source", v)} />
      </Section>

      <Section icon="garage" title="Shop floor">
        <div style={grid}>
          <select style={{ ...inp, borderColor: hasTech ? T.borderStrong : T.amber }} value={f.ro.techs[0] || ""} onChange={(e) => setTech(0, e.target.value)} aria-label="Tech">
            <option value="">Tech (required)</option>{TECHS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select style={inp} value={f.ro.techs[1] || ""} onChange={(e) => setTech(1, e.target.value)} aria-label="Second tech" disabled={!hasTech}>
            <option value="">2nd tech (optional)</option>{TECHS.filter((n) => n !== f.ro.techs[0]).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select style={inp} value={f.promised} onChange={(e) => set("promised", e.target.value)} aria-label="Promised by">
            <option value="">Promised by…</option>{slots.map((t) => <option key={t} value={t}>{slotLabel(t)}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13.5 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={f.waiter} onChange={(e) => set("waiter", e.target.checked)} />Customer is waiting here</label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={f.rush} onChange={(e) => set("rush", e.target.checked)} />Rush</label>
        </div>
      </Section>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button disabled={!ok || busy} onClick={submit} style={{ ...ui.primary, opacity: ok ? 1 : 0.5 }}>{submitLabel}</button>
        <button type="button" onClick={() => setFields((v) => !v)} aria-pressed={fields} style={{ ...ui.btn, ...(fields ? { background: T.blueSoft, color: T.blue, borderColor: T.blue } : {}) }}><Icon name="content_copy" size={18} />Tekmetric fields</button>
        <button onClick={onCancel} style={ui.btn}>Cancel</button>
        {!hasTech && <span style={{ fontSize: 13, color: T.amber }}>Pick a tech to check in</span>}
      </div>
      {fields && <TekmetricFields o={f} />}
    </div>
  );
}
