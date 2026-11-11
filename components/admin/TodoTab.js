// Admin "Belen's to-do" tab: a daily checklist the owner writes and Belen ticks off.
// The words are stored in Supabase through /api/admin/todo (never in this public repo).
// Edit format, one line each:  "# Title" · "## Section" · "- task" (a checkbox) ·
// "1. point" (numbered, no box) · anything else is a plain note. **bold** works anywhere.
import React, { useEffect, useState } from "react";
import { T, ui, Icon } from "./ui.js";
import { tasksForDay, shopToday } from "../../lib/todo-days.js";

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

// "Nov 9" for a YYYY-MM-DD day (the day a Good to know line was added).
const shortDate = (d) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "");
function DateChip({ day }) {
  if (!day) return null;
  return <span title={`Added ${day}`} style={{ marginLeft: "auto", paddingLeft: 10, color: T.textFaint, fontSize: 12, whiteSpace: "nowrap", flex: "none" }}>{shortDate(day)}</span>;
}
const TITLES = { daily: "Every day", weekly: "Every week", monthly: "Every month" };
const RESETS = { daily: "Boxes clear every morning.", weekly: "Boxes clear every Monday.", monthly: "Boxes clear on the 1st." };

// **bold** only; everything else is plain text (no HTML from the stored words).
function Rich({ text }) {
  return String(text).split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p) ? <strong key={i} style={{ color: T.text, fontWeight: 600 }}>{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>);
}

// `call` (optional) replaces the admin fetch, e.g. the /belen page posting her code instead;
// `canEdit` false hides Edit and New day.
// `list` "know" = the "Good to know" list and "plan" = "How your bonus works": same editor, but "- " lines
// are plain bullets (no boxes); "know" lines also show the day they were added.
export default function TodoTab({ auth, who = "belen", name = "Belen", call: callProp, canEdit = true, list: listName = "todo" }) {
  const know = listName === "know";
  const plain = listName === "know" || listName === "plan"; // info lists: bullets, no boxes
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const call = callProp ? (body) => callProp({ list: listName, ...body }) : async function adminCall(body) {
    const res = await fetch("/api/admin/todo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, who, list: listName, ...body }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  };
  const run = async (body) => { setBusy(true); setErr(""); try { setList(await call(body)); return true; } catch (e) { setErr(e.message); return false; } finally { setBusy(false); } };

  useEffect(() => { run({ action: "get" }); }, [who, listName]); // eslint-disable-line react-hooks/exhaustive-deps

  const tick = async (item, checked) => {
    setList((l) => ({ ...l, done: checked ? [...l.done, item] : l.done.filter((x) => x !== item), skipped: checked ? (l.skipped || []).filter((x) => x !== item) : l.skipped })); // feels instant
    try { setList(await call({ action: "tick", item, checked })); } catch (e) { setErr(e.message); }
  };
  // Scratch = it isn't happening today (counts as handled, shown crossed out in red).
  const scratch = async (item, skipped) => {
    setList((l) => ({ ...l, skipped: skipped ? [...(l.skipped || []), item] : (l.skipped || []).filter((x) => x !== item), done: skipped ? l.done.filter((x) => x !== item) : l.done }));
    try { setList(await call({ action: "skip", item, skipped })); } catch (e) { setErr(e.message); }
  };

  if (!list) return <div style={{ maxWidth: 720, margin: "0 auto", ...ui.muted }}>{err || "Loading…"}</div>;

  const doc = parse(list.text);
  // The plain to-do counts only what's due today; a section dated for another day doesn't count yet.
  const tasks = plain ? [] : listName === "todo" ? tasksForDay(list.text, shopToday()).map((t) => t.text) : doc.sections.flatMap((s) => s.rows.filter((r) => r.kind === "task").map((r) => r.text));
  const doneSet = new Set(list.done);
  const doneCount = tasks.filter((t) => doneSet.has(t)).length;
  const skipSet = new Set(list.skipped || []);
  const skipCount = tasks.filter((t) => skipSet.has(t) && !doneSet.has(t)).length;
  const when = list.updated_at ? new Date(list.updated_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <h1 style={ui.h1}>{doc.title || (listName === "plan" ? "How your bonus works" : know ? "Good to know" : TITLES[listName] || `${name}'s to-do`)}</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!editing && tasks.length > 0 && <span style={ui.pill(doneCount + skipCount === tasks.length ? T.green : T.amber)}>{doneCount} of {tasks.length} done{skipCount ? ` · ${skipCount} scratched` : ""}</span>}
          {canEdit && !editing && doneCount + skipCount > 0 && <button style={ui.btn} disabled={busy} onClick={() => window.confirm("Untick every box to start a new day?") && run({ action: "reset" })}><Icon name="restart_alt" size={17} />New day</button>}
          {!canEdit ? null : !editing
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
          <div style={{ ...ui.muted, marginBottom: 8 }}><code># Title</code> · <code>## Section</code> · <code>- {plain ? "point" : "task"}</code>{plain ? "" : " (gets a checkbox)"} · <code>1. point</code> · <code>**bold**</code> · any other line is a note.{know ? " Each line shows the day it was added; rewording a line gives it today's date." : ""}</div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={28}
            style={{ ...ui.input, height: "auto", padding: "0.6rem 0.75rem", fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 13, lineHeight: 1.55, resize: "vertical" }} />
        </div>
      ) : doc.sections.length === 0 ? (
        <div style={{ ...ui.card, ...ui.muted }}>{canEdit ? "Nothing on the list yet. Tap Edit to write it." : "Nothing on the list yet."}</div>
      ) : doc.sections.map((s, si) => (
        <div key={si} style={{ ...ui.card, marginBottom: 10 }}>
          {s.heading && <div style={{ color: T.text, fontWeight: 600, fontSize: 15.5, marginBottom: 8 }}><Rich text={s.heading} /></div>}
          {s.rows.map((r, ri) => {
            if (r.kind === "task" && plain) return <div key={ri} style={{ display: "flex", gap: 10, padding: "5px 0", fontSize: 14.5, lineHeight: 1.5, color: T.text }}><span style={{ color: T.textMuted }}>•</span><span><Rich text={r.text} /></span>{know && <DateChip day={list.added?.[r.text]} />}</div>;
            if (r.kind === "task") {
              const on = doneSet.has(r.text);
              const off = !on && skipSet.has(r.text);
              return (
                <div key={ri} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <label style={{ flex: 1, display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0", cursor: "pointer", fontSize: 14.5, lineHeight: 1.5, color: on || off ? T.textFaint : T.text }}>
                    <input type="checkbox" checked={on} onChange={(e) => tick(r.text, e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: T.green, flex: "none", cursor: "pointer" }} />
                    <span style={{ textDecoration: on || off ? "line-through" : "none", textDecorationColor: off ? T.red : undefined }}><Rich text={r.text} />{off && <span style={{ ...ui.pill(T.red), marginLeft: 6, textDecoration: "none", display: "inline-flex" }}>scratched</span>}</span>
                  </label>
                  {!on && <button onClick={() => scratch(r.text, !off)} title={off ? "Bring it back" : "Scratch it (not happening today)"} aria-label={off ? "Unscratch" : "Scratch"}
                    style={{ ...ui.btn, height: 28, padding: "0 8px", marginTop: 3, fontSize: 12, color: off ? T.text : T.textMuted }}>{off ? "Undo" : <Icon name="close" size={15} />}</button>}
                </div>
              );
            }
            if (r.kind === "num") return <div key={ri} style={{ display: "flex", gap: 10, padding: "4px 0", fontSize: 14.5, lineHeight: 1.5, color: T.text }}><span style={{ color: T.textMuted, minWidth: 18, textAlign: "right" }}>{r.n}.</span><span><Rich text={r.text} /></span>{know && <DateChip day={list.added?.[r.text]} />}</div>;
            return <div key={ri} style={{ ...ui.muted, fontSize: 13.5, padding: "4px 0", display: "flex" }}><span><Rich text={r.text} /></span>{know && <DateChip day={list.added?.[r.text]} />}</div>;
          })}
        </div>
      ))}
      {!editing && RESETS[listName] && <div style={{ ...ui.muted, fontSize: 12 }}>{RESETS[listName]}</div>}
      {!editing && when && <div style={{ ...ui.muted, fontSize: 12, textAlign: "right" }}>Last change {when}{list.updated_by ? ` · ${list.updated_by}` : ""}</div>}
    </div>
  );
}
