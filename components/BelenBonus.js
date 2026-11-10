// Belen's field-rep tracker view: this month's profit from her business accounts, the bonus it earns,
// and her account list. Used by /belen (4-digit code: read, plus "Add a business") and the admin
// "Belen" tab (canEdit: log profit, edit accounts, mark paid). Data: /api/belen.
import React, { useEffect, useState } from "react";
import { T, Icon, ui } from "./admin/ui.js";

const $ = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const $0 = (n) => `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const pct = (r) => `${Math.round(Number(r || 0) * 1000) / 10}%`;
const monthName = (m) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const shortDay = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const shiftMonth = (m, n) => { const d = new Date(`${m}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
const KIND_ICON = { wheels: "tire_repair", fleet: "local_shipping", tires: "storefront", commercial: "rv_hookup" };

export default function BelenBonus({ call, canEdit = false }) {
  const [month, setMonth] = useState("");
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null); // account id
  const [adding, setAdding] = useState(false);

  async function run(body) {
    setBusy(true); setErr("");
    try { const d = await call(body); setS(d); if (!month) setMonth(d.month); return d; }
    catch (e) { setErr(e.message); return null; } finally { setBusy(false); }
  }
  useEffect(() => { run({ action: "state", month }); /* eslint-disable-next-line */ }, [month]);

  if (!s) return <div style={{ color: T.textMuted, padding: 24, textAlign: "center" }}>{err || "Loading…"}</div>;
  const t = s.totals, p = s.plan, kinds = s.kinds || {};
  const lineProgress = t.line ? Math.min(1, t.total / t.line) : 1;
  const dueLabel = new Date(`${s.dueMonth}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });

  return (
    <div style={{ color: T.text, fontFamily: "inherit" }}>
      <div style={{ color: T.textMuted, fontSize: 13.5, marginBottom: 14 }}>
        {$0(p.hourly)}/hour as always, plus a monthly bonus on the profit from your business accounts · paid the first payday of the next month.
      </div>

      {/* Month switcher */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
        <button aria-label="Previous month" style={{ ...ui.btn, width: 40, padding: 0 }} onClick={() => setMonth(shiftMonth(s.month, -1))}><Icon name="chevron_left" /></button>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{monthName(s.month)}</div>
        <button aria-label="Next month" style={{ ...ui.btn, width: 40, padding: 0 }} onClick={() => setMonth(shiftMonth(s.month, 1))}><Icon name="chevron_right" /></button>
      </div>

      {/* Totals */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={ui.card}>
          <div style={label}>Profit from your accounts</div>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.15 }}>{$(t.total)}</div>
          <div style={{ color: T.textMuted, fontSize: 12.5, marginTop: 4 }}>{s.entries.length} paid job{s.entries.length === 1 ? "" : "s"} · {s.accounts.filter((a) => a.profit > 0).length} account{s.accounts.filter((a) => a.profit > 0).length === 1 ? "" : "s"}</div>
        </div>
        <div style={ui.card}>
          <div style={label}>{s.payout ? "Bonus paid" : "Your bonus"}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: T.green, lineHeight: 1.15 }}>{$(s.payout ? s.payout.amount : t.bonus)}</div>
          <div style={{ color: s.payout ? T.green : T.textMuted, fontSize: 12.5, marginTop: 4 }}>{s.payout ? `Paid ${shortDay(s.payout.paid_at.slice(0, 10))}` : `Paid in ${dueLabel}`}</div>
        </div>
      </div>

      {/* The line / how it's figured */}
      <div style={{ ...ui.card, marginTop: 10, fontSize: 14, display: "grid", gap: 6 }}>
        {s.intro ? (
          <div style={{ color: T.amber, fontSize: 13 }}>First 90 days (until {shortDay(s.introEnd)}): {pct(p.introRate)} of new-account profit from the first dollar.</div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.textMuted }}>
              <span>The line: {$0(t.line)} of profit covers your wage</span>
              <span>{s.toLine > 0 ? `${$0(s.toLine)} to go` : "Passed"}</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: T.hover, overflow: "hidden" }}>
              <div style={{ width: `${lineProgress * 100}%`, height: "100%", background: lineProgress >= 1 ? T.green : T.amber }} />
            </div>
          </>
        )}
        <Row k={`New accounts · ${pct(s.intro ? p.introRate : p.rate)} of ${$0(t.newProfit)}${!s.intro && t.total ? " (above the line)" : ""}`} v={$(t.fromNew)} />
        <Row k={`Accounts we already had · ${pct(p.existingRate)} of ${$0(t.existingProfit)}${!s.intro && t.total ? " (above the line)" : ""}`} v={$(t.fromExisting)} />
        <Row k={`New account bonus · ${t.qualified} × ${$0(p.newAccountBonus)}`} v={$(t.newAccounts)} />
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 6 }}><Row k={<strong>Bonus this month</strong>} v={<strong>{$(t.bonus)}</strong>} /></div>
        <div style={{ color: T.textFaint, fontSize: 12 }}>Profit counts once the customer has paid. A new account earns {$0(p.newAccountBonus)} once it spends $500 with us or sells us 20 wheels.</div>
      </div>

      {/* Accounts */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 0 8px" }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Your accounts · {s.accounts.length}</div>
        <button style={ui.primary} onClick={() => setAdding(!adding)}><Icon name={adding ? "close" : "add"} size={18} />{adding ? "Close" : "Add a business"}</button>
      </div>
      {adding && <AddAccount kinds={kinds} canEdit={canEdit} busy={busy} onAdd={async (a) => { if (await run({ action: "addAccount", month: s.month, ...a })) setAdding(false); }} />}
      {s.accounts.length === 0 && !adding && <div style={{ ...ui.card, color: T.textMuted, fontSize: 13.5 }}>No accounts yet. Every business you sign up goes here the same day, with your name on it.</div>}
      {s.accounts.map((a) => (
        <div key={a.id} style={{ ...ui.card, marginBottom: 8, padding: 0 }}>
          <button onClick={() => setOpen(open === a.id ? null : a.id)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "0.8rem 1rem", background: "none", border: 0, color: T.text, fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}>
            <Icon name={KIND_ICON[a.kind] || "storefront"} size={22} style={{ color: T.textMuted }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>{a.name}</div>
              <div style={{ color: T.textMuted, fontSize: 12 }}>
                {kinds[a.kind] || a.kind}{a.existing ? " · already ours (5%)" : ""}{a.qualified_on ? ` · ${$0(p.newAccountBonus)} bonus ✓` : ""}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700 }}>{$0(a.profit)}</div>
              {a.earned > 0 && <div style={{ color: T.green, fontSize: 12 }}>+{$(a.earned)}</div>}
            </div>
          </button>
          {open === a.id && <AccountCard a={a} s={s} kinds={kinds} canEdit={canEdit} busy={busy} run={run} />}
        </div>
      ))}

      {canEdit && (
        <div style={{ ...ui.card, marginTop: 10 }}>
          {s.payout ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>{monthName(s.month)} bonus paid: <strong>{$(s.payout.amount)}</strong></span>
              <button style={ui.btn} disabled={busy} onClick={() => run({ action: "unpaid", month: s.month })}>Undo paid</button>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: T.textMuted, fontSize: 13.5 }}>{s.complete ? `${monthName(s.month)} is done. Pay the ${$(t.bonus)} bonus and mark it paid.` : `The bonus is paid the first payday of ${dueLabel}.`}</span>
              {s.complete && <button style={ui.primary} disabled={busy} onClick={() => run({ action: "paid", month: s.month, amount: t.bonus })}>Mark {$0(t.bonus)} paid</button>}
            </div>
          )}
        </div>
      )}

      {err && <p style={{ color: T.red, fontWeight: 600, textAlign: "center" }}>{err}</p>}
    </div>
  );
}

function AddAccount({ kinds, canEdit, busy, onAdd }) {
  const [a, setA] = useState({ name: "", kind: "fleet", contact: "", phone: "", notes: "", existing: false });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onAdd(a); }} style={{ ...ui.card, marginBottom: 10, display: "grid", gap: 8 }}>
      <input placeholder="Business name" value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} style={inp} required />
      <select value={a.kind} onChange={(e) => setA({ ...a, kind: e.target.value })} style={inp}>
        {Object.entries(kinds).map(([k, v]) => <option key={k} value={k} style={{ color: "#111" }}>{v}</option>)}
      </select>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input placeholder="Contact name" value={a.contact} onChange={(e) => setA({ ...a, contact: e.target.value })} style={inp} />
        <input placeholder="Phone" inputMode="tel" value={a.phone} onChange={(e) => setA({ ...a, phone: e.target.value })} style={inp} />
      </div>
      <input placeholder="Notes (what they need, best time to call)" value={a.notes} onChange={(e) => setA({ ...a, notes: e.target.value })} style={inp} />
      {canEdit && <label style={{ fontSize: 13, color: T.textMuted, display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={a.existing} onChange={(e) => setA({ ...a, existing: e.target.checked })} />We already had this business (counts at 5%)</label>}
      <button style={ui.primary} disabled={busy}>{busy ? "Saving…" : "Save business"}</button>
    </form>
  );
}

function AccountCard({ a, s, kinds, canEdit, busy, run }) {
  const today = s.today && s.today.slice(0, 7) === s.month ? s.today : `${s.month}-01`;
  const [e, setE] = useState({ day: today, kind: a.kind, ref: "", profit: "", note: "" });
  const entries = s.entries.filter((x) => x.account_id === a.id);
  return (
    <div style={{ borderTop: `1px solid ${T.border}`, padding: "0.7rem 1rem 0.9rem", fontSize: 13.5 }}>
      <div style={{ color: T.textMuted, display: "grid", gap: 3 }}>
        {(a.contact || a.phone) && <div>{a.contact}{a.contact && a.phone ? " · " : ""}{a.phone ? <a href={`tel:${a.phone}`} style={{ color: T.text }}>{a.phone}</a> : null}</div>}
        <div>Signed {a.signed_on ? shortDay(a.signed_on) : "?"}{a.qualified_on ? ` · qualified ${shortDay(a.qualified_on)}` : ""}</div>
        {a.notes && <div>{a.notes}</div>}
      </div>

      <div style={{ ...label, marginTop: 12 }}>Paid jobs in {monthName(s.month)} · {entries.length}</div>
      {entries.length === 0 && <div style={{ color: T.textFaint, marginTop: 4 }}>Nothing logged this month yet.</div>}
      {entries.map((x) => (
        <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "7px 0", borderTop: `1px solid ${T.border}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{shortDay(x.day)}{x.ref ? <span style={{ color: T.textMuted, fontWeight: 400 }}> · {x.ref}</span> : null}</div>
            <div style={{ color: T.textMuted, fontSize: 12 }}>{kinds[x.kind] || x.kind}{x.note ? ` · ${x.note}` : ""}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <strong>{$(x.profit)}</strong>
            {canEdit && <button aria-label="Remove" style={{ ...ui.btn, width: 30, height: 30, padding: 0 }} disabled={busy} onClick={() => run({ action: "removeProfit", id: x.id, month: s.month })}><Icon name="close" size={16} /></button>}
          </div>
        </div>
      ))}

      {canEdit && (
        <>
          <form onSubmit={(ev) => { ev.preventDefault(); run({ action: "addProfit", account_id: a.id, month: s.month, ...e }).then((d) => d && setE({ ...e, ref: "", profit: "", note: "" })); }}
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
            <input type="date" value={e.day} onChange={(ev) => setE({ ...e, day: ev.target.value })} style={inp} required />
            <select value={e.kind} onChange={(ev) => setE({ ...e, kind: ev.target.value })} style={inp}>
              {Object.entries(kinds).map(([k, v]) => <option key={k} value={k} style={{ color: "#111" }}>{v}</option>)}
            </select>
            <input placeholder="Invoice / RO / scrap ticket" value={e.ref} onChange={(ev) => setE({ ...e, ref: ev.target.value })} style={inp} />
            <input placeholder="Profit $ (paid)" inputMode="decimal" value={e.profit} onChange={(ev) => setE({ ...e, profit: ev.target.value })} style={inp} required />
            <input placeholder="Note" value={e.note} onChange={(ev) => setE({ ...e, note: ev.target.value })} style={{ ...inp, gridColumn: "1 / -1" }} />
            <button style={{ ...ui.primary, gridColumn: "1 / -1" }} disabled={busy}>Log profit</button>
          </form>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {!a.existing && (a.qualified_on
              ? <button style={ui.btn} disabled={busy} onClick={() => run({ action: "updateAccount", id: a.id, month: s.month, patch: { qualified_on: null } })}>Undo qualified</button>
              : <button style={ui.btn} disabled={busy} onClick={() => run({ action: "updateAccount", id: a.id, month: s.month, patch: { qualified_on: today } })}>Qualified ({`$500 / 20 wheels`}) today</button>)}
            <button style={ui.btn} disabled={busy} onClick={() => run({ action: "updateAccount", id: a.id, month: s.month, patch: { existing: !a.existing } })}>{a.existing ? "Mark as new account" : "Mark as already ours"}</button>
            <button style={ui.btn} disabled={busy} onClick={() => window.confirm(`Remove ${a.name} and all its logged profit?`) && run({ action: "removeAccount", id: a.id, month: s.month })}>Remove</button>
          </div>
        </>
      )}
    </div>
  );
}

const Row = ({ k, v }) => <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ color: T.textMuted }}>{k}</span><span>{v}</span></div>;
const label = { fontSize: 11.5, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" };
const inp = { height: 36, boxSizing: "border-box", padding: "0 10px", borderRadius: 10, border: `1px solid ${T.borderStrong}`, background: "rgba(0,0,0,0.25)", color: T.text, fontSize: 14, fontFamily: "inherit", minWidth: 0, width: "100%" };
