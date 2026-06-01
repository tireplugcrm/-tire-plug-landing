import React, { useState, useEffect } from "react";
import Head from "next/head";
import { supabaseBrowser } from "../../lib/supabaseBrowser.js";

/* ============================================================
   The Tire Plug — Owner Admin Hub
   Tabs: Leads · Subscribers · Email · Replies · Hiring
   ============================================================ */

export default function AdminHub() {
  const [password, setPassword] = useState("");
  const [accessToken, setAccessToken] = useState(null);
  const [googleEmail, setGoogleEmail] = useState("");
  const [authed, setAuthed] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("leads");
  const [data, setData] = useState({ leads: [], subscribers: [], campaigns: [], replies: [], reminders: [], unreadByLead: {}, team: [], me: null });
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  const authObj = () => (accessToken ? { accessToken } : { password });

  async function loadWith(a) {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Login failed"); setAuthed(false); return; }
      if (a.password) sessionStorage.setItem("admin_pw", a.password);
      setData({ leads: d.leads || [], subscribers: d.subscribers || [], campaigns: d.campaigns || [], replies: d.replies || [], reminders: d.reminders || [], unreadByLead: d.unreadByLead || {}, team: d.team || [], me: d.me || null });
      setAuthed(true); setNeedsCode(false);
    } catch (e) { setError("Network error"); }
    finally { setLoading(false); }
  }

  async function handleGoogleSession(token, email) {
    setAccessToken(token); if (email) setGoogleEmail(email); setError("");
    try {
      const res = await fetch("/api/admin/request-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken: token }) });
      const d = await res.json();
      if (d.status === "approved") loadWith({ accessToken: token });
      else if (d.status === "pending") setNeedsCode(true);
      else setError(d.error || "Access error");
    } catch (e) { setError("Network error"); }
  }

  useEffect(() => {
    const savedPw = typeof window !== "undefined" ? (sessionStorage.getItem("admin_pw") || sessionStorage.getItem("careers_pw")) : "";
    if (supabaseBrowser) {
      supabaseBrowser.auth.getSession().then(({ data: s }) => {
        const token = s?.session?.access_token;
        if (token) handleGoogleSession(token, s.session.user?.email || "");
        else if (savedPw) { setPassword(savedPw); loadWith({ password: savedPw }); }
      });
      const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_e, session) => {
        if (session?.access_token) handleGoogleSession(session.access_token, session.user?.email || "");
      });
      return () => { try { sub?.subscription?.unsubscribe(); } catch (e) {} };
    } else if (savedPw) { setPassword(savedPw); loadWith({ password: savedPw }); }
    // eslint-disable-next-line
  }, []);

  // Presence heartbeat for Google users.
  useEffect(() => {
    if (!authed || !accessToken) return;
    const id = setInterval(() => {
      fetch("/api/admin/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken }) });
    }, 30000);
    return () => clearInterval(id);
  }, [authed, accessToken]);

  async function update(table, id, patch) {
    let finalPatch = patch;
    if (table === "leads" && patch.status === "booked") finalPatch = { booked_at: new Date().toISOString(), ...patch };
    const key = table === "email_replies" ? "replies" : table;
    setData((d) => ({ ...d, [key]: d[key].map((r) => (r.id === id ? { ...r, ...finalPatch } : r)) }));
    try {
      const res = await fetch("/api/admin/update-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...authObj(), table, id, ...finalPatch }) });
      if (!res.ok) loadWith(authObj());
    } catch (e) { loadWith(authObj()); }
  }

  async function reminderAction(payload) {
    await fetch("/api/admin/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...authObj(), ...payload }) });
    loadWith(authObj());
  }

  async function revoke(email, action) {
    await fetch("/api/admin/revoke", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...authObj(), email, action }) });
    loadWith(authObj());
  }

  function signInGoogle() {
    if (!supabaseBrowser) { setError("Google sign-in isn't configured yet."); return; }
    supabaseBrowser.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/admin" } });
  }

  async function signOut() {
    try { await supabaseBrowser?.auth.signOut(); } catch (e) {}
    sessionStorage.removeItem("admin_pw");
    setAccessToken(null); setAuthed(false); setNeedsCode(false); setPassword(""); setGoogleEmail("");
  }

  async function verifyCode() {
    setCodeError("");
    try {
      const res = await fetch("/api/admin/verify-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken, code: codeInput }) });
      const d = await res.json();
      if (d.status === "approved") { setCodeInput(""); loadWith({ accessToken }); }
      else setCodeError(d.error || "Invalid code");
    } catch (e) { setCodeError("Network error"); }
  }

  // Signed in with Google, waiting for the owner's code
  if (needsCode && !authed) {
    return (
      <Shell title="Tire Plug Admin">
        <div style={{ maxWidth: 380, margin: "12vh auto 0", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.25rem" }}><Logo size={72} /></div>
          <h1 style={{ color: "#fff", fontWeight: 900, textTransform: "uppercase", fontSize: "1.3rem", marginBottom: "0.5rem" }}>Access <span style={{ color: "#FF1F1F" }}>Code</span></h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", lineHeight: 1.5, marginBottom: "1.5rem" }}>
            The owner was notified that you're requesting access{googleEmail ? ` as ${googleEmail}` : ""}. Enter the code they give you.
          </p>
          <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && verifyCode()} placeholder="6-digit code" inputMode="numeric" style={{ ...inp, textAlign: "center", letterSpacing: "0.3em", fontSize: "1.2rem" }} />
          <button onClick={verifyCode} style={cta}>Unlock</button>
          {codeError && <p style={{ color: "#FF6666", marginTop: "1rem", fontSize: "0.85rem" }}>{codeError}</p>}
          <button onClick={signOut} style={{ ...ghostBtn, marginTop: "1.5rem", fontSize: "0.75rem" }}>Cancel / sign out</button>
        </div>
      </Shell>
    );
  }

  if (!authed) {
    return (
      <Shell title="Tire Plug Admin">
        <div style={{ maxWidth: 360, margin: "12vh auto 0" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
            <Logo size={88} />
          </div>
          <h1 style={{ color: "#fff", textAlign: "center", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", marginBottom: "1.5rem", fontSize: "1.5rem" }}>
            Tire Plug <span style={{ color: "#FF1F1F" }}>Admin</span>
          </h1>
          <button onClick={signInGoogle} style={googleBtn}>
            <span style={{ fontWeight: 900, color: "#4285F4" }}>G</span> Sign in with Google
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.25rem 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} /><span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.7rem" }}>OR</span><div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
          </div>
          <input type="password" placeholder="Owner password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadWith({ password })} style={inp} />
          <button onClick={() => loadWith({ password })} disabled={loading} style={cta}>
            {loading ? "..." : "Enter"}
          </button>
          {error && <p style={{ color: "#FF6666", textAlign: "center", marginTop: "1rem", fontSize: "0.85rem" }}>{error}</p>}
        </div>
      </Shell>
    );
  }

  const unreadReplies = data.replies.filter((r) => !r.read).length;
  const liveLeads = data.leads.filter((l) => l.status !== "dead");
  const dueCount = data.reminders.filter((r) => isDueOrOverdue(r.due_at)).length;
  const tabs = [
    { id: "leads", label: "Leads", count: liveLeads.length },
    { id: "subscribers", label: "Subscribers", count: data.subscribers.length },
    { id: "email", label: "Email" },
    { id: "replies", label: "Replies", count: unreadReplies || null, alert: unreadReplies > 0 },
    { id: "hiring", label: "Hiring" },
  ];

  const selectedLead = data.leads.find((l) => l.id === selectedLeadId) || null;
  const auth = authObj();

  return (
    <Shell title="Tire Plug Admin">
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <Logo size={44} />
            <h1 style={{ color: "#fff", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", fontSize: "1.4rem", margin: 0 }}>
              Tire Plug <span style={{ color: "#FF1F1F" }}>Admin</span>
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {data.me && data.me.email !== "owner" && <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>{data.me.name}</span>}
            <button onClick={() => loadWith(authObj())} style={ghostBtn}>↻</button>
            <button onClick={signOut} style={ghostBtn}>Sign out</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.4rem", marginBottom: "2rem", flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.75rem" }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={tabBtn(tab === t.id)}>
              {t.label}
              {t.count != null && (
                <span style={{ marginLeft: 6, background: t.alert ? "#FF1F1F" : "rgba(255,255,255,0.12)", color: "#fff", fontSize: "0.65rem", fontWeight: 800, padding: "0.1rem 0.45rem", borderRadius: 50 }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {tab === "leads" && (
          <LeadsTab data={data} dueCount={dueCount} onOpen={setSelectedLeadId} onReminder={reminderAction} onRevoke={revoke} />
        )}
        {tab === "subscribers" && <SubscribersTab subs={data.subscribers} onUpdate={update} />}
        {tab === "email" && <EmailTab auth={auth} leads={data.leads} subs={data.subscribers} campaigns={data.campaigns} />}
        {tab === "replies" && <RepliesTab replies={data.replies} onUpdate={update} />}
        {tab === "hiring" && <HiringTab />}
      </div>

      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          auth={auth}
          reminders={data.reminders.filter((r) => r.lead_id === selectedLead.id)}
          onClose={() => setSelectedLeadId(null)}
          onUpdate={update}
          onReminder={reminderAction}
        />
      )}
    </Shell>
  );
}

/* ---------------- LEADS ---------------- */
const PRIORITY = {
  HOT: { rank: 0, color: "#FF3838", label: "🔴 HOT" },
  WARM: { rank: 1, color: "#FFB800", label: "🟡 WARM" },
  SHOPPING: { rank: 2, color: "rgba(255,255,255,0.55)", label: "⚪ Shopping" },
};
function prio(l) { return PRIORITY[l.lead_priority] || { rank: 3, color: "rgba(255,255,255,0.5)", label: l.lead_priority || "—" }; }
const STATUS_LABEL = { new: "New", called: "Called", booked: "✓ Booked", dead: "Dead" };

function LeadsTab({ data, dueCount, onOpen, onReminder, onRevoke }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const leadById = Object.fromEntries(data.leads.map((l) => [l.id, l]));
  const due = data.reminders.filter((r) => isDueOrOverdue(r.due_at));
  const followupLeadIds = new Set(data.reminders.filter((r) => isDueOrOverdue(r.due_at)).map((r) => r.lead_id));

  // Revenue this month
  const monthLeads = data.leads.filter((l) => l.revenue_amount && isThisMonth(l.booked_at || l.created_at));
  const revenue = monthLeads.reduce((s, l) => s + Number(l.revenue_amount || 0), 0);

  let live = data.leads.filter((l) => l.status !== "dead");
  if (q.trim()) {
    const t = q.toLowerCase();
    live = live.filter((l) => `${l.name} ${l.phone} ${l.email} ${l.service} ${l.vehicle}`.toLowerCase().includes(t));
  }
  if (filter === "hot") live = live.filter((l) => l.lead_priority === "HOT");
  if (filter === "new") live = live.filter((l) => l.status === "new");
  if (filter === "followup") live = live.filter((l) => followupLeadIds.has(l.id));
  live = live.sort((a, b) => prio(a).rank - prio(b).rank || new Date(b.created_at) - new Date(a.created_at));

  const dead = data.leads.filter((l) => l.status === "dead");
  const chips = [
    { id: "all", label: "All" },
    { id: "hot", label: "🔴 Hot" },
    { id: "new", label: "New" },
    { id: "followup", label: `Needs follow-up${dueCount ? ` (${dueCount})` : ""}` },
  ];

  return (
    <>
      {/* Recently Active team board */}
      <ActiveBoard team={data.team} me={data.me} onRevoke={onRevoke} />

      {/* Revenue summary */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <div style={{ background: "linear-gradient(135deg, rgba(61,214,140,0.12), rgba(0,0,0,0))", border: "1px solid rgba(61,214,140,0.3)", borderRadius: 14, padding: "0.85rem 1.25rem", flex: 1, minWidth: 200 }}>
          <div style={{ color: "#3DD68C", fontWeight: 900, fontSize: "1.6rem", lineHeight: 1 }}>${revenue.toLocaleString()}</div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>From web leads this month · {monthLeads.length} booked</div>
        </div>
      </div>

      {/* Due reminders */}
      {due.length > 0 && (
        <div style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.3)", borderRadius: 14, padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
          <p style={{ color: "#FFB800", fontWeight: 800, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.6rem" }}>⏰ Follow-ups due ({due.length})</p>
          {due.map((r) => {
            const l = leadById[r.lead_id];
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.4rem 0" }}>
                <span style={{ fontSize: "0.85rem" }}>{r.kind === "service_ready" ? "🛞" : "📞"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span onClick={() => l && onOpen(l.id)} style={{ color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: "0.88rem" }}>{l ? l.name : "(lead)"}</span>
                  <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.82rem" }}> — {r.note || (r.kind === "service_ready" ? "Tires are in" : "Follow up")} · {dueLabel(r.due_at)}</span>
                </div>
                <button onClick={() => onReminder({ action: "complete", id: r.id })} style={{ ...ghostBtn, fontSize: "0.7rem", padding: "0.35rem 0.65rem" }}>Done</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Search + filters */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Search name, phone, service..." style={{ ...inp, marginBottom: 0, flex: 1, minWidth: 220 }} />
        {chips.map((c) => (
          <button key={c.id} onClick={() => setFilter(c.id)} style={{ ...ghostBtn, fontSize: "0.72rem", padding: "0.55rem 0.8rem", background: filter === c.id ? "rgba(255,31,31,0.18)" : "rgba(255,255,255,0.05)", borderColor: filter === c.id ? "#FF1F1F" : "rgba(255,255,255,0.12)", color: filter === c.id ? "#FF6666" : "#fff" }}>{c.label}</button>
        ))}
      </div>

      {live.length === 0 && <Empty>No leads here yet. When someone completes the booking form on <strong style={{ color: "#FF3838" }}>tireplugla.com</strong>, they show up here.</Empty>}
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {live.map((l) => <LeadRow key={l.id} l={l} unread={data.unreadByLead[l.id]} onClick={() => onOpen(l.id)} />)}
      </div>

      {filter === "all" && !q && dead.length > 0 && (
        <>
          <h2 style={subHead}>Dead leads ({dead.length})</h2>
          <div style={{ display: "grid", gap: "0.5rem", opacity: 0.5 }}>
            {dead.map((l) => <LeadRow key={l.id} l={l} unread={data.unreadByLead[l.id]} onClick={() => onOpen(l.id)} />)}
          </div>
        </>
      )}
    </>
  );
}

function LeadRow({ l, unread, onClick }) {
  const p = prio(l);
  return (
    <div onClick={onClick} style={{ ...rowStyle, cursor: "pointer" }} className="adminRow">
      <div style={{ width: 90 }}>
        <span style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${p.color}`, color: p.color, fontSize: "0.62rem", fontWeight: 800, padding: "0.25rem 0.5rem", borderRadius: 50, whiteSpace: "nowrap" }}>{p.label}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#fff", fontWeight: 700 }}>
          {l.name || "(no name)"} <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 500, fontSize: "0.8rem" }}>· {STATUS_LABEL[l.status] || l.status}</span>
          {unread > 0 && <span style={{ marginLeft: 6, background: "#FF1F1F", color: "#fff", fontSize: "0.6rem", fontWeight: 800, padding: "0.1rem 0.4rem", borderRadius: 50 }}>💬 {unread}</span>}
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.service || "—"}{l.vehicle ? ` · ${l.vehicle}` : ""}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ color: "#FF3838", fontSize: "0.82rem", fontWeight: 700 }}>{l.phone || "—"}</div>
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.68rem" }}>{fmtDate(l.created_at)}</div>
      </div>
      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "1.2rem" }}>›</span>
    </div>
  );
}

/* ---------------- LEAD DRAWER ---------------- */
function LeadDrawer({ lead, auth, reminders, onClose, onUpdate, onReminder }) {
  const [notes, setNotes] = useState(lead.owner_notes || "");
  const [revenue, setRevenue] = useState(lead.revenue_amount || "");
  const [draftText, setDraftText] = useState("");
  const [draftKind, setDraftKind] = useState(null); // 'quote' arms follow-ups on send
  const p = prio(lead);
  const statuses = ["new", "called", "booked", "dead"];
  const fillQuote = (t) => { setDraftText(t); setDraftKind("quote"); };

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={drawer}>
        <button onClick={onClose} style={closeBtn}>✕</button>
        <span style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${p.color}`, color: p.color, fontSize: "0.65rem", fontWeight: 800, padding: "0.25rem 0.6rem", borderRadius: 50 }}>{p.label}</span>
        <h2 style={{ color: "#fff", fontWeight: 900, fontSize: "1.5rem", margin: "0.75rem 0 0.25rem" }}>{lead.name || "(no name)"}</h2>
        <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: "1.25rem", fontSize: "0.9rem" }}>{fmtDate(lead.created_at, true)} · via {lead.source || "website"}</p>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {lead.phone && <a href={`tel:${lead.phone}`} style={cta}>📞 Call {lead.phone}</a>}
          {lead.email && <a href={`mailto:${lead.email}`} style={ghostBtn}>✉ Email</a>}
        </div>

        {/* Status (instant) */}
        <Section title="Status">
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {statuses.map((s) => (
              <button key={s} onClick={() => onUpdate("leads", lead.id, { status: s })}
                style={{ ...ghostBtn, background: lead.status === s ? "rgba(255,31,31,0.18)" : "rgba(255,255,255,0.05)", borderColor: lead.status === s ? "#FF1F1F" : "rgba(255,255,255,0.12)", color: lead.status === s ? "#FF6666" : "#fff" }}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {lead.status === "booked" && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.75rem" }}>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" }}>💵 Sale amount $</span>
              <input value={revenue} onChange={(e) => setRevenue(e.target.value)} onBlur={() => onUpdate("leads", lead.id, { revenue_amount: revenue })}
                placeholder="0" inputMode="decimal" style={{ ...inp, marginBottom: 0, width: 120, padding: "0.5rem 0.75rem" }} />
            </div>
          )}
        </Section>

        {/* Quote builder */}
        <QuoteBuilder lead={lead} auth={auth} onUpdate={onUpdate} onAiDraft={fillQuote} />

        {/* SMS conversation */}
        <Conversation lead={lead} auth={auth} draft={draftText} setDraft={setDraftText} draftKind={draftKind} setDraftKind={setDraftKind} />

        {/* Reminders */}
        <RemindersBlock lead={lead} reminders={reminders} onReminder={onReminder} />

        {/* Request details */}
        <Section title="Request">
          <KV k="Service" v={lead.service} />
          <KV k="When" v={lead.service_timing} />
          <KV k="Vehicle" v={lead.vehicle} />
          <KV k="Tire size" v={lead.tire_size} />
          <KV k="Tire type" v={lead.tire_type} />
          <KV k="Email" v={lead.email} />
        </Section>

        {/* Notes */}
        <Section title="Your notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} placeholder="Notes from the call..." />
          <button onClick={() => onUpdate("leads", lead.id, { owner_notes: notes })} style={cta}>Save notes</button>
        </Section>
      </div>
    </div>
  );
}

/* ---------------- QUOTE BUILDER ---------------- */
function QuoteBuilder({ lead, auth, onUpdate, onAiDraft }) {
  const [rows, setRows] = useState(lead.quotes && lead.quotes.length ? lead.quotes : [{ brand: "", price: "", qty: 4, warranty: "" }]);
  const [roadHazard, setRoadHazard] = useState(lead.road_hazard_per_tire || "");
  const [writing, setWriting] = useState(false);
  const [msg, setMsg] = useState("");

  function setRow(i, field, val) { setRows(rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r))); }
  function addRow() { setRows([...rows, { brand: "", price: "", qty: 4, warranty: "" }]); }
  function removeRow(i) { setRows(rows.filter((_, idx) => idx !== i)); }
  function save() { onUpdate("leads", lead.id, { quotes: rows.filter((r) => r.brand || r.price), road_hazard_per_tire: roadHazard }); setMsg("Quote saved ✓"); setTimeout(() => setMsg(""), 1500); }

  const grand = rows.reduce((s, r) => s + (Number(r.price) || 0) * (Number(r.qty) || 0), 0);
  const hasQuote = rows.some((r) => r.brand && r.price);

  // Fallback message if the AI is unavailable — plain, deterministic.
  function buildText() {
    const lines = rows.filter((r) => r.brand && r.price).map((r) => {
      const tot = (Number(r.price) || 0) * (Number(r.qty) || 0);
      return `${r.brand} - $${r.price} each${r.qty ? ` (set of ${r.qty} = $${tot})` : ""}${r.warranty ? ` — ${r.warranty} warranty` : ""}`;
    });
    return `Hi ${lead.name?.split(" ")[0] || "there"}, here's your tire quote from The Tire Plug:\n\n${lines.join("\n")}\n\nText or call 562-513-0217 to lock it in!`;
  }

  // Save + have the AI write the quote message into the text box below for review.
  async function writeWithAi() {
    setWriting(true); setMsg("");
    onUpdate("leads", lead.id, { quotes: rows.filter((r) => r.brand || r.price), road_hazard_per_tire: roadHazard });
    try {
      const res = await fetch("/api/admin/ai-compose", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...auth, lead_id: lead.id, mode: "quote", quotes: rows, road_hazard: roadHazard }),
      });
      const d = await res.json();
      if (res.ok && d.draft) { onAiDraft(d.draft); setMsg("✨ Drafted below — review & send"); }
      else { onAiDraft(buildText()); setMsg("AI busy — used a basic draft below"); }
    } catch (e) { onAiDraft(buildText()); setMsg("AI busy — used a basic draft below"); }
    finally { setWriting(false); setTimeout(() => setMsg(""), 3000); }
  }

  return (
    <Section title="Quote">
      <div style={{ display: "grid", gap: "0.4rem", marginBottom: "0.6rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 50px 70px 24px", gap: "0.4rem", fontSize: "0.62rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 0.2rem" }}>
          <span>Brand</span><span>$ Each</span><span>Qty</span><span>Total</span><span></span>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ marginBottom: "0.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 50px 70px 24px", gap: "0.4rem", alignItems: "center" }}>
              <input value={r.brand} onChange={(e) => setRow(i, "brand", e.target.value)} placeholder="Goodyear" style={miniInp} />
              <input value={r.price} onChange={(e) => setRow(i, "price", e.target.value)} placeholder="159" inputMode="decimal" style={miniInp} />
              <input value={r.qty} onChange={(e) => setRow(i, "qty", e.target.value)} inputMode="numeric" style={miniInp} />
              <span style={{ color: "#3DD68C", fontWeight: 700, fontSize: "0.82rem" }}>${((Number(r.price) || 0) * (Number(r.qty) || 0)).toLocaleString()}</span>
              <button onClick={() => removeRow(i)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "1rem" }}>×</button>
            </div>
            <input value={r.warranty || ""} onChange={(e) => setRow(i, "warranty", e.target.value)} placeholder="Warranty (e.g. 60,000 mi)" style={{ ...miniInp, marginTop: "0.35rem" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <button onClick={addRow} style={{ ...ghostBtn, fontSize: "0.72rem", padding: "0.4rem 0.7rem" }}>+ Add brand</button>
        {grand > 0 && <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem" }}>Top total: <strong style={{ color: "#3DD68C" }}>${grand.toLocaleString()}</strong></span>}
      </div>

      {/* Optional Road Hazard Warranty add-on */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "0.5rem 0.7rem" }}>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.78rem", flex: 1 }}>🛡️ Road Hazard Warranty</span>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem" }}>$</span>
        <input value={roadHazard} onChange={(e) => setRoadHazard(e.target.value)} placeholder="0" inputMode="decimal" style={{ ...miniInp, width: 70 }} />
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem" }}>/ tire</span>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={save} style={ghostBtn}>Save quote</button>
        {lead.phone && <button onClick={writeWithAi} disabled={writing || !hasQuote} style={{ ...cta, opacity: !hasQuote ? 0.4 : 1 }}>{writing ? "✨ Writing..." : "✨ Write quote text"}</button>}
        {msg && <span style={{ color: msg.includes("AI busy") ? "#FFB800" : "#3DD68C", fontSize: "0.8rem" }}>{msg}</span>}
      </div>
    </Section>
  );
}

/* ---------------- SMS CONVERSATION ---------------- */
function Conversation({ lead, auth, draft, setDraft, draftKind, setDraftKind }) {
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [err, setErr] = useState("");

  async function fetchMsgs() {
    try {
      const res = await fetch("/api/admin/lead-messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...auth, lead_id: lead.id }),
      });
      const d = await res.json();
      if (res.ok) setMessages(d.messages || []);
    } catch (e) {}
  }
  useEffect(() => { fetchMsgs(); /* eslint-disable-next-line */ }, [lead.id]);

  // Sent/received texts shown in the thread; scheduled follow-ups counted separately.
  const thread = messages.filter((m) => m.status !== "scheduled" && m.status !== "canceled");
  const scheduledCount = messages.filter((m) => m.status === "scheduled").length;

  async function send() {
    if (!draft.trim()) return;
    setSending(true); setErr("");
    const body = draft;
    const armFollowups = draftKind === "quote";
    setDraft(""); setDraftKind(null);
    try {
      const res = await fetch("/api/admin/send-sms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...auth, lead_id: lead.id, body, startFollowups: armFollowups }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Send failed"); setDraft(body); }
      else fetchMsgs();
    } catch (e) { setErr("Network error"); setDraft(body); }
    finally { setSending(false); }
  }

  // Ask the AI to draft a reply to the customer's latest message, into the box.
  async function draftReply() {
    setDrafting(true); setErr("");
    try {
      const res = await fetch("/api/admin/ai-compose", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...auth, lead_id: lead.id, mode: "reply" }),
      });
      const d = await res.json();
      if (res.ok && d.draft) { setDraft(d.draft); setDraftKind("reply"); }
      else setErr(d.error || "AI couldn't draft a reply");
    } catch (e) { setErr("Network error"); }
    finally { setDrafting(false); }
  }

  return (
    <Section title="Text messages">
      {!lead.phone ? (
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" }}>No phone number on file for this lead.</p>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 260, overflowY: "auto", marginBottom: "0.75rem", padding: thread.length ? "0.25rem" : 0 }}>
            {thread.length === 0 && <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8rem" }}>No texts yet. Send the first one below 👇</p>}
            {thread.map((m) => (
              <div key={m.id} style={{ alignSelf: m.direction === "outbound" ? "flex-end" : "flex-start", maxWidth: "80%", background: m.direction === "outbound" ? "linear-gradient(180deg,#C20000,#8B0000)" : "rgba(255,255,255,0.07)", color: "#fff", padding: "0.5rem 0.8rem", borderRadius: 14, fontSize: "0.85rem", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                {m.body}
                <div style={{ fontSize: "0.6rem", opacity: 0.6, marginTop: 3, textAlign: "right" }}>{fmtDate(m.created_at, true)}</div>
              </div>
            ))}
          </div>
          {scheduledCount > 0 && (
            <p style={{ color: "#FFB800", fontSize: "0.72rem", marginBottom: "0.5rem" }}>⏱ {scheduledCount} follow-up{scheduledCount > 1 ? "s" : ""} scheduled — auto-cancel if they reply</p>
          )}
          <div style={{ marginBottom: "0.5rem" }}>
            <button onClick={draftReply} disabled={drafting} style={{ ...ghostBtn, fontSize: "0.72rem", padding: "0.45rem 0.8rem", borderColor: "rgba(255,31,31,0.3)", color: "#FF8888" }}>
              {drafting ? "✨ Thinking..." : "✨ Draft reply with AI"}
            </button>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <textarea value={draft} onChange={(e) => { setDraft(e.target.value); setDraftKind("manual"); }} rows={draft && draft.length > 60 ? 3 : 1}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Type a text, or tap ✨ to draft one..." style={{ ...inp, marginBottom: 0, flex: 1, resize: "vertical" }} />
            <button onClick={send} disabled={sending} style={cta}>{sending ? "..." : "Send"}</button>
          </div>
          {draftKind === "quote" && draft && <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.68rem", marginTop: "0.35rem" }}>Sending this will start the 30min / 4hr / 12hr follow-ups (canceled if they reply).</p>}
          {err && <p style={{ color: "#FF6666", fontSize: "0.78rem", marginTop: "0.4rem" }}>{err}</p>}
        </>
      )}
    </Section>
  );
}

/* ---------------- REMINDERS ---------------- */
function RemindersBlock({ lead, reminders, onReminder }) {
  const [note, setNote] = useState("");
  const [kind, setKind] = useState("followup");
  const open = reminders.filter((r) => !r.done);

  function quickAdd(days, k, n) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(9, 0, 0, 0);
    onReminder({ action: "create", lead_id: lead.id, due_at: d.toISOString(), note: n || note, kind: k || kind });
    setNote("");
  }

  return (
    <Section title="Reminders">
      {open.length > 0 && (
        <div style={{ display: "grid", gap: "0.4rem", marginBottom: "0.75rem" }}>
          {open.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "0.5rem 0.75rem" }}>
              <span>{r.kind === "service_ready" ? "🛞" : "📞"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontSize: "0.82rem" }}>{r.note || (r.kind === "service_ready" ? "Tires are in — come in" : "Follow up")}</div>
                <div style={{ color: isDueOrOverdue(r.due_at) ? "#FFB800" : "rgba(255,255,255,0.4)", fontSize: "0.7rem" }}>{dueLabel(r.due_at)}</div>
              </div>
              <button onClick={() => onReminder({ action: "complete", id: r.id })} style={{ ...ghostBtn, fontSize: "0.68rem", padding: "0.3rem 0.6rem" }}>Done</button>
            </div>
          ))}
        </div>
      )}
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reminder note (optional)" style={{ ...inp, marginBottom: "0.5rem" }} />
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.5rem" }}>
        <button onClick={() => setKind("followup")} style={{ ...ghostBtn, flex: 1, fontSize: "0.72rem", background: kind === "followup" ? "rgba(255,31,31,0.18)" : "rgba(255,255,255,0.05)", borderColor: kind === "followup" ? "#FF1F1F" : "rgba(255,255,255,0.12)" }}>📞 General follow-up</button>
        <button onClick={() => setKind("service_ready")} style={{ ...ghostBtn, flex: 1, fontSize: "0.72rem", background: kind === "service_ready" ? "rgba(255,31,31,0.18)" : "rgba(255,255,255,0.05)", borderColor: kind === "service_ready" ? "#FF1F1F" : "rgba(255,255,255,0.12)" }}>🛞 Tires are in</button>
      </div>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        <button onClick={() => quickAdd(1)} style={{ ...ghostBtn, fontSize: "0.72rem", padding: "0.45rem 0.7rem" }}>Tomorrow</button>
        <button onClick={() => quickAdd(2)} style={{ ...ghostBtn, fontSize: "0.72rem", padding: "0.45rem 0.7rem" }}>In 2 days</button>
        <button onClick={() => quickAdd(7)} style={{ ...ghostBtn, fontSize: "0.72rem", padding: "0.45rem 0.7rem" }}>Next week</button>
      </div>
    </Section>
  );
}

/* ---------------- SUBSCRIBERS ---------------- */
function SubscribersTab({ subs, onUpdate }) {
  if (subs.length === 0) return <Empty>No subscribers yet. The discount popup on your site feeds this list.</Empty>;
  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      {subs.map((s) => (
        <div key={s.id} style={{ ...rowStyle, opacity: s.status === "unsubscribed" ? 0.45 : 1 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#fff", fontWeight: 700 }}>{s.name || "(no name)"}</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>{s.email}</div>
          </div>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.7rem", marginRight: "0.5rem" }}>{fmtDate(s.created_at)}</span>
          <button onClick={() => onUpdate("subscribers", s.id, { status: s.status === "active" ? "unsubscribed" : "active" })} style={{ ...ghostBtn, fontSize: "0.7rem", padding: "0.45rem 0.7rem" }}>
            {s.status === "active" ? "Unsubscribe" : "Re-activate"}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- EMAIL ---------------- */
function EmailTab({ auth, leads, subs, campaigns }) {
  const [audience, setAudience] = useState("subscribers");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [confirm, setConfirm] = useState(false);

  const leadCount = leads.filter((l) => l.email && l.status !== "dead").length;
  const subCount = subs.filter((s) => s.email && s.status === "active").length;
  const counts = { leads: leadCount, subscribers: subCount, both: leadCount + subCount };

  async function send() {
    setSending(true); setResult(null);
    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...auth, audience, subject, message }),
      });
      const d = await res.json();
      if (!res.ok) setResult({ error: d.error || "Send failed" });
      else setResult({ ok: true, sent: d.sent, errors: d.errors, total: d.total });
    } catch (e) { setResult({ error: "Network error" }); }
    finally { setSending(false); setConfirm(false); }
  }

  const audiences = [
    { id: "subscribers", label: "Subscribers", n: counts.subscribers },
    { id: "leads", label: "Leads", n: counts.leads },
    { id: "both", label: "Everyone", n: counts.both },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2rem" }}>
      <div style={{ display: "grid", gap: "1.25rem", maxWidth: 640 }}>
        <div>
          <label style={fieldLabel}>Send to</label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {audiences.map((a) => (
              <button key={a.id} onClick={() => setAudience(a.id)} style={{ ...ghostBtn, flex: 1, background: audience === a.id ? "rgba(255,31,31,0.18)" : "rgba(255,255,255,0.05)", borderColor: audience === a.id ? "#FF1F1F" : "rgba(255,255,255,0.12)" }}>
                {a.label} <span style={{ color: "rgba(255,255,255,0.5)" }}>({a.n})</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={fieldLabel}>Subject line</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. $20 off any oil change this week" style={inp} />
        </div>
        <div>
          <label style={fieldLabel}>Message</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} placeholder={"Write your message here.\n\nLeave a blank line between paragraphs."} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.72rem", marginTop: "0.4rem" }}>Your message gets wrapped in the red/black Tire Plug email design automatically. Replies come back to you.</p>
        </div>

        {!confirm ? (
          <button onClick={() => setConfirm(true)} disabled={!subject || !message} style={{ ...cta, opacity: !subject || !message ? 0.4 : 1 }}>Review &amp; send</button>
        ) : (
          <div style={{ background: "rgba(255,31,31,0.08)", border: "1px solid rgba(255,31,31,0.3)", borderRadius: 12, padding: "1rem" }}>
            <p style={{ color: "#fff", fontSize: "0.9rem", marginBottom: "0.75rem" }}>
              Send <strong style={{ color: "#FF3838" }}>“{subject}”</strong> to <strong style={{ color: "#FF3838" }}>{counts[audience]}</strong> {audience === "both" ? "people" : audience}?
            </p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={send} disabled={sending} style={cta}>{sending ? "Sending..." : "Yes, send it"}</button>
              <button onClick={() => setConfirm(false)} style={ghostBtn}>Cancel</button>
            </div>
          </div>
        )}

        {result && (
          <p style={{ color: result.error ? "#FF6666" : "#3DD68C", fontSize: "0.85rem" }}>
            {result.error ? `⚠ ${result.error}` : `✓ Sent to ${result.sent} of ${result.total}${result.errors ? ` (${result.errors} failed)` : ""}.`}
          </p>
        )}
      </div>

      {campaigns.length > 0 && (
        <div>
          <h2 style={subHead}>Recent sends</h2>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {campaigns.map((c) => (
              <div key={c.id} style={{ ...rowStyle, padding: "0.7rem 1rem" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: "0.85rem" }}>{c.subject}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem" }}>to {c.audience} · {fmtDate(c.created_at, true)}</div>
                </div>
                <span style={{ color: "#3DD68C", fontSize: "0.78rem", fontWeight: 700 }}>{c.sent_count}/{c.recipient_count} sent</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- REPLIES ---------------- */
function RepliesTab({ replies, onUpdate }) {
  if (replies.length === 0) {
    return <Empty>No replies yet. When someone replies to an email blast, it shows up here.</Empty>;
  }
  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      {replies.map((r) => (
        <div key={r.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: "0.4rem", background: r.read ? "rgba(255,255,255,0.02)" : "rgba(255,31,31,0.05)", borderColor: r.read ? "rgba(255,255,255,0.08)" : "rgba(255,31,31,0.25)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ color: "#fff", fontWeight: 700 }}>{r.from_name || r.from_email}</span>
              {r.from_name && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem" }}> · {r.from_email}</span>}
            </div>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.7rem" }}>{fmtDate(r.created_at, true)}</span>
          </div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.82rem", fontWeight: 600 }}>{r.subject}</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.82rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{r.body}</div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
            {r.from_email && <a href={`mailto:${r.from_email}`} style={{ ...ghostBtn, fontSize: "0.72rem", padding: "0.4rem 0.7rem" }}>Reply</a>}
            <button onClick={() => onUpdate("email_replies", r.id, { read: !r.read })} style={{ ...ghostBtn, fontSize: "0.72rem", padding: "0.4rem 0.7rem" }}>{r.read ? "Mark unread" : "Mark read"}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- HIRING ---------------- */
function HiringTab() {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "2.5rem", textAlign: "center" }}>
      <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: "1.25rem", lineHeight: 1.6 }}>Your AI hiring dashboard lives in its own dedicated space and works exactly as before.</p>
      <a href="/careers/admin" style={cta}>Open Hiring Dashboard →</a>
    </div>
  );
}

/* ---------------- shared bits ---------------- */
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "0.75rem" }}>{title}</p>
      {children}
    </div>
  );
}
function KV({ k, v }) {
  if (!v) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.4rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.8rem" }}>{k}</span>
      <span style={{ color: "#fff", fontSize: "0.85rem", textAlign: "right" }}>{v}</span>
    </div>
  );
}
function Empty({ children }) { return <p style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{children}</p>; }

function fmtDate(s, withTime) {
  if (!s) return "";
  const d = new Date(s);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return withTime ? `${date}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : date;
}
function isThisMonth(s) {
  if (!s) return false;
  const d = new Date(s), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}
function isDueOrOverdue(s) {
  if (!s) return false;
  const due = new Date(s), end = new Date();
  end.setHours(23, 59, 59, 999);
  return due <= end;
}
function dueLabel(s) {
  if (!s) return "";
  const due = new Date(s), now = new Date();
  const dayMs = 86400000;
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const diff = Math.floor((due - startToday) / dayMs);
  if (due < now && diff < 0) return `Overdue (${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`;
  if (diff <= 0) return "Due today";
  if (diff === 1) return "Tomorrow";
  return `Due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

/* ---------------- RECENTLY ACTIVE BOARD ---------------- */
function ActiveBoard({ team, me, onRevoke }) {
  if (!team || team.length === 0) return null;
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "0.9rem 1.25rem", marginBottom: "1.5rem" }}>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "0.7rem" }}>Recently Active</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        {team.map((m) => {
          const online = isOnline(m.last_active);
          return (
            <div key={m.email} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 50, padding: "0.35rem 0.8rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: online ? "#3DD68C" : "rgba(255,255,255,0.25)", boxShadow: online ? "0 0 8px #3DD68C" : "none", flexShrink: 0 }} />
              <span style={{ color: "#fff", fontWeight: 600, fontSize: "0.82rem" }}>{m.name || m.email}{m.is_owner ? " 👑" : ""}</span>
              <span style={{ color: online ? "#3DD68C" : "rgba(255,255,255,0.4)", fontSize: "0.72rem" }}>{agoLabel(m.last_active)}</span>
              {me && me.isOwner && !m.is_owner && (
                <button onClick={() => onRevoke(m.email, "revoke")} title="Log out / revoke access" style={{ background: "none", border: "none", color: "rgba(255,100,100,0.6)", cursor: "pointer", fontSize: "0.8rem", padding: 0, lineHeight: 1 }}>✕</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function isOnline(s) { return s ? (Date.now() - new Date(s).getTime()) < 90000 : false; }
function agoLabel(s) {
  if (!s) return "never";
  const m = Math.floor((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 1) return "active now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Logo({ size = 44 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "0 0 0 2px rgba(255,31,31,0.4), 0 0 20px rgba(255,31,31,0.25)", flexShrink: 0 }}>
      <img src="/images/logo.webp" alt="The Tire Plug" style={{ width: "130%", height: "130%", objectFit: "cover", objectPosition: "center" }} />
    </div>
  );
}

function Shell({ children, title }) {
  return (
    <>
      <Head><title>{title}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <main style={{ background: "#000", minHeight: "100vh", padding: "2.5rem 1.25rem 5rem", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {children}
        <style jsx>{`.adminRow:hover { border-color: rgba(255,31,31,0.4) !important; background: rgba(255,31,31,0.04) !important; }`}</style>
      </main>
    </>
  );
}

/* styles */
const inp = { width: "100%", padding: "0.9rem 1.1rem", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, background: "rgba(255,255,255,0.03)", color: "#fff", fontSize: "0.95rem", marginBottom: "0.6rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
const miniInp = { width: "100%", padding: "0.5rem 0.6rem", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, background: "rgba(255,255,255,0.03)", color: "#fff", fontSize: "0.82rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
const cta = { display: "inline-block", background: "linear-gradient(180deg, #FF2A2A 0%, #C20000 50%, #8B0000 100%)", color: "#fff", padding: "0.8rem 1.4rem", fontSize: "0.8rem", fontWeight: 800, border: "none", borderRadius: 8, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "inherit", textDecoration: "none", textAlign: "center" };
const ghostBtn = { display: "inline-block", background: "rgba(255,255,255,0.05)", color: "#fff", padding: "0.7rem 1.1rem", fontSize: "0.78rem", fontWeight: 700, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", textAlign: "center" };
const googleBtn = { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem", background: "#fff", color: "#1a1a1a", padding: "0.85rem 1.5rem", fontSize: "0.9rem", fontWeight: 700, border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" };
const tabBtn = (active) => ({ background: active ? "rgba(255,31,31,0.15)" : "transparent", color: active ? "#FF6666" : "rgba(255,255,255,0.6)", padding: "0.55rem 1rem", fontSize: "0.85rem", fontWeight: 700, border: active ? "1px solid rgba(255,31,31,0.3)" : "1px solid transparent", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" });
const rowStyle = { display: "flex", alignItems: "center", gap: "1rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "0.85rem 1.25rem", transition: "all 0.2s ease" };
const subHead = { color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.2em", margin: "2.5rem 0 1rem" };
const fieldLabel = { display: "block", color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.5rem" };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" };
const drawer = { width: "min(540px, 100%)", height: "100%", overflowY: "auto", background: "linear-gradient(135deg, #0c0c0c 0%, #000 100%)", borderLeft: "1px solid rgba(255,31,31,0.25)", padding: "2.5rem 2rem", position: "relative" };
const closeBtn = { position: "absolute", top: "1.25rem", right: "1.25rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", width: 36, height: 36, borderRadius: "50%", cursor: "pointer" };
