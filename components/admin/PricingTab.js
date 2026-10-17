// Admin → Pricing: the control room for in-stock tire prices (lib/pricing.js).
// Health of the autopilot, stock upload, what needs attention, every tire with bulk edits, markup
// rules and settings, history with undo, the draft → publish bar, and the site agent.
// Changes are staged in a draft; nothing reaches the website until Publish.
import React, { useEffect, useMemo, useRef, useState } from "react";

const SOURCES = {
  markup: { label: "Cost + markup", color: "#1a7f4b" },
  owner: { label: "Your price", color: "#2563eb" },
  catalog: { label: "Catalog price", color: "#7c3aed" },
  hidden: { label: "Hidden", color: "#8A94A6" },
  none: { label: "No cost", color: "#FF8844" },
};
const FLAGS = { held: ["Held", "#b45309"], below_cost: ["Below cost", "#d33"], low_profit: ["Low profit", "#d97706"], no_cost: ["No cost", "#FF8844"] };
const money = (n) => (n == null ? "—" : `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`);
const ago = (t) => {
  if (!t) return "never";
  const m = Math.round((Date.now() - new Date(t)) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

const card = { background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 14, padding: "1rem 1.1rem", marginBottom: "1rem" };
const btn = { background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 8, padding: "0.55rem 0.9rem", fontWeight: 800, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" };
const red = { ...btn, background: "#FF1F1F" };
const ghost = { ...btn, background: "#f1f2f4", color: "#111" };
const input = { padding: "0.55rem 0.7rem", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, fontSize: "0.9rem", fontFamily: "inherit", boxSizing: "border-box", background: "#fff" };
const muted = { color: "rgba(0,0,0,0.55)", fontSize: "0.8rem" };
const chip = (color) => ({ display: "inline-block", fontSize: "0.68rem", fontWeight: 800, color, border: `1px solid ${color}`, borderRadius: 999, padding: "1px 7px", marginRight: 4 });

export default function PricingTab({ auth }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [view, setView] = useState("attention");

  async function call(body) {
    const res = await fetch("/api/admin/pricing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  }
  async function load() {
    try { setD(await call({ action: "state" })); setErr(""); } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); /* eslint-disable-next-line */ }, []);
  async function act(label, body, after) {
    setBusy(label);
    try { const j = await call(body); await load(); after?.(j); return j; } catch (e) { alert(e.message); return null; } finally { setBusy(""); }
  }
  const stage = (items) => act("Adding to draft…", { action: "stage", items });

  if (err) return <div style={card}><b>Pricing couldn't load.</b><div style={{ ...muted, marginTop: 6 }}>{err}</div><div style={{ ...muted, marginTop: 6 }}>First time? Run lib/pricing-schema.sql and the private setup file in Supabase.</div></div>;
  if (!d) return <p style={muted}>Loading prices…</p>;
  const canEdit = d.canEdit;
  const att = d.attention;
  const attCount = att.held + att.belowCost + att.lowProfit + att.noCost;

  return (
    <div style={{ paddingBottom: d.drafts?.drafts?.length ? 90 : 0 }}>
      <Health d={d} canEdit={canEdit} busy={busy} act={act} />
      {canEdit && <StockUpload auth={auth} act={act} busy={busy} />}
      {canEdit && <SiteAgent auth={auth} onChange={load} />}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "0.2rem 0 0.8rem" }}>
        {[["attention", `Needs attention${attCount ? ` (${attCount})` : ""}`], ["tires", `All tires (${d.rows.length})`], ["rules", "Rules & settings"], ["history", "History"]].map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} style={view === k ? btn : ghost}>{label}</button>
        ))}
      </div>
      {view === "attention" && <Attention d={d} canEdit={canEdit} busy={busy} act={act} stage={stage} />}
      {view === "tires" && <AllTires d={d} canEdit={canEdit} busy={busy} stage={stage} />}
      {view === "rules" && <Rules d={d} canEdit={canEdit} busy={busy} stage={stage} />}
      {view === "history" && <History d={d} canEdit={canEdit} busy={busy} act={act} />}
      {canEdit && d.drafts?.drafts?.length > 0 && <DraftBar drafts={d.drafts} busy={busy} act={act} />}
      {busy && <div style={{ position: "fixed", top: 12, right: 12, background: "#111", color: "#fff", padding: "0.5rem 0.9rem", borderRadius: 8, fontWeight: 700, fontSize: "0.85rem", zIndex: 50 }}>{busy}</div>}
    </div>
  );
}

function Health({ d, canEdit, busy, act }) {
  const h = d.health, live = d.settings.live, ap = h.autopilot;
  const apOk = ap && Date.now() - new Date(ap.at) < 30 * 60000 && ap.ok;
  const stockOld = !h.stockSyncedAt || Date.now() - new Date(h.stockSyncedAt) > 3 * 864e5;
  const dot = (ok) => <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 9, background: ok ? "#1a7f4b" : "#d97706", marginRight: 6 }} />;
  return (
    <div style={{ ...card, borderColor: live ? "#1a7f4b" : "#FFB800" }}>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: "1rem" }}>{live ? "🟢 Prices are LIVE on tireplugla.com" : "🟡 Prices are OFF: customers see “text for price”"}</div>
          <div style={{ ...muted, marginTop: 3 }}>{d.rows.length} tires in stock · {d.rows.filter((r) => r.price != null).length} priced · default cost + ${d.settings.markup} · install from $25/wheel</div>
        </div>
        {canEdit && <button style={live ? ghost : { ...red, padding: "0.75rem 1.1rem" }} disabled={!!busy} onClick={() => {
          if (confirm(live ? "Hide in-stock prices on the website (text for price)?" : `Show prices for ${d.rows.filter((r) => r.price != null).length} tires on tireplugla.com now?`)) act(live ? "Turning off…" : "Going live…", { action: "live", live: !live });
        }}>{live ? "Turn prices off" : "Go live"}</button>}
      </div>
      <div style={{ display: "flex", gap: "0.4rem 1.2rem", flexWrap: "wrap", marginTop: 10, fontSize: "0.8rem" }}>
        <span>{dot(!stockOld)}Stock: {h.stockSource === "tekmetric-api" ? "Tekmetric live" : h.stockSource === "tekmetric-csv" ? "CSV upload" : "saved snapshot"}, {ago(h.stockSyncedAt)}</span>
        <span>{dot(apOk)}Autopilot: {ap ? `${ago(ap.at)}${ap.ok ? "" : ` · ${Object.keys(ap.errors || {}).join(", ")} failed`}` : "hasn't run yet"}</span>
        <span>{dot(!h.pagesQueued)}Pages waiting to rebuild: {h.pagesQueued}</span>
        <span>{dot(!h.mismatches)}Live check: {h.mismatches ? `${h.mismatches} page(s) being fixed` : "all checked pages correct"}</span>
        <span>{dot(h.tekmetric)}Tekmetric API: {h.tekmetric ? "connected" : "waiting for keys (upload CSV meanwhile)"}</span>
        {canEdit && <button style={{ ...ghost, padding: "0.25rem 0.6rem" }} disabled={!!busy} onClick={() => act("Running autopilot…", { action: "run" })}>Run now</button>}
      </div>
    </div>
  );
}

function StockUpload({ auth, act, busy }) {
  const [res, setRes] = useState(null);
  async function upload(file, confirmShrink = false) {
    const csv = await file.text();
    setRes(null);
    try {
      const r = await fetch("/api/admin/pricing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, action: "upload", csv, confirmShrink }) });
      const j = await r.json();
      if (!r.ok) {
        if (/dropped from/.test(j.error || "") && confirm(`${j.error}\n\nUpload it anyway?`)) return upload(file, true);
        throw new Error(j.error || "Upload failed");
      }
      setRes(j.stock);
      act("Refreshing…", { action: "state" });
    } catch (e) { alert(e.message); }
  }
  return (
    <div style={{ ...card, display: "flex", gap: "0.8rem", alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 260px" }}>
        <div style={{ fontWeight: 800 }}>Update stock from Tekmetric</div>
        <div style={muted}>Tekmetric → Inventory → Download CSV, then drop it here. Stock, costs, prices and pages update by themselves. (Automatic once the Tekmetric API keys are in.)</div>
        {res && <div style={{ fontSize: "0.85rem", marginTop: 6, fontWeight: 700, color: "#1a7f4b" }}>✓ {res.tires} tires in stock · {res.added} new · {res.soldOut} sold out · {res.costChanged} cost changes · {res.pricesChanged} prices updated{res.held ? ` · ${res.held} held for your OK` : ""}</div>}
      </div>
      <label style={{ ...btn, display: "inline-block" }}>
        Choose CSV
        <input type="file" accept=".csv,text/csv" style={{ display: "none" }} disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
      </label>
    </div>
  );
}
function Attention({ d, canEdit, busy, act, stage }) {
  const held = d.rows.filter((r) => r.held != null);
  const groups = [
    ["Held for your OK: the autopilot kept the old price because the new one jumps more than " + d.settings.maxJumpPct + "%", held],
    ["Priced below cost", d.rows.filter((r) => r.flags.includes("below_cost"))],
    [`Under $${d.settings.minProfit} profit`, d.rows.filter((r) => r.flags.includes("low_profit"))],
    ["No cost in Tekmetric (shows “text for price”): add the cost in Tekmetric or set a price", d.rows.filter((r) => r.flags.includes("no_cost"))],
  ].filter(([, rows]) => rows.length);
  if (!groups.length) return <div style={card}><b>✅ Nothing needs you.</b><div style={muted}>Every in-stock tire has a price above cost + ${d.settings.minProfit}, and nothing is held.</div></div>;
  return groups.map(([title, rows], i) => (
    <div key={title} style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontWeight: 800 }}>{title} ({rows.length})</div>
        {i === 0 && rows === held && canEdit && <button style={red} disabled={!!busy} onClick={() => act("Accepting…", { action: "accept", ids: held.map((r) => r.id) })}>Accept all {held.length}</button>}
      </div>
      {rows.map((r) => <TireRow key={r.id} r={r} canEdit={canEdit} busy={busy} stage={stage} act={act} />)}
    </div>
  ));
}

function AllTires({ d, canEdit, busy, stage }) {
  const [q, setQ] = useState("");
  const [src, setSrc] = useState("all");
  const [sort, setSort] = useState("brand");
  const [sel, setSel] = useState(new Set());
  const [bulk, setBulk] = useState("");
  const counts = useMemo(() => d.rows.reduce((m, r) => ({ ...m, [r.source]: (m[r.source] || 0) + 1 }), {}), [d.rows]);
  const shown = useMemo(() => {
    const ws = q.toLowerCase().split(/\s+/).filter(Boolean).map((w) => w.replace(/[^a-z0-9]/g, ""));
    const rows = d.rows.filter((r) => (src === "all" || r.source === src) && ws.every((w) => `${r.brand}${r.model}${r.key}${r.lt ? "lt" : ""}`.toLowerCase().replace(/[^a-z0-9]/g, "").includes(w)));
    const by = { price: (r) => r.price ?? 1e9, profit: (r) => r.profit ?? 1e9, cost: (r) => r.cost ?? 1e9, units: (r) => -(r.available ?? 0) };
    return by[sort] ? [...rows].sort((a, b) => by[sort](a) - by[sort](b)) : rows;
  }, [d.rows, q, src, sort]);
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const picked = d.rows.filter((r) => sel.has(r.id));
  async function bulkApply(kind) {
    const amt = Number(bulk);
    const items = picked.map((r) => {
      if (kind === "set") return { kind: "tire", target: r.id, change: { action: "set_price", price: amt } };
      if (kind === "add") return r.price != null ? { kind: "tire", target: r.id, change: { action: "set_price", price: Math.max(1, r.price + amt) } } : null;
      return { kind: "tire", target: r.id, change: { action: kind } };
    }).filter(Boolean);
    if (items.length) { await stage(items); setSel(new Set()); setBulk(""); }
  }
  return (
    <div style={card}>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.7rem" }}>
        <input style={{ ...input, flex: "1 1 220px" }} placeholder="Search brand, model or size (lexani 20, 265/70R17)" value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={input} value={src} onChange={(e) => setSrc(e.target.value)}>
          <option value="all">All ({d.rows.length})</option>
          {Object.entries(SOURCES).map(([k, s]) => <option key={k} value={k}>{s.label} ({counts[k] || 0})</option>)}
        </select>
        <select style={input} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="brand">Sort: brand</option><option value="price">Sort: price</option>
          {canEdit && <><option value="profit">Sort: lowest profit</option><option value="cost">Sort: cost</option><option value="units">Sort: most units</option></>}
        </select>
      </div>
      {canEdit && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8, ...muted }}>
          <button style={ghost} onClick={() => setSel(sel.size === shown.length ? new Set() : new Set(shown.map((r) => r.id)))}>{sel.size === shown.length && shown.length ? "Clear" : `Select all ${shown.length}`}</button>
          {sel.size > 0 && <>
            <b style={{ color: "#111" }}>{sel.size} selected:</b>
            <input style={{ ...input, width: 90, padding: "0.4rem" }} type="number" placeholder="$" value={bulk} onChange={(e) => setBulk(e.target.value)} />
            <button style={btn} disabled={!!busy || !(Number(bulk) > 0)} onClick={() => bulkApply("set")}>Set price</button>
            <button style={btn} disabled={!!busy || !Number(bulk)} onClick={() => bulkApply("add")}>Add $ (use - to lower)</button>
            <button style={ghost} disabled={!!busy} onClick={() => bulkApply("use_default")}>Default</button>
            <button style={ghost} disabled={!!busy} onClick={() => bulkApply("hide")}>Hide</button>
            <button style={ghost} disabled={!!busy} onClick={() => bulkApply("show")}>Show</button>
          </>}
        </div>
      )}
      <div style={{ ...muted, marginBottom: 4 }}>Showing {shown.length}</div>
      {shown.map((r) => <TireRow key={r.id} r={r} canEdit={canEdit} busy={busy} stage={stage} selected={sel.has(r.id)} onSelect={canEdit ? () => toggle(r.id) : null} />)}
    </div>
  );
}

function TireRow({ r, canEdit, busy, stage, act, selected, onSelect }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState("");
  const [open, setOpen] = useState(false);
  const s = SOURCES[r.source] || SOURCES.none;
  return (
    <div style={{ padding: "0.55rem 0", borderTop: "1px solid rgba(0,0,0,0.07)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem 0.9rem", alignItems: "center" }}>
        {onSelect && <input type="checkbox" checked={!!selected} onChange={onSelect} style={{ width: 18, height: 18 }} />}
        <div style={{ flex: "1 1 230px", minWidth: 0, cursor: "pointer" }} onClick={() => setOpen(!open)}>
          <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>{r.brand} {r.model}</div>
          <div style={muted}>{r.lt ? "LT" : ""}{r.key} · {r.level === "low" ? "low stock" : "in stock"}{r.available != null ? ` (${r.available})` : ""} · <span style={{ color: s.color, fontWeight: 700 }}>{r.rule || s.label}</span></div>
          <div>{r.flags.filter((f) => FLAGS[f]).map((f) => <span key={f} style={chip(FLAGS[f][1])}>{FLAGS[f][0]}</span>)}</div>
        </div>
        {r.cost !== undefined && <div style={{ width: 66, ...muted }}>cost<br /><b style={{ color: "#111" }}>{money(r.cost)}</b></div>}
        <div style={{ width: 92 }}>
          <div style={muted}>price</div>
          <b style={{ fontSize: "1rem" }}>{money(r.price)}</b>
          {r.held != null && <div style={{ fontSize: "0.72rem", color: "#b45309", fontWeight: 800 }}>new: {money(r.held)}</div>}
        </div>
        {r.profit !== undefined && <div style={{ width: 62, ...muted }}>profit<br /><b style={{ color: r.profit != null && r.profit < 10 ? "#d33" : "#111" }}>{money(r.profit)}</b></div>}
        {canEdit && (
          <div style={{ display: "flex", gap: "0.3rem", alignItems: "center", flexWrap: "wrap" }}>
            {edit ? (
              <>
                <input style={{ ...input, width: 80, padding: "0.4rem 0.5rem" }} type="number" autoFocus value={val} onChange={(e) => setVal(e.target.value)} placeholder="$" />
                <button style={btn} disabled={!!busy || !(Number(val) > 0)} onClick={() => {
                  if (r.cost && Number(val) <= r.cost && !confirm(`$${val} is at or below cost (${money(r.cost)}). Add anyway?`)) return;
                  stage([{ kind: "tire", target: r.id, change: { action: "set_price", price: Number(val) } }]); setEdit(false);
                }}>Add to draft</button>
                <button style={ghost} onClick={() => setEdit(false)}>✕</button>
              </>
            ) : (
              <>
                {r.held != null && act && <button style={red} disabled={!!busy} onClick={() => act("Accepting…", { action: "accept", ids: [r.id] })}>Accept {money(r.held)}</button>}
                <button style={ghost} disabled={!!busy} onClick={() => { setVal(r.price ?? ""); setEdit(true); }}>Set price</button>
                {r.source === "owner" && <button style={ghost} disabled={!!busy} onClick={() => stage([{ kind: "tire", target: r.id, change: { action: "use_default" } }])}>Default</button>}
                {r.source === "hidden"
                  ? <button style={ghost} disabled={!!busy} onClick={() => stage([{ kind: "tire", target: r.id, change: { action: "show" } }])}>Show</button>
                  : r.price != null && <button style={ghost} disabled={!!busy} onClick={() => stage([{ kind: "tire", target: r.id, change: { action: "hide" } }])}>Hide</button>}
              </>
            )}
          </div>
        )}
      </div>
      {open && (
        <div style={{ margin: "6px 0 2px", padding: "0.6rem 0.8rem", background: "#f6f7f9", borderRadius: 10, fontSize: "0.85rem" }}>
          <b>Customers see:</b> {r.price != null ? <>{money(r.price)} each · {money(r.price * 4)} for 4{r.note ? ` · “${r.note}”` : ""} · install & balance from $25 per wheel</> : "Text for price"}
          {" · "}<a href={`/tires/${r.slug}`} target="_blank" rel="noreferrer">open the {r.key} page</a>
          {r.costUpdatedAt && <span style={muted}> · cost updated {ago(r.costUpdatedAt)}</span>}
        </div>
      )}
    </div>
  );
}

function Rules({ d, canEdit, busy, stage }) {
  const [s, setS] = useState({ markup: d.settings.markup, minProfit: d.settings.minProfit, maxJumpPct: d.settings.maxJumpPct, rounding: d.settings.rounding });
  const [nr, setNr] = useState({ name: "", brand: "", lt: "", minRim: "", maxRim: "", markup: "" });
  const brands = useMemo(() => [...new Set(d.rows.map((r) => r.brand))].sort(), [d.rows]);
  const changedSettings = Object.keys(s).filter((k) => String(s[k]) !== String(d.settings[k]));
  const ruleText = (r) => `${[r.brand, r.lt === true ? "LT" : r.lt === false ? "non-LT" : null, r.minRim || r.maxRim ? `${r.minRim || "any"}–${r.maxRim || "any"}" rims` : null].filter(Boolean).join(", ") || "Every tire"}: cost + $${r.markup}`;
  const field = (label, el) => <label style={{ display: "flex", flexDirection: "column", gap: 3, ...muted }}>{label}{el}</label>;
  return (
    <>
      <div style={card}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Settings</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          {field("Default markup ($ per tire)", <input style={{ ...input, width: 120 }} type="number" value={s.markup} onChange={(e) => setS({ ...s, markup: e.target.value })} disabled={!canEdit} />)}
          {field("Minimum profit ($ per tire)", <input style={{ ...input, width: 120 }} type="number" value={s.minProfit} onChange={(e) => setS({ ...s, minProfit: e.target.value })} disabled={!canEdit} />)}
          {field("Hold automatic jumps over (%)", <input style={{ ...input, width: 120 }} type="number" value={s.maxJumpPct} onChange={(e) => setS({ ...s, maxJumpPct: e.target.value })} disabled={!canEdit} />)}
          {field("Rounding", <select style={input} value={s.rounding} onChange={(e) => setS({ ...s, rounding: e.target.value })} disabled={!canEdit}><option value="whole">Whole dollars ($94)</option><option value="99">.99 ($93.99)</option></select>)}
          {canEdit && changedSettings.length > 0 && <button style={btn} disabled={!!busy} onClick={() => stage(changedSettings.map((k) => ({ kind: "setting", target: k, change: { value: k === "rounding" ? s[k] : Number(s[k]) } })))}>Add to draft</button>}
        </div>
      </div>
      <div style={card}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Markup rules</div>
        <div style={{ ...muted, marginBottom: 8 }}>Override the default markup for some tires. When several match, the one naming the most fields wins (brand beats LT beats rim size).</div>
        {!d.rules.length && <div style={muted}>No rules: every tire uses cost + ${d.settings.markup}.</div>}
        {d.rules.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "0.45rem 0", borderTop: "1px solid rgba(0,0,0,0.07)", alignItems: "center" }}>
            <div><b>{r.name || `Rule ${r.id}`}</b> <span style={muted}>· {ruleText(r)} · {d.rows.filter((x) => x.rule === (r.name || `Rule ${r.id}`)).length} tires</span></div>
            {canEdit && <button style={ghost} disabled={!!busy} onClick={() => stage([{ kind: "rule", target: String(r.id), change: { op: "delete" } }])}>Delete</button>}
          </div>
        ))}
        {canEdit && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.1)" }}>
            {field("Name", <input style={{ ...input, width: 140 }} value={nr.name} onChange={(e) => setNr({ ...nr, name: e.target.value })} placeholder="Lexani premium" />)}
            {field("Brand", <select style={input} value={nr.brand} onChange={(e) => setNr({ ...nr, brand: e.target.value })}><option value="">Any</option>{brands.map((b) => <option key={b}>{b}</option>)}</select>)}
            {field("LT", <select style={input} value={nr.lt} onChange={(e) => setNr({ ...nr, lt: e.target.value })}><option value="">Any</option><option value="true">LT only</option><option value="false">Not LT</option></select>)}
            {field("Rim from", <input style={{ ...input, width: 70 }} type="number" value={nr.minRim} onChange={(e) => setNr({ ...nr, minRim: e.target.value })} />)}
            {field("Rim to", <input style={{ ...input, width: 70 }} type="number" value={nr.maxRim} onChange={(e) => setNr({ ...nr, maxRim: e.target.value })} />)}
            {field("Markup $", <input style={{ ...input, width: 80 }} type="number" value={nr.markup} onChange={(e) => setNr({ ...nr, markup: e.target.value })} />)}
            <button style={btn} disabled={!!busy || nr.markup === ""} onClick={() => {
              stage([{ kind: "rule", target: `new:${Date.now()}`, change: { op: "upsert", rule: { name: nr.name || null, brand: nr.brand || null, lt: nr.lt === "" ? null : nr.lt === "true", minRim: nr.minRim ? Number(nr.minRim) : null, maxRim: nr.maxRim ? Number(nr.maxRim) : null, markup: Number(nr.markup) } } }]);
              setNr({ name: "", brand: "", lt: "", minRim: "", maxRim: "", markup: "" });
            }}>Add rule to draft</button>
          </div>
        )}
      </div>
    </>
  );
}

function History({ d, canEdit, busy, act }) {
  return (
    <>
      <div style={card}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Publishes</div>
        {!d.publishes.length && <div style={muted}>Nothing published yet.</div>}
        {d.publishes.map((p) => (
          <div key={p.id} style={{ padding: "0.5rem 0", borderTop: "1px solid rgba(0,0,0,0.07)", display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px" }}>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", textDecoration: p.undone ? "line-through" : "none" }}>{p.summary}</div>
              <div style={muted}>{new Date(p.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {p.via === "agent" ? "🤖 agent for " : ""}{p.who}{p.undone ? " · undone" : ""}</div>
              <div style={{ ...muted, marginTop: 2 }}>{(p.items || []).slice(0, 4).join(" · ")}{(p.items || []).length > 4 ? ` · +${p.items.length - 4} more` : ""}</div>
            </div>
            {canEdit && !p.undone && <button style={ghost} disabled={!!busy} onClick={() => confirm("Put back the prices from before this publish?") && act("Undoing…", { action: "undo", id: p.id })}>Undo</button>}
          </div>
        ))}
      </div>
      {d.changes?.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Activity</div>
          {d.changes.map((c) => (
            <div key={c.id} style={{ ...muted, padding: "3px 0" }}>
              {new Date(c.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {c.via === "autopilot" ? "⚙️ autopilot" : c.via === "agent" ? `🤖 ${c.who}` : c.who} · {c.action.replace(/_/g, " ")}
              {c.detail?.count ? ` (${c.detail.count})` : ""}{c.detail?.tire ? ` ${c.detail.tire}` : ""}{c.detail?.subject ? `: ${c.detail.subject}` : ""}
              {c.action === "stock_synced" ? ` · ${c.detail?.added || 0} new, ${c.detail?.soldOut || 0} sold out, ${c.detail?.costChanged || 0} cost changes` : ""}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function DraftBar({ drafts, busy, act }) {
  const [open, setOpen] = useState(false);
  const s = drafts.summary;
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, background: "#111", color: "#fff", boxShadow: "0 -6px 20px rgba(0,0,0,0.25)" }}>
      {open && (
        <div style={{ maxHeight: "55vh", overflowY: "auto", padding: "0.8rem 1rem", background: "#fff", color: "#111", borderTop: "3px solid #FF1F1F" }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Changes in the draft</div>
          {drafts.drafts.map((x) => (
            <div key={x.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.85rem", padding: "3px 0" }}>
              <span>{x.via === "agent" ? "🤖 " : ""}{x.text}</span>
              <button style={{ ...ghost, padding: "0.15rem 0.5rem" }} disabled={!!busy} onClick={() => act("Removing…", { action: "discard", ids: [x.id] })}>✕</button>
            </div>
          ))}
          <div style={{ fontWeight: 800, margin: "10px 0 4px" }}>Website prices that change ({drafts.effects.length})</div>
          {drafts.effects.map((e) => (
            <div key={e.id} style={{ fontSize: "0.82rem", padding: "3px 0", borderTop: "1px solid rgba(0,0,0,0.06)", color: e.flags.includes("below_cost") ? "#d33" : "#111" }}>
              {e.tire}: {money(e.from)} → <b>{money(e.to)}</b>{e.profit != null ? <span style={muted}> · profit {money(e.profit)}</span> : null}
              {e.flags.filter((f) => FLAGS[f]).map((f) => <span key={f} style={{ ...chip(FLAGS[f][1]), marginLeft: 6 }}>{FLAGS[f][0]}</span>)}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "0.7rem 1rem", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 200px", fontWeight: 800, fontSize: "0.9rem" }}>
          Draft: {s.changes} change{s.changes === 1 ? "" : "s"} → {s.prices} website price{s.prices === 1 ? "" : "s"}
          {s.belowCost ? <span style={{ color: "#ff8a8a" }}> · {s.belowCost} below cost</span> : null}
          {s.lowProfit ? <span style={{ color: "#ffd27a" }}> · {s.lowProfit} low profit</span> : null}
        </div>
        <button style={{ ...ghost, background: "#333", color: "#fff" }} onClick={() => setOpen(!open)}>{open ? "Hide" : "Review"}</button>
        <button style={{ ...ghost, background: "#333", color: "#fff" }} disabled={!!busy} onClick={() => confirm("Throw away every change in the draft?") && act("Discarding…", { action: "discard" })}>Discard</button>
        <button style={red} disabled={!!busy} onClick={() => act("Publishing… rebuilding pages", { action: "publish" }, () => setOpen(false))}>Publish</button>
      </div>
    </div>
  );
}

// The site agent: streams its reply; the chat is saved on the server and reloads with the page.
function SiteAgent({ auth, onChange }) {
  const [chatId, setChatId] = useState(null);
  const [bubbles, setBubbles] = useState([]);
  const [text, setText] = useState("");
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const listRef = useRef();
  useEffect(() => {
    fetch("/api/admin/site-agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, action: "load" }) })
      .then((r) => r.json()).then((j) => { if (j.chatId) { setChatId(j.chatId); setBubbles(j.bubbles || []); } }).catch(() => {});
    /* eslint-disable-next-line */
  }, []);
  useEffect(() => { listRef.current?.scrollTo(0, listRef.current.scrollHeight); }, [bubbles, status]);

  async function send(e) {
    e?.preventDefault();
    const t = text.trim();
    if (!t || working) return;
    setText(""); setError(""); setWorking(true); setStatus("Thinking…");
    setBubbles((b) => [...b, { me: true, text: t }, { me: false, text: "" }]);
    const append = (s) => setBubbles((b) => { const n = [...b]; n[n.length - 1] = { me: false, text: n[n.length - 1].text + s }; return n; });
    let changed = false;
    try {
      const res = await fetch("/api/admin/site-agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, chatId, text: t }) });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || "Site agent failed");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const line = buf.slice(0, i).replace(/^data: /, ""); buf = buf.slice(i + 2);
          let ev; try { ev = JSON.parse(line); } catch { continue; }
          if (ev.type === "text") { append(ev.text); setStatus(""); }
          else if (ev.type === "status") setStatus(ev.text.slice(-140));
          else if (ev.type === "tool") setStatus({ search_tires: "Looking up tires…", pricing_overview: "Checking the pricing setup…", show_draft: "Checking the draft…", publish_draft: "Publishing…", undo_publish: "Undoing…", accept_held: "Accepting held prices…" }[ev.name] || "Updating the draft…");
          else if (ev.type === "done") { setChatId(ev.chatId); changed = ev.draftChanged || ev.published; }
          else if (ev.type === "error") { setError(ev.error); if (ev.chatId) setChatId(ev.chatId); changed = ev.draftChanged || ev.published; }
        }
      }
    } catch (err) { setError(err.message); setText(t); }
    setBubbles((b) => b.filter((x, i) => !(i === b.length - 1 && !x.me && !x.text.trim())));
    setWorking(false); setStatus("");
    if (changed) onChange();
  }

  return (
    <div style={{ ...card, borderColor: "#111" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontWeight: 900 }}>🤖 Site agent</div>
        {bubbles.length > 0 && <button style={ghost} disabled={working} onClick={() => { setChatId(null); setBubbles([]); setError(""); }}>New chat</button>}
      </div>
      <div style={{ ...muted, margin: "4px 0 10px" }}>Tell it what to change: “price every Lexani at cost + $35”, “what needs my attention?”, “set the Hankook 225/65R17 to $129”. It stages changes in the draft; say “publish” when you're happy, or use the Publish bar.</div>
      <div ref={listRef} style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto", marginBottom: 10 }}>
        {bubbles.map((b, i) => (
          <div key={i} style={{ alignSelf: b.me ? "flex-end" : "flex-start", maxWidth: "88%", background: b.me ? "#111" : "#f1f2f4", color: b.me ? "#fff" : "#111", padding: "0.55rem 0.8rem", borderRadius: 12, fontSize: "0.88rem", whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{b.text || "…"}</div>
        ))}
        {working && status && <div style={{ ...muted, fontStyle: "italic" }}>{status}</div>}
        {error && <div style={{ color: "#d33", fontSize: "0.85rem", fontWeight: 700 }}>⚠ {error}</div>}
      </div>
      <form onSubmit={send} style={{ display: "flex", gap: 8 }}>
        <input style={{ ...input, flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask the site agent…" disabled={working} />
        <button style={btn} disabled={working || !text.trim()}>Send</button>
      </form>
    </div>
  );
}
