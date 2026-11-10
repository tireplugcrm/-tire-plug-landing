// Admin "Belen's to-do" tab: a daily checklist the owner writes and Belen ticks off.
// The words are stored in Supabase through /api/admin/todo (never in this public repo).
// Edit format, one line each:  "# Title" · "## Section" · "- task" (a checkbox) ·
// "1. point" (numbered, no box) · anything else is a plain note. **bold** works anywhere.
import React, { useEffect, useState } from "react";
import { T, ui, Icon } from "./ui.js";

const itemText = (l) => l.replace(/^\s*[-*]\s+(\[[ xX]\]\s+)?/, "").trim();

function parse(text) {
  const out = { title: "", sections: [] };
  let sec = null;
  const ensure = () => { if (!sec) { sec = { heading: "", rows: [] }; out.sections.push(sec); } return sec; };
  for (const raw of String(text || "").split(/\r?\n/)) {
    const l = raw.trim();
    if (!l) continue;
    if (/^#\s/.test(l)) { out.title = l.replace(/^#\s+/, ""); continue; }
    if (/^##+\s/.test(l)) { sec = { heading: l.replace(/^##+\s+/, ""), rows: [] }; out.sections.push(sec); continue; }
    if (/^[-*]\s/.test(l)) { ensure().rows.push({ kind: "task", text: itemText(l) }); continue; }
    const n = l.match(/^(\d+)[.)]\s+(.*)$/);
    if (n) { ensure().rows.push({ kind: "num", n: n[1], text: n[2] }); continue; }
    ensure().rows.push({ kind: "note", text: l });
  }
  return out;
}

// **bold** only; everything else is plain text (no HTML from the stored words).
function Rich({ text }) {
  return String(text).split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p) ? <strong key={i} style={{ color: T.text, fontWeight: 600 }}>{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>);
}

export default function TodoTab({ auth, who = "belen", name = "Belen" }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const call = async (body) => {
    const res = await fetch("/api/admin/todo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, who, ...body }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  };
  const run = async (body) => { setBusy(true); setErr(""); try { setList(await call(body)); return true; } catch (e) { setErr(e.message); return false; } finally { setBusy(false); } };

  useEffect(() => { run({ action: "get" }); }, [who]); // eslint-disable-line react-hooks/exhaustive-deps

  const tick = async (item, checked) => {
    setList((l) => ({ ...l, done: checked ? [...l.done, item] : l.done.filter((x) => x !== item) })); // feels instant
    try { setList(await call({ action: "tick", item, checked })); } catch (e) { setErr(e.message); }
  };

  if (!list) return <div style={{ maxWidth: 720, margin: "0 auto", ...ui.muted }}>{err || "Loading…"}</div>;

  const doc = parse(list.text);
  const tasks = doc.sections.flatMap((s) => s.rows.filter((r) => r.kind === "task").map((r) => r.text));
  const doneSet = new Set(list.done);
  const doneCount = tasks.filter((t) => doneSet.has(t)).length;
  const when = list.updated_at ? new Date(list.updated_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <h1 style={ui.h1}>{doc.title || `${name}'s to-do`}</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!editing && tasks.length > 0 && <span style={ui.pill(doneCount === tasks.length ? T.green : T.amber)}>{doneCount} of {tasks.length} done</span>}
          {!editing && doneCount > 0 && <button style={ui.btn} disabled={busy} onClick={() => window.confirm("Untick every box to start a new day?") && run({ action: "reset" })}><Icon name="restart_alt" size={17} />New day</button>}
          {!editing
            ? <button style={ui.btn} onClick={() => { setDraft(list.text); setEditing(true); }}><Icon name="edit" size={17} />Edit</button>
            : <>
                <button style={ui.btn} disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
                <button style={ui.primary} disabled={busy} onClick={async () => { if (await run({ action: "save", text: draft })) setEditing(false); }}>{busy ? "Saving…" : "Save"}</button>
              </>}
        </div>
      </div>
      {err && <div style={{ ...ui.card, color: T.red, marginBottom: 10 }}>{err}</div>}

      {editing ? (
        <div style={ui.card}>
          <div style={{ ...ui.muted, marginBottom: 8 }}><code># Title</code> · <code>## Section</code> · <code>- task</code> (gets a checkbox) · <code>1. point</code> · <code>**bold**</code> · any other line is a note.</div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={28}
            style={{ ...ui.input, height: "auto", padding: "0.6rem 0.75rem", fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 13, lineHeight: 1.55, resize: "vertical" }} />
        </div>
      ) : doc.sections.length === 0 ? (
        <div style={{ ...ui.card, ...ui.muted }}>Nothing on the list yet. Tap Edit to write it.</div>
      ) : doc.sections.map((s, si) => (
        <div key={si} style={{ ...ui.card, marginBottom: 10 }}>
          {s.heading && <div style={{ color: T.text, fontWeight: 600, fontSize: 15.5, marginBottom: 8 }}><Rich text={s.heading} /></div>}
          {s.rows.map((r, ri) => {
            if (r.kind === "task") {
              const on = doneSet.has(r.text);
              return (
                <label key={ri} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0", cursor: "pointer", fontSize: 14.5, lineHeight: 1.5, color: on ? T.textFaint : T.text }}>
                  <input type="checkbox" checked={on} onChange={(e) => tick(r.text, e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: T.green, flex: "none", cursor: "pointer" }} />
                  <span style={{ textDecoration: on ? "line-through" : "none" }}><Rich text={r.text} /></span>
                </label>
              );
            }
            if (r.kind === "num") return <div key={ri} style={{ display: "flex", gap: 10, padding: "4px 0", fontSize: 14.5, lineHeight: 1.5, color: T.text }}><span style={{ color: T.textMuted, minWidth: 18, textAlign: "right" }}>{r.n}.</span><span><Rich text={r.text} /></span></div>;
            return <div key={ri} style={{ ...ui.muted, fontSize: 13.5, padding: "4px 0" }}><Rich text={r.text} /></div>;
          })}
        </div>
      ))}
      {!editing && when && <div style={{ ...ui.muted, fontSize: 12, textAlign: "right" }}>Last change {when}{list.updated_by ? ` · ${list.updated_by}` : ""}</div>}
    </div>
  );
}
