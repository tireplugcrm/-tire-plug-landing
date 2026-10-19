// Admin → Texts: one inbox for the shop's texting number (562-250-3737). Every conversation by
// phone, newest first, including people who aren't a lead yet. Pick one to read it and reply;
// "New text" starts a conversation with any number. Refreshes on its own every 20 seconds.
// The owner also gets "Import from GHL": copies the last 30 days of texts that only exist in
// GoHighLevel (from before the hookup). It checks first, asks, and never sends anything.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { T, Icon, ui } from "./ui.js";

const TZ = "America/Los_Angeles";
const fmtPhone = (p) => (p && p.length === 10 ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p || "");
function when(iso) {
  const d = new Date(iso);
  const sameDay = d.toLocaleDateString("en-US", { timeZone: TZ }) === new Date().toLocaleDateString("en-US", { timeZone: TZ });
  return sameDay
    ? d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" });
}

export default function TextsTab({ auth, onOpenLead }) {
  const [threads, setThreads] = useState(null);
  const [phone, setPhone] = useState(null);
  const [thread, setThread] = useState(null);
  const [draft, setDraft] = useState("");
  const [newNum, setNewNum] = useState("");
  const [composing, setComposing] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const endRef = useRef(null);

  const call = useCallback(async (payload) => {
    const r = await fetch("/api/admin/texts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...payload }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Something went wrong.");
    return d;
  }, [auth]);

  const loadList = useCallback(async () => {
    try { const d = await call({ action: "list" }); setThreads(d.threads); setIsOwner(!!d.isOwner); } catch (e) { setErr(e.message); }
  }, [call]);

  const loadThread = useCallback(async (p) => {
    try { setThread(await call({ action: "thread", phone: p })); } catch (e) { setErr(e.message); }
  }, [call]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => {
    const t = setInterval(() => { loadList(); if (phone) loadThread(phone); }, 20000);
    return () => clearInterval(t);
  }, [loadList, loadThread, phone]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [thread]);

  function open(p) {
    setPhone(p); setThread(null); setDraft(""); setErr(""); setComposing(false);
    loadThread(p);
    setThreads((ts) => ts && ts.map((t) => (t.phone === p ? { ...t, unread: 0 } : t)));
  }

  function startNew(e) {
    e.preventDefault();
    const p = newNum.replace(/\D/g, "").slice(-10);
    if (p.length !== 10) { setErr("Enter a 10-digit phone number."); return; }
    setNewNum(""); open(p);
  }

  async function send(e) {
    e.preventDefault();
    if (!draft.trim() || !phone) return;
    setSending(true); setErr("");
    const body = draft;
    setDraft("");
    try { await call({ action: "send", phone, body }); await loadThread(phone); loadList(); }
    catch (e2) { setErr(e2.message); setDraft(body); }
    finally { setSending(false); }
  }

  async function importGhl() {
    setImporting(true); setImportMsg("Checking GHL…");
    try {
      const dry = await call({ action: "ghl-import", dryRun: true });
      if (!dry.added) { setImportMsg("Nothing new in GHL. Everything from the last 30 days is already here."); return; }
      if (!window.confirm(`Copy ${dry.added} text${dry.added === 1 ? "" : "s"} from ${dry.conversations} GHL conversations (last 30 days) into this inbox? ${dry.unread} unread. Nothing gets sent.`)) { setImportMsg(""); return; }
      setImportMsg("Importing…");
      const d = await call({ action: "ghl-import" });
      setImportMsg(`Imported ${d.added} text${d.added === 1 ? "" : "s"} (${d.unread} unread).`);
      loadList();
    } catch (e) { setImportMsg(e.message); }
    finally { setImporting(false); }
  }

  const unreadTotal = (threads || []).reduce((n, t) => n + t.unread, 0);
  const current = (threads || []).find((t) => t.phone === phone);
  const title = thread?.lead?.name || current?.name || fmtPhone(phone);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h1 style={ui.h1}>Texts</h1>
          <div style={ui.muted}>Every text to and from (562) 250-3737{unreadTotal ? ` · ${unreadTotal} unread` : ""}</div>
          {importMsg && <div style={{ ...ui.muted, marginTop: 4 }}>{importMsg}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {isOwner && (
          <button type="button" style={{ ...ui.btn, opacity: importing ? 0.6 : 1 }} disabled={importing} onClick={importGhl}>
            <Icon name="download" size={18} /> {importing ? "Importing…" : "Import from GHL"}
          </button>
        )}
        <button type="button" style={ui.primary} onClick={() => { setComposing(true); setPhone(null); setThread(null); setErr(""); }}>
          <Icon name="edit_square" size={18} /> New text
        </button>
        </div>
      </div>

      <div className="tx-grid">
        <div className={`tx-list${phone || composing ? " tx-hide-sm" : ""}`} style={{ ...ui.card, padding: 0, overflow: "hidden" }}>
          {threads === null && <div style={{ ...ui.muted, padding: 16 }}>Loading…</div>}
          {threads && !threads.length && <div style={{ ...ui.muted, padding: 16 }}>No texts yet.</div>}
          {(threads || []).map((t) => {
            const active = t.phone === phone;
            return (
              <button key={t.phone} type="button" onClick={() => open(t.phone)} className="tx-row"
                style={{ display: "block", width: "100%", textAlign: "left", background: active ? T.blueSoft : T.surface, border: "none", borderBottom: `1px solid ${T.border}`, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontWeight: t.unread ? 700 : 600, color: T.text, fontSize: 14 }}>{t.name || fmtPhone(t.phone)}</span>
                  <span style={{ color: T.textFaint, fontSize: 12, whiteSpace: "nowrap" }}>{when(t.last_at)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 2 }}>
                  <span style={{ color: t.unread ? T.text : T.textMuted, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.last_dir === "outbound" ? "You: " : ""}{t.last}
                  </span>
                  {t.unread > 0 && <span style={{ background: T.blue, color: "#fff", borderRadius: 10, fontSize: 11, fontWeight: 700, padding: "1px 7px" }}>{t.unread}</span>}
                </div>
                {t.name && <div style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>{fmtPhone(t.phone)}</div>}
              </button>
            );
          })}
        </div>

        <div className={`tx-pane${phone || composing ? "" : " tx-hide-sm"}`} style={{ ...ui.card, display: "flex", flexDirection: "column", minHeight: 460, padding: 0 }}>
          {!phone && !composing && <div style={{ ...ui.muted, margin: "auto", padding: 24 }}>Pick a conversation, or start a new text.</div>}

          {composing && !phone && (
            <form onSubmit={startNew} style={{ padding: 16 }}>
              <button type="button" className="tx-back" style={{ ...ui.btn, marginBottom: 12 }} onClick={() => setComposing(false)}><Icon name="arrow_back" size={18} /> Back</button>
              <label style={ui.label} htmlFor="tx-new">Phone number</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input id="tx-new" style={{ ...ui.input, marginBottom: 0 }} inputMode="tel" placeholder="(562) 555-1234" value={newNum} onChange={(e) => setNewNum(e.target.value)} autoFocus />
                <button type="submit" style={ui.primary}>Next</button>
              </div>
              {err && <div style={{ color: T.red, fontSize: 13, marginTop: 8 }}>{err}</div>}
            </form>
          )}

          {phone && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
                <button type="button" className="tx-back" style={{ ...ui.btn, padding: "0 8px" }} onClick={() => setPhone(null)} aria-label="Back to conversations"><Icon name="arrow_back" size={18} /></button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: T.text }}>{title}</div>
                  {title !== fmtPhone(phone) && <div style={{ color: T.textMuted, fontSize: 12 }}>{fmtPhone(phone)}</div>}
                </div>
                {thread?.lead && onOpenLead && (
                  <button type="button" style={ui.btn} onClick={() => onOpenLead(thread.lead.id)}><Icon name="person" size={18} /> Open lead</button>
                )}
                <a href={`tel:${phone}`} style={ui.btn}><Icon name="call" size={18} /> Call</a>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: 14, background: T.page, maxHeight: 520 }}>
                {thread === null && <div style={ui.muted}>Loading…</div>}
                {thread && !thread.messages.length && <div style={ui.muted}>No messages yet. Write the first one below.</div>}
                {(thread?.messages || []).map((m) => {
                  const out = m.direction === "outbound";
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: out ? "flex-end" : "flex-start", marginBottom: 8 }}>
                      <div style={{ maxWidth: "78%", background: out ? T.blue : T.surface, color: out ? "#fff" : T.text, border: out ? "none" : `1px solid ${T.border}`, borderRadius: 12, padding: "8px 12px", fontSize: 14, lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {m.body}
                        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: "right" }}>{when(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <form onSubmit={send} style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${T.border}` }}>
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="Type a text…"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); } }}
                  style={{ ...ui.input, height: "auto", minHeight: 44, padding: "0.5rem 0.75rem", marginBottom: 0, resize: "vertical" }} />
                <button type="submit" style={{ ...ui.primary, alignSelf: "flex-end", opacity: sending || !draft.trim() ? 0.6 : 1 }} disabled={sending || !draft.trim()}>
                  <Icon name="send" size={18} /> {sending ? "Sending…" : "Send"}
                </button>
              </form>
              {err && <div style={{ color: T.red, fontSize: 13, padding: "0 12px 10px" }}>{err}</div>}
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .tx-grid { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 14px; align-items: start; }
        .tx-list { max-height: 640px; overflow-y: auto; }
        .tx-back { display: none !important; }
        @media (max-width: 800px) {
          .tx-grid { grid-template-columns: 1fr; }
          .tx-hide-sm { display: none !important; }
          .tx-back { display: inline-flex !important; }
        }
      `}</style>
    </div>
  );
}
