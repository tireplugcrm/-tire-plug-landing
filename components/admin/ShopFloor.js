// Shop Floor: today's appointments, the cars checked in, and the cars completed. The front desk and
// techs move jobs here (phone, tablet or computer); the shop TVs (/shop-tv) show the same board live.
import React, { useState, useEffect, useRef } from "react";
import { T, Icon, ui } from "./ui.js";
import {
  COLUMNS, JOB_TYPES, HOLD_REASONS, BAYS, bayLabel, tireLine, tireName, apptStatus, apptTime,
  boardTimer, fmtMins, sortJobs, floorStats,
} from "../../lib/shop-floor.js";

const LEVEL_COLOR = { ok: T.textMuted, slow: T.amber, late: T.red };
const EMPTY = { customer_name: "", phone: "", vehicle: "", tire_size: "", tire_qty: "4", tire_brand: "", tire_model: "", tire_img: "", service: "", job_types: [], assigned_staff_id: "", bay: "", promised: "", rush: false, waiter: false, note: "" };

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
    try { setData(await call(body)); setErr(""); return true; } catch (e) { setErr(e.message); return false; } finally { setBusy(false); }
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

      {showNew && (
        <div style={{ ...ui.card, marginBottom: 16 }}>
          <JobForm staff={d.staff} initial={EMPTY} submitLabel="Check in" busy={busy} searchTires={searchTires} onCancel={() => setShowNew(false)}
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
              <ColHead icon={col.icon} color={col.c} label={col.l} count={items.length} />
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
function ColHead({ icon, color, label, count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 4px 10px" }}>
      <Icon name={icon} size={18} style={{ color }} />
      <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
      <span style={{ color: T.textMuted, fontSize: 13 }}>{count}</span>
    </div>
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
  const { mins, level } = boardTimer(o);
  const types = JOB_TYPES.filter((j) => (o.job_types || []).includes(j.k));
  const hold = HOLD_REASONS.find((h) => h.k === o.hold_reason);
  const small = { ...ui.btn, height: 36, padding: "0 10px", fontSize: 13 };

  if (editing) {
    return (
      <div style={{ ...ui.card, padding: 12, borderColor: T.blue }}>
        <JobForm compact staff={staff} busy={busy} submitLabel="Save" searchTires={searchTires} onCancel={() => setEditing(false)}
          initial={{ ...EMPTY, ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v ?? EMPTY[k] ?? ""])), tire_qty: o.tire_qty ? String(o.tire_qty) : "", promised: isoToTime(o.promised_at), job_types: o.job_types || [], rush: !!o.rush, waiter: !!o.waiter }}
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
      {types.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {types.map((j) => <span key={j.k} style={ui.pill("#374151")}><Icon name={j.icon} size={14} />{j.l}</span>)}
        </div>
      )}
      {o.service && <div style={{ fontSize: 13, marginTop: 6 }}>{o.service}</div>}
      {o.note && <div style={{ fontSize: 12.5, marginTop: 4, color: T.textMuted }}>{o.note}</div>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", marginTop: 8, fontSize: 12.5, color: T.textMuted }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: o.assigned_staff_id ? T.text : T.amber }}>
          <Icon name="person" size={15} />{techName[o.assigned_staff_id] || "No tech"}
        </span>
        {o.bay && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Icon name="garage" size={15} />{bayLabel(o.bay)}</span>}
        {o.promised_at && o.status !== "done" && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: level === "late" ? T.red : undefined }}><Icon name="alarm" size={15} />Promised {clock(o.promised_at)}</span>}
      </div>
      {o.status === "on_hold" && hold && <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: T.red }}>{hold.l}</div>}

      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        {o.status !== "done" ? (
          <button disabled={busy} onClick={() => act({ action: "setStatus", id: o.id, status: "done" })} style={{ ...ui.primary, height: 36, flex: 1, background: T.green, borderColor: T.green }}><Icon name="check" size={18} />Complete</button>
        ) : (
          <>
            <button disabled={busy} onClick={() => act({ action: "archive", id: o.id })} style={{ ...ui.primary, height: 36, flex: 1 }}><Icon name="directions_car" size={18} />Picked up</button>
            <button disabled={busy} onClick={() => act({ action: "setStatus", id: o.id, status: "waiting" })} style={small} title="Move back to checked in"><Icon name="undo" size={18} /></button>
          </>
        )}
        <button onClick={() => setEditing(true)} style={small} title="Edit job"><Icon name="edit" size={18} /></button>
      </div>
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

function JobForm({ initial, staff, submitLabel, onSubmit, onCancel, busy, compact, searchTires }) {
  const [f, setF] = useState(initial);
  const set = (k, v) => setF((x) => (typeof k === "object" ? { ...x, ...k } : { ...x, [k]: v }));
  // Used tires don't come off the website shelf: choosing them drops the shelf tire (the size stays).
  const toggleType = (k) => {
    const on = !f.job_types.includes(k);
    const job_types = on ? [...f.job_types, k] : f.job_types.filter((x) => x !== k);
    set(on && k === "used" ? { job_types, tire_brand: "", tire_model: "", tire_img: "" } : { job_types });
  };
  const ok = f.customer_name.trim() || f.vehicle.trim();
  const inp = { ...ui.input, marginBottom: 0 };
  const grid = { display: "grid", gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 };

  function submit() {
    if (!ok) return;
    onSubmit({
      customer_name: f.customer_name, phone: f.phone, vehicle: f.vehicle, service: f.service, note: f.note,
      tire_size: f.tire_size, tire_qty: f.tire_qty, tire_brand: f.tire_brand, tire_model: f.tire_model, tire_img: f.tire_img,
      job_types: f.job_types, assigned_staff_id: f.assigned_staff_id, bay: f.bay,
      rush: f.rush, waiter: f.waiter, promised_at: timeToIso(f.promised),
    });
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={grid}>
        <input style={inp} placeholder="Vehicle (2019 Camry, white)" value={f.vehicle} onChange={(e) => set("vehicle", e.target.value)} />
        <input style={inp} placeholder="Customer name" value={f.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
        <input style={inp} placeholder="Phone (not shown on TVs)" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
      </div>
      <TirePicker f={f} set={set} searchTires={searchTires} />
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
      <div style={grid}>
        <select style={inp} value={f.assigned_staff_id} onChange={(e) => set("assigned_staff_id", e.target.value)} aria-label="Tech">
          <option value="">No tech yet</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select style={inp} value={f.bay} onChange={(e) => set("bay", e.target.value)} aria-label="Bay">
          <option value="">No bay yet</option>{BAYS.map((b) => <option key={b} value={b}>{bayLabel(b)}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: T.textMuted }}>
          Promised by <input type="time" style={{ ...inp, width: 130 }} value={f.promised} onChange={(e) => set("promised", e.target.value)} />
        </label>
      </div>
      <input style={inp} placeholder="Notes for the techs (alignment specs, lug lock…)" value={f.service} onChange={(e) => set("service", e.target.value)} />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13.5 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={f.waiter} onChange={(e) => set("waiter", e.target.checked)} />Customer is waiting here</label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={f.rush} onChange={(e) => set("rush", e.target.checked)} />Rush</label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={!ok || busy} onClick={submit} style={{ ...ui.primary, opacity: ok ? 1 : 0.5 }}>{submitLabel}</button>
        <button onClick={onCancel} style={ui.btn}>Cancel</button>
      </div>
    </div>
  );
}
