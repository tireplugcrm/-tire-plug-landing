// Admin → Invoices: the daily delivery-invoice check-in (lib/invoices.js).
// Staff get a text at 10:00 AM and 4:30 PM, snap the invoices on /invoices, and the AI reads them.
// Here: who gets the texts, every day's answer (a gap is a day nobody answered), each invoice with
// the AI's read, and "Mark entered" once the tires are in Tekmetric.
import React, { useEffect, useState } from "react";
import { T, Icon, ui } from "./ui.js";

const START = "2026-10-27"; // first day of check-ins; earlier days aren't gaps
const money = (n) => (n == null || n === "" ? "—" : `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const dayLabel = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const time = (t) => (t ? new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }) : "");
const isSunday = (d) => new Date(`${d}T12:00:00`).getDay() === 0;

export default function InvoicesTab({ auth }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [textTo, setTextTo] = useState("");
  const [open, setOpen] = useState({});

  async function call(body) {
    const res = await fetch("/api/admin/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  }
  async function load() {
    try {
      const j = await call({ action: "list" });
      setD(j); setErr("");
      setTextTo((v) => v || (j.textTo || "").split(",").filter(Boolean).map((p) => `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`).join(", "));
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  async function act(label, body) {
    setBusy(label);
    try { const j = await call(body); await load(); return j; } catch (e) { alert(e.message); return null; } finally { setBusy(""); }
  }

  if (err) return <div style={{ ...ui.card, color: T.red }}>{err}</div>;
  if (!d) return <p style={ui.muted}>Loading…</p>;

  const today = d.days[0]?.day;
  const due = (x) => x.day >= START && !isSunday(x.day);
  const gaps = d.days.filter((x) => due(x) && x.day !== today && !x.status);
  const all = d.days.flatMap((x) => x.uploads);
  const notEntered = all.filter((u) => !u.entered_at && !u.duplicate && u.read?.is_invoice !== false);
  const dups = all.filter((u) => u.duplicate);
  const phones = (d.textTo || "").split(",").filter(Boolean);

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={ui.h1}>Invoices</h1>
      <p style={{ ...ui.muted, margin: "4px 0 16px" }}>A text goes out Mon–Sat at 10:00 AM and 4:30 PM. Staff snap each delivery invoice, or tap No deliveries, and the AI reads it.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
        <Stat label="Days not answered" value={gaps.length} color={gaps.length ? T.red : T.green} note={gaps.length ? gaps.slice(0, 4).map((g) => dayLabel(g.day)).join(", ") : "Every shop day has an answer"} />
        <Stat label="Invoices not in Tekmetric" value={notEntered.length} color={notEntered.length ? T.amber : T.green} note={notEntered.length ? "Mark each one once its tires are entered" : "All entered"} />
        <Stat label="Double uploads" value={dups.length} color={dups.length ? T.red : T.green} note={dups.length ? "Same invoice uploaded twice. Don't enter again." : "None found (checks invoice #, date, items, qty)"} />
        <Stat label="Texts go to" value={phones.length || (d.ownerPhoneFallback ? "Owner" : "Nobody")} color={phones.length || d.ownerPhoneFallback ? T.text : T.red}
          note={phones.length ? "phone" + (phones.length === 1 ? "" : "s") : d.ownerPhoneFallback ? "Your alert phone, until you add numbers below" : "Add a number below"} />
      </div>

      <div style={{ ...ui.card, marginBottom: 16 }}>
        <label style={ui.label}>Phones that get the texts (comma separated)</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={textTo} onChange={(e) => setTextTo(e.target.value)} placeholder="562-555-0123, 323-555-0199" style={{ ...ui.input, marginBottom: 0, flex: "1 1 260px" }} disabled={!d.isOwner} />
          <button style={ui.primary} disabled={!!busy || !d.isOwner} onClick={() => act("save", { action: "settings", textTo })}>{busy === "save" ? "Saving…" : "Save"}</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
          <button style={ui.btn} onClick={() => { navigator.clipboard?.writeText(d.link); }}><Icon name="link" size={18} />Copy upload link</button>
          <a style={ui.btn} href={d.link} target="_blank" rel="noreferrer"><Icon name="open_in_new" size={18} />Open upload page</a>
          <button style={ui.btn} disabled={!!busy || !(phones.length || d.ownerPhoneFallback)} onClick={async () => {
            const j = await act("text", { action: "text-now", slot: "pm" });
            if (j) alert(j.skipped || `Sent to ${j.sent} phone${j.sent === 1 ? "" : "s"}.${j.failed?.length ? `\nFailed: ${j.failed.join("; ")}` : ""}`);
          }}><Icon name="sms" size={18} />{busy === "text" ? "Sending…" : "Send the text now"}</button>
        </div>
      </div>

      <TekmetricFiles call={call} pending={notEntered.length} onDone={load} />

      <div style={{ ...ui.card, padding: 0 }}>
        {d.days.map((x) => {
          const n = x.uploads.length;
          const gap = due(x) && !x.status && x.day !== today;
          const pill = x.status === "none" ? ui.pill(T.textMuted)
            : n ? ui.pill(T.green) : gap ? ui.pill(T.red) : ui.pill(T.textFaint);
          const label = x.status === "none" ? "No deliveries" : n ? `${n} photo${n === 1 ? "" : "s"}` : x.day === today ? "Waiting" : isSunday(x.day) ? "Sunday" : x.day < START ? "Before check-ins" : "Not answered";
          const isOpen = open[x.day] ?? (n > 0 && x.uploads.some((u) => !u.entered_at));
          return (
            <div key={x.day} style={{ borderBottom: `1px solid ${T.border}` }}>
              <button onClick={() => n && setOpen((o) => ({ ...o, [x.day]: !isOpen }))} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 14px", background: "transparent", border: "none", cursor: n ? "pointer" : "default", fontFamily: "inherit", textAlign: "left", color: T.text }}>
                <span style={{ width: 120, fontWeight: 600, fontSize: 14 }}>{dayLabel(x.day)}</span>
                <span style={pill}>{label}</span>
                <span style={{ ...ui.muted, flex: 1 }}>{x.answered_by ? `${x.answered_by} · ${time(x.answered_at)}` : ""}</span>
                {n > 0 && <Icon name={isOpen ? "expand_less" : "expand_more"} style={{ color: T.textMuted }} />}
              </button>
              {isOpen && x.uploads.map((u) => <Upload key={u.id} u={u} busy={busy} act={act} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Tekmetric has no API here, so invoices go in through its spreadsheets (lib/tekmetric-bulk.js):
// export from Bulk Editor, drop it here, upload the two files we hand back, then mark the invoices entered.
function TekmetricFiles({ call, pending, onDone }) {
  const [busy, setBusy] = useState("");
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [fileName, setFileName] = useState("");

  async function onFile(file) {
    if (!file) return;
    setBusy("Reading the file…"); setErr(""); setRes(null); setFileName(file.name);
    try {
      const b64 = await new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = bad; r.readAsDataURL(file); });
      setRes(await call({ action: "tekmetric-files", file: b64 }));
    } catch (e) { setErr(e.message); } finally { setBusy(""); }
  }
  function save(b64, name) {
    const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bin], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function markEntered() {
    if (!confirm("Mark these invoices entered? Do this after both files are uploaded in Tekmetric.")) return;
    setBusy("Saving…");
    try { await call({ action: "mark-entered", ids: res.uploadIds }); setRes(null); onDone(); } catch (e) { alert(e.message); } finally { setBusy(""); }
  }

  const today = new Date().toISOString().slice(0, 10);
  const c = res?.counts;
  const step = { display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, color: T.text, marginBottom: 8 };
  const n = (i) => <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 11, background: T.blueSoft, color: T.blue, fontWeight: 600, fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i}</span>;
  const RESULT = { add: ["Add", T.green], remove: ["Take out", T.amber], new: ["New part", T.blue], check: ["Check", T.red], skip: ["Skip", T.textMuted] };

  return (
    <div style={{ ...ui.card, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Icon name="upload_file" size={20} style={{ color: T.blue }} />
        <b style={{ fontSize: 15 }}>Put invoices into Tekmetric</b>
        <span style={{ ...ui.muted, marginLeft: "auto" }}>{pending ? `${pending} invoice${pending === 1 ? "" : "s"} waiting` : "Nothing waiting"}</span>
      </div>
      <p style={{ ...ui.muted, margin: "0 0 12px" }}>No typing: Tekmetric exports a spreadsheet, this fills in the invoices, and you upload it back.</p>

      <div style={step}>{n(1)}<div>In Tekmetric: <b>Inventory → Bulk Editor → Download</b>. Drop that file here.</div></div>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: `1.5px dashed ${T.borderStrong}`, borderRadius: 8, padding: "14px", margin: "0 0 12px 32px", cursor: busy ? "wait" : "pointer", color: T.textMuted, fontSize: 13.5, background: T.page }}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
        <Icon name="description" size={20} />{busy || (fileName ? `${fileName} · drop a newer one to redo` : "Drop the Bulk Editor file (.xlsx), or click to choose")}
        <input type="file" accept=".xlsx" hidden onChange={(e) => { onFile(e.target.files[0]); e.target.value = ""; }} />
      </label>
      {err && <div style={{ color: T.red, fontSize: 13, margin: "0 0 12px 32px" }}>{err}</div>}

      {res && <>
        <div style={{ ...ui.muted, margin: "0 0 10px 32px" }}>
          <b style={{ color: T.text }}>{c.tiresIn} tires in, {c.tiresOut} out.</b> {c.parts} existing part{c.parts === 1 ? "" : "s"} change, {c.new} new part{c.new === 1 ? "" : "s"}.
          {c.check > 0 && <span style={{ color: T.red }}> {c.check} line{c.check === 1 ? "" : "s"} to enter by hand (marked Check).</span>}
        </div>
        <div style={step}>{n(2)}<div style={{ flex: 1 }}>
          Upload these in Tekmetric <b>right away</b> (the counts overwrite Tekmetric, so a sale in between would be undone):
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button style={ui.primary} disabled={!res.updateFile} onClick={() => save(res.updateFile, `Tekmetric update ${today}.xlsx`)}><Icon name="download" size={18} />Update file ({c.parts} parts)</button>
            <span style={{ ...ui.muted, alignSelf: "center" }}>→ Bulk Editor → Upload</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button style={ui.btn} disabled={!res.newFile} onClick={() => save(res.newFile, `Tekmetric new parts ${today}.xlsx`)}><Icon name="download" size={18} />New parts file ({c.new})</button>
            <span style={{ ...ui.muted, alignSelf: "center" }}>→ Add Parts → Bulk Upload</span>
          </div>
        </div></div>
        <div style={step}>{n(3)}<div>When Tekmetric shows both uploads done: <button style={{ ...ui.btn, marginLeft: 6 }} disabled={!!busy} onClick={markEntered}><Icon name="check" size={18} />Mark {res.uploadIds.length} invoice photo{res.uploadIds.length === 1 ? "" : "s"} entered</button></div></div>

        <details style={{ marginLeft: 32, marginTop: 6 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: T.blue }}>See every line ({res.lines.length})</summary>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginTop: 8 }}>
            <thead><tr>{["", "Qty", "Size", "Tire", "Invoice", "Tekmetric part", "Count", ""].map((h, i) => <th key={i} style={{ textAlign: "left", padding: "4px 6px", color: T.textMuted, fontWeight: 500, borderBottom: `1px solid ${T.border}` }}>{h}</th>)}</tr></thead>
            <tbody>
              {res.lines.map((l, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: "4px 6px" }}><span style={ui.pill(RESULT[l.result][1])}>{RESULT[l.result][0]}</span></td>
                  <td style={{ padding: "4px 6px", fontWeight: 600 }}>{l.kind === "return" ? "−" : ""}{l.qty}</td>
                  <td style={{ padding: "4px 6px" }}>{l.size}</td>
                  <td style={{ padding: "4px 6px" }}>{[l.brand, l.model].filter(Boolean).join(" ")}</td>
                  <td style={{ padding: "4px 6px", color: T.textMuted }}>{l.invoice_no}</td>
                  <td style={{ padding: "4px 6px", color: T.textMuted }}>{l.part || ""}</td>
                  <td style={{ padding: "4px 6px", whiteSpace: "nowrap" }}>{l.before != null ? `${l.before} → ${l.after}` : ""}</td>
                  <td style={{ padding: "4px 6px", color: l.result === "check" ? T.red : T.textMuted }}>{l.why || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </>}
    </div>
  );
}

function Stat({ label, value, color, note }) {
  return (
    <div style={ui.card}>
      <div style={{ ...ui.muted, fontSize: 12.5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color }}>{value}</div>
      <div style={{ ...ui.muted, fontSize: 12.5 }}>{note}</div>
    </div>
  );
}

function Upload({ u, busy, act }) {
  const r = u.read || {};
  const pdf = u.mime === "application/pdf";
  return (
    <div style={{ display: "flex", gap: 14, padding: "12px 14px 14px", background: T.page, borderTop: `1px solid ${T.border}`, flexWrap: "wrap" }}>
      <a href={u.url || "#"} target="_blank" rel="noreferrer" style={{ flexShrink: 0, width: 120, height: 150, borderRadius: 6, border: `1px solid ${T.border}`, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", color: T.textMuted, textDecoration: "none" }}>
        {pdf || !u.url ? <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontSize: 12 }}><Icon name="picture_as_pdf" size={32} />Open</span>
          : <img src={u.url} alt="Invoice" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      </a>
      <div style={{ flex: "1 1 420px", minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
          <b style={{ fontSize: 15 }}>{r.vendor || (u.read_error ? "Couldn't read" : u.read ? "Unknown vendor" : "Not read yet")}</b>
          {r.invoice_no && <span style={ui.muted}>#{r.invoice_no}</span>}
          {r.invoice_date && <span style={ui.muted}>{r.invoice_date}</span>}
          {r.page && <span style={ui.muted}>page {r.page}</span>}
          {r.is_invoice === false && <span style={ui.pill(T.amber)}>Not an invoice?</span>}
          <span style={{ ...ui.muted, marginLeft: "auto" }}>{u.uploaded_by || "Someone"} · {time(u.created_at)}</span>
        </div>
        {u.duplicate && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 6, padding: "8px 10px", fontSize: 13, marginBottom: 8 }}>
            <Icon name="content_copy" size={18} />
            <div><b>Double upload.</b> {u.duplicate.reason}. First uploaded {dayLabel(u.duplicate.day)}{u.duplicate.by ? ` by ${u.duplicate.by}` : ""}. Don't enter these tires again.</div>
          </div>
        )}
        {u.read_error && <div style={{ color: T.red, fontSize: 13, marginBottom: 6 }}>{u.read_error}</div>}
        {r.items?.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 6, background: "#fff" }}>
            <thead><tr>{["Qty", "Size", "Tire", "Part #", "Cost ea"].map((h, i) => <th key={h} style={{ textAlign: i === 0 || i === 4 ? "right" : "left", padding: "4px 6px", color: T.textMuted, fontWeight: 500, borderBottom: `1px solid ${T.border}` }}>{h}</th>)}</tr></thead>
            <tbody>
              {r.items.map((it, i) => (
                <tr key={i}>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{it.qty ?? "?"}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{it.size || "?"}</td>
                  <td style={td}>{[it.brand, it.model].filter(Boolean).join(" ")}</td>
                  <td style={{ ...td, color: T.textMuted }}>{it.part_no || ""}</td>
                  <td style={{ ...td, textAlign: "right" }}>{money(it.unit_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ ...ui.muted, marginBottom: 8 }}>
          {r.tire_count != null && <b style={{ color: T.text }}>{r.tire_count} tires</b>}{r.total != null && <> · total {money(r.total)}</>}
          {r.notes && <div style={{ marginTop: 2 }}>{r.notes}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {u.entered_at
            ? <><span style={ui.pill(T.green)}><Icon name="check" size={16} />In Tekmetric · {u.entered_by} · {time(u.entered_at)}</span>
                <button style={{ ...ui.btn, height: 28 }} disabled={!!busy} onClick={() => act(`e${u.id}`, { action: "entered", id: u.id, undo: true })}>Undo</button></>
            : u.duplicate ? <span style={ui.pill(T.red)}>Duplicate · don't enter</span>
            : <button style={ui.primary} disabled={!!busy} onClick={() => act(`e${u.id}`, { action: "entered", id: u.id })}><Icon name="check" size={18} />Mark entered in Tekmetric</button>}
          <button style={ui.btn} disabled={!!busy} onClick={() => act(`r${u.id}`, { action: "reread", id: u.id })}><Icon name="refresh" size={18} />{busy === `r${u.id}` ? "Reading…" : "Read again"}</button>
        </div>
      </div>
    </div>
  );
}

const td = { padding: "4px 6px", borderBottom: `1px solid ${T.border}` };
