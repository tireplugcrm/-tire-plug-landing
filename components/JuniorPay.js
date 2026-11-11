// Junior's Pay Tracker view: month calendar of his Saturday/Sunday shifts, each day's ROs and
// commission, earned so far, and what's due on the 1st. Used by /junior (4-digit code, read only)
// and the admin "Junior pay" tab (canEdit: hours, ROs, mark paid). Data: /api/junior.
import React, { useEffect, useState } from "react";
import { T, Icon, ui } from "./admin/ui.js";

const $ = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const $0 = (n) => `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const monthName = (m) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const dayName = (d, opt = { weekday: "long", month: "short", day: "numeric" }) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { ...opt, timeZone: "UTC" });
const shiftMonth = (m, n) => { const d = new Date(`${m}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
const hrs = (h) => `${Number(h).toLocaleString("en-US", { maximumFractionDigits: 2 })}h`;

export default function JuniorPay({ call, canEdit = false, initialMonth }) {
  const [month, setMonth] = useState(initialMonth || "");
  const [s, setS] = useState(null);
  const [sel, setSel] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(body) {
    setBusy(true); setErr("");
    try {
      const d = await call(body);
      setS(d);
      if (!month) setMonth(d.month);
      return d;
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { run({ action: "state", month }).then((d) => {
    if (!d || sel) return;
    const last = [...d.days].reverse().find((x) => x.past) || d.days[0];
    setSel(last?.day || null);
  }); /* eslint-disable-next-line */ }, [month]);

  if (!s) return <div style={{ color: T.textMuted, padding: 24, textAlign: "center" }}>{err || "Loading…"}</div>;

  const day = s.days.find((d) => d.day === sel) || null;
  const first = new Date(`${s.month}-01T12:00:00Z`);
  const lead = first.getUTCDay();
  const nDays = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const byDay = Object.fromEntries(s.days.map((d) => [d.day, d]));
  const cells = [...Array(lead).fill(null), ...Array.from({ length: nDays }, (_, i) => `${s.month}-${String(i + 1).padStart(2, "0")}`)];
  const due = s.complete ? s.toDate.total : s.projected.total;
  const pctLabel = `${Math.round((s.pct ?? 0.05) * 1000) / 10}%`;
  const co = !!s.who?.commissionOnly; // commission-only tracker (hours live elsewhere)

  return (
    <div style={{ color: T.text, fontFamily: "inherit" }}>
      <div style={{ color: T.textMuted, fontSize: 13.5, marginBottom: 14 }}>{co ? `Commission tracker · ${pctLabel} of labor on ${s.who?.his || "his"} ROs · hours are in Homebase` : <>{s.who?.daysLabel || "Every Saturday and Sunday"} · {$(s.hourly).replace(/[.]00$/, "")}/hour + {pctLabel} of labor on {s.who?.his || "his"} ROs · paid on the 1st.</>}</div>
      {/* Month switcher */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
        <button aria-label="Previous month" style={{ ...ui.btn, width: 40, padding: 0 }} onClick={() => { setSel(null); setMonth(shiftMonth(s.month, -1)); }}><Icon name="chevron_left" /></button>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{monthName(s.month)}</div>
        <button aria-label="Next month" style={{ ...ui.btn, width: 40, padding: 0 }} onClick={() => { setSel(null); setMonth(shiftMonth(s.month, 1)); }}><Icon name="chevron_right" /></button>
      </div>

      {/* Totals */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={ui.card}>
          <div style={label}>Earned so far</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: T.green, lineHeight: 1.15 }}>{$(s.toDate.total)}</div>
          <div style={{ color: T.textMuted, fontSize: 12.5, marginTop: 4 }}>{co ? "" : `${s.toDate.shifts} shift${s.toDate.shifts === 1 ? "" : "s"} · `}{s.toDate.ros} RO{s.toDate.ros === 1 ? "" : "s"}</div>
        </div>
        <div style={ui.card}>
          <div style={label}>{s.payout ? "Paid" : "Due"} {dayName(s.dueOn, { month: "short", day: "numeric" })}</div>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.15, color: s.payout ? T.textMuted : T.text }}>{$(s.payout ? s.payout.amount : due)}</div>
          <div style={{ color: s.payout ? T.green : T.textMuted, fontSize: 12.5, marginTop: 4 }}>
            {s.payout ? `Paid ${dayName(s.payout.paid_at.slice(0, 10), { month: "short", day: "numeric" })}` : s.complete ? "Month is done" : co ? "Commission so far" : `If ${s.who?.he || "he"} works ${s.who?.fill || "every weekend left"}`}
          </div>
        </div>
      </div>

      <div style={{ ...ui.card, marginTop: 10, fontSize: 14, display: "grid", gap: 6 }}>
        {!co && <Row k={`Hours · ${hrs(s.toDate.hours)} × ${$0(s.hourly)}/hr`} v={$(s.toDate.base)} />}
        <Row k={`Commission · ${pctLabel} of ${$0(s.toDate.labor)} labor`} v={$(s.toDate.commission)} />
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 6 }}><Row k={<strong>Total so far</strong>} v={<strong>{$(s.toDate.total)}</strong>} /></div>
        {!co && s.unconfirmed > 0 && <div style={{ color: T.amber, fontSize: 12.5 }}>{s.unconfirmed} day{s.unconfirmed === 1 ? " uses" : "s use"} {s.who?.his || "his"} usual hours until the real hours are entered.</div>}
      </div>

      {/* Calendar */}
      <div style={{ ...ui.card, marginTop: 10, padding: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center", fontSize: 11.5, color: T.textFaint, marginBottom: 4 }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => <div key={w} style={{ color: w === "Sat" || w === "Sun" ? T.text : T.textFaint, fontWeight: 600 }}>{w}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {cells.map((c, i) => {
            if (!c) return <div key={`x${i}`} />;
            const d = byDay[c];
            const num = +c.slice(8);
            if (!d) return <div key={c} style={{ ...cell, opacity: 0.35 }}><span style={{ fontSize: 12 }}>{num}</span></div>;
            const off = !co && d.hours === 0;
            const on = sel === c;
            return (
              <button key={c} onClick={() => setSel(c)} style={{
                ...cell, cursor: "pointer", fontFamily: "inherit", color: T.text,
                background: on ? T.blueSoft : off ? "transparent" : d.past ? "rgba(52,211,153,0.16)" : T.hover,
                border: `1px solid ${on ? T.blue : c === s.today ? T.amber : off ? T.border : d.past ? "rgba(52,211,153,0.45)" : T.borderStrong}`,
              }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{num}</span>
                <span style={{ fontSize: 10.5, color: off ? T.textFaint : T.textMuted }}>{co ? (d.ros.length ? "" : d.past ? "—" : "") : off ? "Off" : hrs(d.hours)}</span>
                {d.past && !off && (!co || d.total > 0) && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.green }}>{$0(Math.round(d.total))}</span>}
                {d.ros.length > 0 && <span style={{ fontSize: 9.5, color: T.textMuted }}>{d.ros.length} RO</span>}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: T.textFaint, marginTop: 8 }}>
          <span><Dot c="rgba(52,211,153,0.6)" />Worked</span><span><Dot c={T.borderStrong} />Coming up</span><span><Dot c={T.amber} />Today</span>
        </div>
      </div>

      {day && <DayCard key={day.day} d={day} s={s} canEdit={canEdit} busy={busy} run={run} />}

      {canEdit && (
        <div style={{ ...ui.card, marginTop: 10 }}>
          {s.payout ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>{monthName(s.month)} paid: <strong>{$(s.payout.amount)}</strong></span>
              <button style={ui.btn} disabled={busy} onClick={() => run({ action: "unpaid", month: s.month })}>Undo paid</button>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: T.textMuted, fontSize: 13.5 }}>{s.complete ? `${monthName(s.month)} is done. Pay ${$(s.toDate.total)} and mark it paid.` : `Pay day is ${dayName(s.dueOn)}.`}</span>
              {s.complete && <button style={ui.primary} disabled={busy} onClick={() => run({ action: "paid", month: s.month, amount: s.toDate.total })}>Mark {$0(s.toDate.total)} paid</button>}
            </div>
          )}
        </div>
      )}

      {err && <p style={{ color: T.red, fontWeight: 600, textAlign: "center" }}>{err}</p>}
    </div>
  );
}

function DayCard({ d, s, canEdit, busy, run }) {
  const [hours, setHours] = useState(String(d.hours));
  const [ro, setRo] = useState({ ro_number: "", ro_name: "", labor: "" });
  const pctLabel = `${Math.round((s.pct ?? 0.05) * 1000) / 10}%`;
  return (
    <div style={{ ...ui.card, marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{dayName(d.day)}</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: d.past ? T.green : T.textMuted }}>{$(d.total)}</div>
      </div>
      <div style={{ color: T.textMuted, fontSize: 13, marginTop: 2 }}>
        {s.who?.commissionOnly ? (d.commission ? `Commission ${$(d.commission)}` : "No commission yet") : d.hours === 0 ? "Off" : `${hrs(d.hours)} × ${$0(s.hourly)} = ${$(d.base)}`}{!s.who?.commissionOnly && d.commission ? ` · commission ${$(d.commission)}` : ""}
        {!d.past ? " · coming up" : !s.who?.commissionOnly && !d.confirmed ? " · usual hours (not entered yet)" : ""}
      </div>
      {d.note && <div style={{ color: T.textMuted, fontSize: 12.5, marginTop: 4 }}>{d.note}</div>}

      {canEdit && !s.who?.commissionOnly && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, color: T.textMuted }}>Hours worked</label>
          <input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" style={{ ...inp, width: 70 }} />
          <button style={ui.btn} disabled={busy} onClick={() => run({ action: "shift", day: d.day, hours })}>Save</button>
          <button style={ui.btn} disabled={busy} onClick={() => run({ action: "shift", day: d.day, hours: 0, note: "Off" })}>Mark off</button>
        </div>
      )}

      <div style={{ ...label, marginTop: 14 }}>ROs · {d.ros.length}</div>
      {d.ros.length === 0 && <div style={{ color: T.textFaint, fontSize: 13, marginTop: 4 }}>{d.past ? "No ROs added for this day yet." : "Not here yet."}</div>}
      {d.ros.map((r) => (
        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 0", borderTop: `1px solid ${T.border}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>RO #{r.ro_number}{r.ro_name ? <span style={{ color: T.textMuted, fontWeight: 400 }}> · {r.ro_name}</span> : null}</div>
            <div style={{ color: T.textMuted, fontSize: 12.5 }}>{$(r.labor)} labor × {pctLabel}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <strong style={{ color: T.green }}>{$(r.commission)}</strong>
            {canEdit && <button aria-label={`Remove RO ${r.ro_number}`} style={{ ...ui.btn, width: 30, height: 30, padding: 0 }} disabled={busy} onClick={() => run({ action: "removeRo", id: r.id, month: s.month })}><Icon name="close" size={16} /></button>}
          </div>
        </div>
      ))}

      {canEdit && d.past && (
        <form onSubmit={(e) => { e.preventDefault(); run({ action: "addRo", day: d.day, ...ro }).then((x) => x && setRo({ ro_number: "", ro_name: "", labor: "" })); }}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
          <input placeholder="RO #" inputMode="numeric" value={ro.ro_number} onChange={(e) => setRo({ ...ro, ro_number: e.target.value })} style={inp} required />
          <input placeholder="Customer" value={ro.ro_name} onChange={(e) => setRo({ ...ro, ro_name: e.target.value })} style={inp} />
          <input placeholder="Labor $" inputMode="decimal" value={ro.labor} onChange={(e) => setRo({ ...ro, labor: e.target.value })} style={inp} required />
          <button style={ui.primary} disabled={busy}>Add</button>
        </form>
      )}
    </div>
  );
}

const Row = ({ k, v }) => <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ color: T.textMuted }}>{k}</span><span>{v}</span></div>;
const Dot = ({ c }) => <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: c, marginRight: 5, verticalAlign: "middle" }} />;
const label = { fontSize: 11.5, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" };
const cell = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 1, minHeight: 64, padding: "5px 2px", borderRadius: 10, border: "1px solid transparent", minWidth: 0 };
const inp = { height: 34, boxSizing: "border-box", padding: "0 10px", borderRadius: 10, border: `1px solid ${T.borderStrong}`, background: "rgba(0,0,0,0.25)", color: T.text, fontSize: 14, fontFamily: "inherit", minWidth: 0 };
