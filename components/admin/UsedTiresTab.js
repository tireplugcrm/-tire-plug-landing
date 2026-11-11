// Admin "Used tires": every takeoff group with its photos. Staff look up what's here and mark
// tires sold; the owner sets the price and puts a group on the website.
import React, { useEffect, useMemo, useState } from "react";
import { T, ui } from "./ui.js";

const FILTERS = [["draft", "Needs price"], ["live", "On website"], ["sold", "Sold"], ["hidden", "Hidden"]];
const COLOR = { draft: T.amber, live: T.green, sold: T.textMuted, hidden: T.textMuted };
const LABEL = { draft: "Needs price", live: "On website", sold: "Sold", hidden: "Hidden" };
const norm = (s) => String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
const GROUP = { 0: "None left", 1: "Single", 2: "Double", 3: "3 tires", 4: "Full set" };
const FIELDS = [["size", "Size"], ["brand", "Brand"], ["model", "Model"], ["load_speed", "Load / speed"], ["dot_week", "DOT week"], ["dot_year", "DOT year"], ["tread_32", "Tread (32nds)"], ["price_each", "Price each $"]];

function Row({ t, call, onChange }) {
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const val = (k) => (k in f ? f[k] : t[k] ?? "");
  const dirty = Object.keys(f).length > 0;
  const age = t.dot_year ? new Date().getFullYear() - t.dot_year : null;
  const run = async (body) => {
    setBusy(true); setNote("");
    try {
      if (dirty && body.action !== "update") await call({ action: "update", id: t.id, fields: f });
      const r = await call({ id: t.id, ...body });
      setF({}); onChange(r.tire);
      if (r.error) setNote(r.error);
    } catch (e) { setNote(e.message); }
    setBusy(false);
  };
  return (
    <div style={{ ...ui.card, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ color: T.text, fontWeight: 600, fontSize: 15 }}>U{t.tag} · {t.size || "Size not read"} · {GROUP[t.qty]}{t.qty !== t.qty_start ? ` (of ${t.qty_start})` : ""}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {age != null && age >= 6 && <span style={ui.pill(T.red)}>{age} years old</span>}
          <span style={ui.pill(COLOR[t.status])}>{LABEL[t.status]}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", margin: "10px 0" }}>
        {t.photos.map((p, i) => (
          <div key={p.thumb} style={{ flex: "0 0 92px", textAlign: "center" }}>
            <a href={p.full} target="_blank" rel="noopener noreferrer"><img src={p.thumb} alt={`Photo ${i + 1}`} loading="lazy" style={{ width: 92, height: 92, objectFit: "cover", borderRadius: 8, display: "block", outline: i === 0 ? `2px solid ${T.blue}` : "none", outlineOffset: -2 }} /></a>
            {i > 0 && <button disabled={busy} onClick={() => run({ action: "cover", index: i })} style={{ background: "none", border: "none", color: T.textMuted, fontSize: 11.5, cursor: "pointer", padding: "3px 0", fontFamily: "inherit" }}>Make main</button>}
          </div>
        ))}
      </div>
      {(t.read?.notes || t.read?.mixed || t.read_error) && (
        <div style={{ ...ui.muted, color: T.amber, marginBottom: 8 }}>{t.read?.mixed ? "Photos look like different tires. " : ""}{t.read_error || t.read?.notes}</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0 10px" }}>
        {FIELDS.map(([k, name]) => (
          <div key={k}>
            <label style={ui.label}>{name}</label>
            <input value={val(k)} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} style={ui.input} />
          </div>
        ))}
      </div>
      <label style={ui.label}>Staff notes (never shown on the website)</label>
      <input value={val("notes")} onChange={(e) => setF((x) => ({ ...x, notes: e.target.value }))} style={ui.input} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {dirty && <button disabled={busy} onClick={() => run({ action: "update", fields: f })} style={ui.primary}>Save</button>}
        {t.status !== "live" && t.status !== "sold" && <button disabled={busy} onClick={() => run({ action: "status", status: "live" })} style={ui.primary}>Put on website</button>}
        {t.status === "live" && <button disabled={busy} onClick={() => run({ action: "status", status: "draft" })} style={ui.btn}>Take off website</button>}
        {t.qty > 0 && <button disabled={busy} onClick={() => run({ action: "sold", n: 1 })} style={ui.btn}>Sold 1</button>}
        {t.qty < t.qty_start && <button disabled={busy} onClick={() => run({ action: "sold", n: -1 })} style={ui.btn}>Undo sold</button>}
        <button disabled={busy} onClick={() => run({ action: "reread" })} style={ui.btn}>Read photos again</button>
        {t.status !== "hidden" && t.status !== "sold" && <button disabled={busy} onClick={() => run({ action: "status", status: "hidden" })} style={ui.btn}>Hide</button>}
        {t.status === "hidden" && <button disabled={busy} onClick={() => run({ action: "status", status: "draft" })} style={ui.btn}>Unhide</button>}
        {note && <span style={{ ...ui.muted, color: T.red }}>{note}</span>}
      </div>
    </div>
  );
}

export default function UsedTiresTab({ auth }) {
  const [tires, setTires] = useState(null);
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("draft");
  const [q, setQ] = useState("");
  const call = async (body) => {
    const res = await fetch("/api/admin/used-tires", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  };
  useEffect(() => { call({ action: "list" }).then((j) => { setTires(j.tires); setLink(j.link); }).catch((e) => setErr(e.message)); /* eslint-disable-next-line */ }, []);
  const count = (s) => (tires || []).filter((t) => t.status === s).length;
  const shown = useMemo(() => {
    const n = norm(q);
    if (n) return (tires || []).filter((t) => norm(`${t.size} ${t.brand} ${t.model} U${t.tag}`).includes(n));
    return (tires || []).filter((t) => t.status === filter);
  }, [tires, filter, q]);
  const onChange = (next) => setTires((l) => l.map((t) => (t.id === next.id ? next : t)));
  const left = (tires || []).filter((t) => t.status === "draft" || t.status === "live").reduce((n, t) => n + t.qty, 0);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <h1 style={ui.h1}>Used tires{tires ? ` · ${left} on hand` : ""}</h1>
        {link && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <a href={link} target="_blank" rel="noopener noreferrer" style={ui.primary}>Upload page</a>
          <button onClick={() => navigator.clipboard?.writeText(link)} style={ui.btn}>Copy link</button>
          <a href="/used-tires-los-angeles" target="_blank" rel="noopener noreferrer" style={ui.btn}>Website page</a>
        </div>}
      </div>
      {err && <div style={{ ...ui.card, color: T.red }}>{err}</div>}
      {!tires && !err && <div style={ui.muted}>Loading…</div>}
      {tires && <>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search size, brand or U number" style={{ ...ui.input, maxWidth: 340 }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {FILTERS.map(([id, name]) => <button key={id} onClick={() => { setFilter(id); setQ(""); }} style={filter === id && !q ? ui.primary : ui.btn}>{name} ({count(id)})</button>)}
        </div>
        {shown.length === 0 && <div style={ui.muted}>Nothing here.</div>}
        {shown.map((t) => <Row key={t.id} t={t} call={call} onChange={onChange} />)}
      </>}
    </div>
  );
}
