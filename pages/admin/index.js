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

  async function syncOrders() {
    const res = await fetch("/api/admin/sync-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...authObj() }) });
    const d = await res.json();
    await loadWith(authObj());
    return d;
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
    { id: "scoreboard", label: "📊 Scoreboard" },
    { id: "leads", label: "Leads", count: liveLeads.length },
    { id: "subscribers", label: "Subscribers", count: data.subscribers.length },
    { id: "email", label: "Email" },
    { id: "replies", label: "Replies", count: unreadReplies || null, alert: unreadReplies > 0 },
    { id: "training", label: "📚 Training" },
    { id: "hiring", label: "Hiring" },
    { id: "staff", label: "👥 Staff" },
    { id: "schedule", label: "🗓️ Schedule" },
    { id: "worklog", label: "📋 Work Log" },
    { id: "payroll", label: "💵 Payroll" },
    { id: "finance", label: "📒 Finance" },
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

        {tab === "scoreboard" && <ScoreboardTab auth={auth} />}
        {tab === "leads" && (
          <LeadsTab data={data} dueCount={dueCount} onOpen={setSelectedLeadId} onReminder={reminderAction} onRevoke={revoke} onSync={syncOrders} />
        )}
        {tab === "subscribers" && <SubscribersTab subs={data.subscribers} onUpdate={update} />}
        {tab === "email" && <EmailTab auth={auth} leads={data.leads} subs={data.subscribers} campaigns={data.campaigns} />}
        {tab === "replies" && <RepliesTab replies={data.replies} onUpdate={update} />}
        {tab === "training" && <TrainingTab auth={auth} />}
        {tab === "hiring" && <HiringTab />}
        {tab === "staff" && <StaffTab auth={auth} />}
        {tab === "schedule" && <ScheduleTab auth={auth} />}
        {tab === "worklog" && <WorkLogTab auth={auth} />}
        {tab === "payroll" && <PayrollTab auth={auth} />}
        {tab === "finance" && <FinanceTab auth={auth} />}
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

function LeadsTab({ data, dueCount, onOpen, onReminder, onRevoke, onSync }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  async function doSync() {
    setSyncing(true); setSyncMsg("");
    try {
      const d = await onSync();
      setSyncMsg(d && d.closed > 0 ? `✓ Closed ${d.closed} lead${d.closed > 1 ? "s" : ""} from TireBase orders` : "✓ Up to date — no new matches");
    } catch (e) { setSyncMsg("⚠ Sync failed"); }
    finally { setSyncing(false); setTimeout(() => setSyncMsg(""), 5000); }
  }

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
        <button onClick={doSync} disabled={syncing} style={{ ...ghostBtn, fontSize: "0.72rem", padding: "0.55rem 0.8rem", borderColor: "rgba(61,214,140,0.4)", color: "#3DD68C" }}>
          {syncing ? "Syncing..." : "🔄 Sync TireBase orders"}
        </button>
      </div>
      {syncMsg && <p style={{ color: syncMsg.includes("⚠") ? "#FF6666" : "#3DD68C", fontSize: "0.8rem", marginTop: "-0.75rem", marginBottom: "1rem" }}>{syncMsg}</p>}

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
        <div style={{ color: l.channel === "instagram" ? "#E1306C" : "#FF3838", fontSize: "0.82rem", fontWeight: 700 }}>{l.channel === "instagram" ? "📸 Instagram" : (l.phone || "—")}</div>
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
  const [services, setServices] = useState(lead.services || {});
  const [writing, setWriting] = useState(false);
  const [msg, setMsg] = useState("");

  function setRow(i, field, val) { setRows(rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r))); }
  function addRow() { setRows([...rows, { brand: "", price: "", qty: 4, warranty: "" }]); }
  function removeRow(i) { setRows(rows.filter((_, idx) => idx !== i)); }
  function setSvc(key, val) { setServices({ ...services, [key]: val }); }
  function save() { onUpdate("leads", lead.id, { quotes: rows.filter((r) => r.brand || r.price), road_hazard_per_tire: roadHazard, services }); setMsg("Quote saved ✓"); setTimeout(() => setMsg(""), 1500); }

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
    onUpdate("leads", lead.id, { quotes: rows.filter((r) => r.brand || r.price), road_hazard_per_tire: roadHazard, services });
    try {
      const res = await fetch("/api/admin/ai-compose", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...auth, lead_id: lead.id, mode: "quote", quotes: rows, road_hazard: roadHazard, services }),
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

      {/* Add-on services */}
      <div style={{ marginBottom: "0.85rem" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>Add-on services</p>
        {[
          { key: "alignment", label: "🎯 Wheel Alignment" },
          { key: "oilChange", label: "🛢️ Oil Change" },
        ].map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "0.45rem 0.7rem" }}>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.78rem", flex: 1 }}>{s.label}</span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem" }}>$</span>
            <input value={services[s.key] || ""} onChange={(e) => setSvc(s.key, e.target.value)} placeholder="0" inputMode="decimal" style={{ ...miniInp, width: 70 }} />
          </div>
        ))}
        {/* TPMS — set of 4 OR each */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "0.45rem 0.7rem" }}>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.78rem" }}>💡 TPMS Sensors</span>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.4rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem" }}>Set of 4 $</span>
              <input value={services.tpmsSet || ""} onChange={(e) => setSvc("tpmsSet", e.target.value)} placeholder="199" inputMode="decimal" style={{ ...miniInp, width: 60 }} />
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem" }}>Each $</span>
              <input value={services.tpmsEach || ""} onChange={(e) => setSvc("tpmsEach", e.target.value)} placeholder="60" inputMode="decimal" style={{ ...miniInp, width: 55 }} />
            </span>
          </div>
        </div>
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

  const isIg = lead.channel === "instagram";

  async function send() {
    if (!draft.trim()) return;
    setSending(true); setErr("");
    const body = draft;
    const armFollowups = draftKind === "quote" && !isIg; // follow-ups are SMS-only for now
    setDraft(""); setDraftKind(null);
    try {
      const endpoint = isIg ? "/api/admin/send-ig" : "/api/admin/send-sms";
      const payload = isIg ? { ...auth, lead_id: lead.id, body } : { ...auth, lead_id: lead.id, body, startFollowups: armFollowups };
      const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Send failed"); setDraft(body); }
      else fetchMsgs();
    } catch (e) { setErr("Network error"); setDraft(body); }
    finally { setSending(false); }
  }

  // Ask the AI to draft a reply (or a "tires are in" message) into the box.
  async function aiDraft(mode) {
    setDrafting(true); setErr("");
    try {
      const res = await fetch("/api/admin/ai-compose", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...auth, lead_id: lead.id, mode }),
      });
      const d = await res.json();
      if (res.ok && d.draft) { setDraft(d.draft); setDraftKind("reply"); }
      else setErr(d.error || "AI couldn't draft that");
    } catch (e) { setErr("Network error"); }
    finally { setDrafting(false); }
  }

  // Drop the two-location question into the box (fixed template).
  function fillLocation() {
    const fn = (lead.name || "").split(" ")[0] || "there";
    setDraft(`Hi ${fn}! Which location would you like to be serviced at?\n\n1. 2331 E Olympic Blvd, Los Angeles\n2. 2220 E Manchester Ave, Los Angeles\n\nJust reply 1 or 2 and we'll get you set up.`);
    setDraftKind("manual");
  }

  return (
    <Section title={isIg ? "📸 Instagram DM" : "Text messages"}>
      {!lead.phone && !isIg ? (
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
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            <button onClick={() => aiDraft("reply")} disabled={drafting} style={{ ...ghostBtn, fontSize: "0.72rem", padding: "0.45rem 0.8rem", borderColor: "rgba(255,31,31,0.3)", color: "#FF8888" }}>
              {drafting ? "✨ Thinking..." : "✨ Draft reply"}
            </button>
            <button onClick={() => aiDraft("ready")} disabled={drafting} style={{ ...ghostBtn, fontSize: "0.72rem", padding: "0.45rem 0.8rem" }}>🛞 Tires are in</button>
            <button onClick={fillLocation} style={{ ...ghostBtn, fontSize: "0.72rem", padding: "0.45rem 0.8rem" }}>📍 Ask location</button>
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

/* ---------------- CEO AGENT ---------------- */
function CeoAgent({ auth }) {
  const [briefing, setBriefing] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/admin/ceo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth }) });
      const d = await res.json();
      if (res.ok && d.briefing) setBriefing(d.briefing);
      else setErr(d.error || "Couldn't generate briefing");
    } catch (e) { setErr("Network error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <div style={{ background: "linear-gradient(135deg, rgba(139,124,246,0.13), rgba(0,0,0,0))", border: "1px solid rgba(139,124,246,0.35)", borderRadius: 16, padding: "1.25rem 1.5rem", marginBottom: "1.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <span style={{ color: "#A99CF8", fontWeight: 800, fontSize: "0.78rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>🧠 CEO Agent · daily briefing</span>
        <button onClick={load} disabled={loading} style={{ ...ghostBtn, fontSize: "0.7rem", padding: "0.4rem 0.7rem" }}>{loading ? "Thinking…" : "↻ Refresh"}</button>
      </div>
      {loading ? (
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.88rem" }}>Reading today's numbers…</p>
      ) : err ? (
        <p style={{ color: "#FF6666", fontSize: "0.85rem" }}>⚠ {err}</p>
      ) : (
        <div style={{ color: "rgba(255,255,255,0.88)", fontSize: "0.92rem", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{briefing}</div>
      )}
    </div>
  );
}

/* ---------------- SCOREBOARD (live from TireBase) ---------------- */
function ScoreboardTab({ auth }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true); setErr("");
    try {
      const today = new Date().toLocaleDateString("en-CA");
      const res = await fetch("/api/admin/scoreboard", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...auth, date: today, store_id: 1 }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Could not load"); setData(null); }
      else setData(d);
    } catch (e) { setErr("Network error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  if (loading) return <Empty>Loading live numbers from TireBase…</Empty>;
  if (err) return <p style={{ color: "#FF6666" }}>⚠ {err}</p>;
  if (!data) return null;

  const goalDefs = [
    { key: "tires", label: "🛞 Tires Sold", goal: data.goals.tires },
    { key: "alignments", label: "🎯 Alignments", goal: data.goals.alignments },
    { key: "tpms", label: "💡 TPMS Sensors", goal: data.goals.tpms },
    { key: "brakes", label: "🛑 Brake Jobs", goal: data.goals.brakes },
    { key: "oil", label: "🛢️ Oil Changes", goal: data.goals.oil },
  ];
  const payEntries = Object.entries(data.payments || {}).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <CeoAgent auth={auth} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>🟢 Live from TireBase · {data.store} · {data.date}</span>
        <button onClick={load} style={ghostBtn}>↻ Refresh</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.75rem", marginBottom: "1.75rem" }}>
        <BigStat label="Today's Revenue" value={`$${data.revenue.toLocaleString()}`} color="#8B7CF6" />
        <BigStat label="Invoices Today" value={data.invoices} color="#FF3838" />
        <BigStat label="Tires Sold" value={data.services.tires} color="#3DD68C" />
      </div>

      <h2 style={subHead}>Daily Goals</h2>
      <div style={{ display: "grid", gap: "0.6rem", marginBottom: "2rem" }}>
        {goalDefs.map((g) => {
          const val = data.services[g.key] || 0;
          const pct = g.goal ? Math.min(100, Math.round((val / g.goal) * 100)) : 0;
          const color = pct >= 100 ? "#3DD68C" : pct >= 67 ? "#9ACD32" : pct >= 34 ? "#FFB800" : "#FF6666";
          return (
            <div key={g.key} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.9rem" }}>{g.label} <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>{val} / {g.goal}</span></span>
                <span style={{ color, fontWeight: 800 }}>{pct}%</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width 0.5s" }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
        <div>
          <h2 style={subHead}>Payments</h2>
          {payEntries.length === 0 ? <Empty>No payments yet today.</Empty> : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              {payEntries.map(([m, v]) => (
                <div key={m} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "0.85rem 1rem" }}>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>{m}</div>
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: "1.1rem" }}>${Number(v).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h2 style={subHead}>Staff Performance</h2>
          {data.staff.length === 0 ? <Empty>No staff-attributed sales today.</Empty> : (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {data.staff.map((s) => {
                const max = data.staff[0].total || 1;
                return (
                  <div key={s.name} style={{ ...rowStyle, padding: "0.7rem 1rem", gap: "0.75rem" }}>
                    <span style={{ color: "#fff", fontWeight: 600, fontSize: "0.85rem", width: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                    <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.round((s.total / max) * 100)}%`, background: "#8B7CF6" }} />
                    </div>
                    <span style={{ color: "#3DD68C", fontWeight: 700, fontSize: "0.82rem" }}>${s.total.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
function BigStat({ label, value, color }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "1.25rem 1.5rem" }}>
      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.4rem" }}>{label}</div>
      <div style={{ color, fontWeight: 900, fontSize: "1.9rem", lineHeight: 1 }}>{value}</div>
    </div>
  );
}

/* ---------------- STAFF ROSTER (People/HR) ---------------- */
function StaffTab({ auth }) {
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(null); // staff object being added/edited, or null
  const [saving, setSaving] = useState(false);

  async function call(body) {
    const res = await fetch("/api/admin/staff", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auth, ...body }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Request failed");
    return d;
  }
  async function load() {
    setLoading(true); setErr("");
    try { const d = await call({ action: "list" }); setStaff(d.staff); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function save() {
    if (!editing?.name?.trim()) return;
    setSaving(true);
    try { const d = await call({ action: "save", staff: editing }); setStaff(d.staff); setEditing(null); }
    catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }
  async function toggleActive(s) {
    try { const d = await call({ action: "setActive", id: s.id, active: !s.active }); setStaff(d.staff); }
    catch (e) { alert(e.message); }
  }

  if (loading) return <Empty>Loading staff…</Empty>;
  if (err) return <p style={{ color: "#FF6666" }}>⚠ {err}</p>;

  const list = staff || [];
  const activeList = list.filter((s) => s.active);
  const inactiveList = list.filter((s) => !s.active);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>
          👥 {activeList.length} active · <span style={{ color: "#3DD68C" }}>{activeList.filter((s) => s.clocked_in).length} on the clock</span>
        </span>
        {!editing && (
          <button onClick={() => setEditing({ active: true, location: "Olympic", pay_type: "hourly_commission" })} style={cta}>+ Add staff</button>
        )}
      </div>
      <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.75rem", marginBottom: "1.25rem" }}>
        Clock-in kiosk for the shop tablet: <span style={{ color: "#FF6666" }}>tireplugla.com/clock</span> — staff punch in/out with their PIN.
      </p>

      {editing && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,31,31,0.2)", borderRadius: 14, padding: "1.25rem", marginBottom: "1.5rem" }}>
          <h2 style={subHead}>{editing.id ? "Edit" : "New"} staff member</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
            <StaffField label="Name"><input style={inp} value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></StaffField>
            <StaffField label="Role"><input style={inp} placeholder="Tire Technician" value={editing.role || ""} onChange={(e) => setEditing({ ...editing, role: e.target.value })} /></StaffField>
            <StaffField label="Location">
              <select style={inp} value={editing.location || ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })}>
                <option value="Olympic">Olympic</option>
                <option value="Manchester">Manchester</option>
              </select>
            </StaffField>
            <StaffField label="Phone (for shift texts)"><input style={inp} value={editing.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></StaffField>
            <StaffField label="Hourly rate ($)"><input style={inp} type="number" value={editing.hourly_rate ?? ""} onChange={(e) => setEditing({ ...editing, hourly_rate: e.target.value })} /></StaffField>
            <StaffField label="Clock-in PIN (4 digits)"><input style={inp} inputMode="numeric" value={editing.pin || ""} onChange={(e) => setEditing({ ...editing, pin: e.target.value })} /></StaffField>
          </div>
          <StaffField label="Commission rule (plain text)"><input style={inp} placeholder="$5 per tire installed, $10 per alignment" value={editing.commission_note || ""} onChange={(e) => setEditing({ ...editing, commission_note: e.target.value })} /></StaffField>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button onClick={save} style={{ ...cta, opacity: editing.name?.trim() && !saving ? 1 : 0.5 }} disabled={!editing.name?.trim() || saving}>{saving ? "Saving…" : "Save"}</button>
            <button onClick={() => setEditing(null)} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}

      {list.length === 0 && !editing ? <Empty>No staff yet. Add your first team member.</Empty> : (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {activeList.map((s) => <StaffRow key={s.id} s={s} onEdit={() => setEditing(s)} onToggle={() => toggleActive(s)} />)}
        </div>
      )}

      {inactiveList.length > 0 && (
        <>
          <h2 style={{ ...subHead, marginTop: "2rem" }}>Inactive</h2>
          <div style={{ display: "grid", gap: "0.5rem", opacity: 0.55 }}>
            {inactiveList.map((s) => <StaffRow key={s.id} s={s} onEdit={() => setEditing(s)} onToggle={() => toggleActive(s)} />)}
          </div>
        </>
      )}
    </>
  );
}
function StaffField({ label, children }) {
  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.25rem" }}>{label}</div>
      {children}
    </div>
  );
}
function StaffRow({ s, onEdit, onToggle }) {
  return (
    <div style={{ ...rowStyle, gap: "0.75rem" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#fff", fontWeight: 700 }}>
          {s.name} <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 500, fontSize: "0.8rem" }}>{s.role || ""}</span>
          {s.clocked_in && <span style={{ marginLeft: 8, color: "#3DD68C", fontSize: "0.7rem", fontWeight: 700 }}>● on the clock</span>}
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>
          {s.location || "—"} · ${Number(s.hourly_rate || 0)}/hr{s.commission_note ? ` · ${s.commission_note}` : ""}
          {s.today_hours > 0 ? ` · ${s.today_hours}h today` : ""}
        </div>
      </div>
      <button onClick={onEdit} style={ghostBtn}>Edit</button>
      <button onClick={onToggle} style={ghostBtn}>{s.active ? "Deactivate" : "Reactivate"}</button>
    </div>
  );
}

/* ---------------- SCHEDULE (Phase 4) ---------------- */
function ymd(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function mondayOf(date) {
  const x = new Date(date); const off = (x.getDay() + 6) % 7; // Mon=0..Sun=6
  x.setDate(x.getDate() - off); x.setHours(0, 0, 0, 0); return x;
}
function ScheduleTab({ auth }) {
  const chip = { background: "rgba(255,255,255,0.05)", color: "#fff", padding: "0.45rem 0.7rem", fontSize: "0.78rem", fontWeight: 700, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 50, cursor: "pointer", fontFamily: "inherit" };
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [shifts, setShifts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(null); // date string we're adding a shift to
  const [form, setForm] = useState({ staff_id: "", start_time: "09:00", end_time: "18:00", location: "Olympic", note: "" });

  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });

  async function call(body) {
    const res = await fetch("/api/admin/shifts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Request failed");
    return d;
  }
  async function load(ws) {
    setLoading(true); setErr("");
    const d6 = new Date(ws); d6.setDate(d6.getDate() + 6);
    try { const r = await call({ action: "list", from: ymd(ws), to: ymd(d6) }); setShifts(r.shifts); setStaff(r.staff); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(weekStart); /* eslint-disable-next-line */ }, [weekStart]);

  async function add(date) {
    if (!form.staff_id) return;
    try { const r = await call({ action: "add", shift: { ...form, shift_date: date } }); setShifts(r.shifts); setStaff(r.staff); setAdding(null); }
    catch (e) { alert(e.message); }
  }
  async function del(id) {
    try { const r = await call({ action: "delete", id }); setShifts(r.shifts); setStaff(r.staff); }
    catch (e) { alert(e.message); }
  }
  function shiftWeek(n) { const d = new Date(weekStart); d.setDate(d.getDate() + n * 7); setWeekStart(d); }

  const nameById = Object.fromEntries(staff.map((s) => [s.id, s.name]));
  const byDate = {};
  for (const s of shifts) (byDate[s.shift_date] || (byDate[s.shift_date] = [])).push(s);
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const todayStr = ymd(new Date());

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <button onClick={() => shiftWeek(-1)} style={chip}>‹</button>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.9rem" }}>Week of {weekStart.toLocaleDateString([], { month: "short", day: "numeric" })}</span>
          <button onClick={() => shiftWeek(1)} style={chip}>›</button>
          <button onClick={() => setWeekStart(mondayOf(new Date()))} style={{ ...chip, marginLeft: "0.4rem" }}>This week</button>
        </div>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.72rem", margin: 0 }}>📲 Auto-texts each tech their shift each morning.</p>
      </div>

      {err && <p style={{ color: "#FF6666" }}>⚠ {err}</p>}
      {loading ? <Empty>Loading schedule…</Empty> : staff.length === 0 ? <Empty>Add staff in the 👥 Staff tab first.</Empty> : (
        <div style={{ display: "grid", gap: "0.6rem" }}>
          {days.map((d, i) => {
            const ds = ymd(d);
            const dayShifts = byDate[ds] || [];
            const isToday = ds === todayStr;
            return (
              <div key={ds} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${isToday ? "rgba(255,31,31,0.35)" : "rgba(255,255,255,0.08)"}`, borderRadius: 12, padding: "0.85rem 1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: dayShifts.length || adding === ds ? "0.6rem" : 0 }}>
                  <span style={{ color: isToday ? "#FF6666" : "#fff", fontWeight: 800, fontSize: "0.85rem" }}>
                    {dayNames[i]} {d.toLocaleDateString([], { month: "short", day: "numeric" })}{isToday ? " · today" : ""}
                  </span>
                  <button onClick={() => { setAdding(adding === ds ? null : ds); setForm((f) => ({ ...f, staff_id: "" })); }} style={chip}>{adding === ds ? "✕" : "＋ shift"}</button>
                </div>

                {dayShifts.map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.35rem 0" }}>
                    <span style={{ color: "#fff", fontWeight: 600, fontSize: "0.85rem", flex: 1 }}>
                      {nameById[s.staff_id] || "—"} <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 400 }}>{[s.start_time, s.end_time].filter(Boolean).join("–")}{s.location ? ` · ${s.location}` : ""}</span>
                      {s.reminded_at && <span style={{ color: "#3DD68C", fontSize: "0.65rem", marginLeft: 6 }}>texted ✓</span>}
                    </span>
                    <button onClick={() => del(s.id)} style={{ ...ghostBtn, padding: "0.25rem 0.55rem", fontSize: "0.7rem" }}>✕</button>
                  </div>
                ))}

                {adding === ds && (
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.5rem" }}>
                    <select style={{ ...inp, marginBottom: 0, width: 150 }} value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })}>
                      <option value="">Who?</option>
                      {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <input type="time" style={{ ...inp, marginBottom: 0, width: 110 }} value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                    <input type="time" style={{ ...inp, marginBottom: 0, width: 110 }} value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                    <select style={{ ...inp, marginBottom: 0, width: 130 }} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
                      <option value="Olympic">Olympic</option>
                      <option value="Manchester">Manchester</option>
                    </select>
                    <button onClick={() => add(ds)} disabled={!form.staff_id} style={{ ...cta, opacity: form.staff_id ? 1 : 0.5 }}>Add</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ---------------- FINANCE ROBOT (P&L + cost memory) ---------------- */
const EXPENSE_CATS = ["rent", "utilities", "ads", "supplies", "insurance", "other"];
function FinanceTab({ auth }) {
  const chip = { background: "rgba(255,255,255,0.05)", color: "#fff", padding: "0.45rem 0.7rem", fontSize: "0.78rem", fontWeight: 700, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 50, cursor: "pointer", fontFamily: "inherit" };
  function presetMonth() { const n = new Date(); return { key: "month", from: ymd(new Date(n.getFullYear(), n.getMonth(), 1)), to: ymd(n) }; }
  function presetLastMonth() { const n = new Date(); return { key: "lastmonth", from: ymd(new Date(n.getFullYear(), n.getMonth() - 1, 1)), to: ymd(new Date(n.getFullYear(), n.getMonth(), 0)) }; }
  function presetWeek() { const n = new Date(); return { key: "week", from: ymd(mondayOf(n)), to: ymd(n) }; }

  const [range, setRange] = useState(() => presetMonth());
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [costIn, setCostIn] = useState({});
  const [exp, setExp] = useState({ label: "", category: "rent", amount: "", frequency: "monthly" });

  async function call(body) {
    const res = await fetch("/api/admin/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  }
  async function load(r) {
    setLoading(true); setErr("");
    try { setD(await call({ action: "pnl", from: r.from, to: r.to })); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(range); /* eslint-disable-next-line */ }, [range]);

  async function saveCost(p, isProduct) {
    const v = isProduct ? costIn[p.key] : 0;
    try { await call({ action: "setCost", description: p.label, unit_cost: v || 0, is_product: isProduct }); await load(range); }
    catch (e) { alert(e.message); }
  }
  async function addExpense() {
    if (!exp.label || exp.amount === "") return;
    try { await call({ action: "addExpense", expense: exp }); setExp({ label: "", category: "rent", amount: "", frequency: "monthly" }); await load(range); }
    catch (e) { alert(e.message); }
  }
  async function delExpense(id) { try { await call({ action: "deleteExpense", id }); await load(range); } catch (e) { alert(e.message); } }

  const money = (n) => `$${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const presets = [{ p: presetWeek, l: "This week" }, { p: presetMonth, l: "This month" }, { p: presetLastMonth, l: "Last month" }];
  const needsCost = d ? d.products.filter((p) => !p.hasCost) : [];
  const priced = d ? d.products.filter((p) => p.hasCost) : [];

  return (
    <>
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        {presets.map((x) => { const r = x.p(); return <button key={x.l} onClick={() => setRange(r)} style={{ ...chip, ...(range.key === r.key ? { background: "#fff", color: "#000", borderColor: "#fff" } : {}) }}>{x.l}</button>; })}
        {d && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", marginLeft: "0.4rem" }}>{d.from} → {d.to}</span>}
      </div>

      {err && <p style={{ color: "#FF6666" }}>⚠ {err}</p>}
      {loading || !d ? <Empty>Building your P&amp;L from TireBase…</Empty> : (
        <>
          {/* P&L STATEMENT */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "1.25rem 1.5rem", marginBottom: "1.5rem" }}>
            <PLRow label="Revenue (pre-tax)" value={money(d.revenue)} />
            <PLRow label="− Tire / product cost (COGS)" value={money(d.cogs)} dim />
            <PLRow label="= Gross profit" value={money(d.gross)} pct={`${d.grossMargin}%`} strong color="#3DD68C" border />
            <PLRow label="− Labor (payroll)" value={money(d.labor)} dim />
            <PLRow label="− Operating expenses" value={money(d.otherOpex)} dim />
            <PLRow label="= Net profit" value={money(d.net)} pct={`${d.netMargin}%`} strong color={d.net >= 0 ? "#3DD68C" : "#FF6666"} border />
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.7rem", marginTop: "0.75rem" }}>Tax excluded (passthrough). Monthly expenses counted across {d.months} month{d.months > 1 ? "s" : ""} in range.</p>
          </div>

          {/* NEEDS COST — the memory builder */}
          {needsCost.length > 0 && (
            <div style={{ marginBottom: "1.75rem" }}>
              <h2 style={{ ...subHead, color: "#FFB800" }}>⚠ Tires needing a cost ({needsCost.length}) — enter once, remembered forever</h2>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {needsCost.slice(0, 30).map((p) => (
                  <div key={p.key} style={{ ...rowStyle, gap: "0.6rem", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ color: "#fff", fontWeight: 600, fontSize: "0.84rem" }}>{p.label}</div>
                      <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.74rem" }}>sold {p.qty} · revenue {money(p.revenue)}</div>
                    </div>
                    <input style={{ ...inp, marginBottom: 0, width: 110 }} type="number" placeholder="$ cost ea" value={costIn[p.key] ?? ""} onChange={(e) => setCostIn({ ...costIn, [p.key]: e.target.value })} />
                    <button onClick={() => saveCost(p, true)} style={cta}>Save cost</button>
                    <button onClick={() => saveCost(p, false)} style={ghostBtn} title="Labor / service — no product cost">Not a product</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PER-TIRE MARGINS */}
          {priced.length > 0 && (
            <div style={{ marginBottom: "1.75rem" }}>
              <h2 style={subHead}>Margin by item</h2>
              <div style={{ display: "grid", gap: "0.4rem" }}>
                {priced.map((p) => (
                  <div key={p.key} style={{ ...rowStyle, gap: "0.6rem", padding: "0.6rem 1rem" }}>
                    <span style={{ flex: 1, color: "#fff", fontSize: "0.83rem", minWidth: 0 }}>{p.label} <span style={{ color: "rgba(255,255,255,0.4)" }}>×{p.qty}</span></span>
                    <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>rev {money(p.revenue)} · cost {money(p.cost)}</span>
                    <span style={{ color: p.margin >= 0 ? "#3DD68C" : "#FF6666", fontWeight: 700, fontSize: "0.82rem", width: 90, textAlign: "right" }}>{money(p.margin)} ({p.marginPct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OPERATING EXPENSES */}
          <h2 style={subHead}>Operating expenses</h2>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.75rem" }}>
            <input style={{ ...inp, marginBottom: 0, width: 150 }} placeholder="Label (e.g. Rent)" value={exp.label} onChange={(e) => setExp({ ...exp, label: e.target.value })} />
            <select style={{ ...inp, marginBottom: 0, width: 120 }} value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value })}>
              {EXPENSE_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input style={{ ...inp, marginBottom: 0, width: 100 }} type="number" placeholder="$ amount" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} />
            <select style={{ ...inp, marginBottom: 0, width: 120 }} value={exp.frequency} onChange={(e) => setExp({ ...exp, frequency: e.target.value })}>
              <option value="monthly">per month</option>
              <option value="one_time">one-time</option>
            </select>
            <button onClick={addExpense} disabled={!exp.label || exp.amount === ""} style={{ ...cta, opacity: !exp.label || exp.amount === "" ? 0.5 : 1 }}>Add</button>
          </div>
          {(d.expenses || []).length === 0 ? <Empty>No operating expenses added yet (rent, utilities, ads…).</Empty> : (
            <div style={{ display: "grid", gap: "0.4rem" }}>
              {d.expenses.map((e) => (
                <div key={e.id} style={{ ...rowStyle, gap: "0.6rem", padding: "0.55rem 1rem" }}>
                  <span style={{ flex: 1, color: "#fff", fontSize: "0.84rem" }}>{e.label} <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.74rem" }}>· {e.category} · {e.frequency === "monthly" ? "/mo" : "one-time"}</span></span>
                  <span style={{ color: "#FF9E9E", fontSize: "0.82rem" }}>{money(e.amount)}</span>
                  <button onClick={() => delExpense(e.id)} style={{ ...ghostBtn, padding: "0.25rem 0.55rem", fontSize: "0.7rem" }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
function PLRow({ label, value, pct, dim, strong, color, border }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0.4rem 0", borderTop: border ? "1px solid rgba(255,255,255,0.12)" : "none", marginTop: border ? "0.3rem" : 0 }}>
      <span style={{ color: dim ? "rgba(255,255,255,0.55)" : "#fff", fontWeight: strong ? 800 : 500, fontSize: strong ? "0.95rem" : "0.85rem" }}>{label}</span>
      <span style={{ color: color || (dim ? "rgba(255,255,255,0.6)" : "#fff"), fontWeight: strong ? 900 : 600, fontSize: strong ? "1.05rem" : "0.9rem" }}>
        {value}{pct ? <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 600, fontSize: "0.78rem", marginLeft: 6 }}>{pct}</span> : null}
      </span>
    </div>
  );
}

/* ---------------- PAYROLL + PERFORMANCE (Phase 5) ---------------- */
function PayrollTab({ auth }) {
  const chip = { background: "rgba(255,255,255,0.05)", color: "#fff", padding: "0.45rem 0.7rem", fontSize: "0.78rem", fontWeight: 700, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 50, cursor: "pointer", fontFamily: "inherit" };
  function presetWeek() { const n = new Date(); return { key: "week", from: ymd(mondayOf(n)), to: ymd(n) }; }
  function presetLastWeek() { const m = mondayOf(new Date()); m.setDate(m.getDate() - 7); const e = new Date(m); e.setDate(e.getDate() + 6); return { key: "lastweek", from: ymd(m), to: ymd(e) }; }
  function presetMonth() { const n = new Date(); return { key: "month", from: ymd(new Date(n.getFullYear(), n.getMonth(), 1)), to: ymd(n) }; }

  const [range, setRange] = useState(() => presetWeek());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function call(body) {
    const res = await fetch("/api/admin/payroll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Request failed");
    return d;
  }
  async function load(r) {
    setLoading(true); setErr("");
    try { const d = await call({ action: "summary", from: r.from, to: r.to }); setRows(d.rows); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(range); /* eslint-disable-next-line */ }, [range]);

  async function setRating(id, rating) {
    setRows((rs) => rs.map((x) => (x.staff_id === id ? { ...x, rating } : x)));
    try { await call({ action: "rate", staff_id: id, rating }); } catch (e) { alert(e.message); }
  }
  function setNote(id, val) { setRows((rs) => rs.map((x) => (x.staff_id === id ? { ...x, perf_notes: val } : x))); }
  async function saveNote(row) {
    try { await call({ action: "rate", staff_id: row.staff_id, perf_notes: row.perf_notes }); } catch (e) { alert(e.message); }
  }

  const grand = rows.reduce((s, r) => s + (r.total_pay || 0), 0);
  const presets = [{ p: presetWeek, l: "This week" }, { p: presetLastWeek, l: "Last week" }, { p: presetMonth, l: "This month" }];

  return (
    <>
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        {presets.map((x) => { const r = x.p(); return <button key={x.l} onClick={() => setRange(r)} style={{ ...chip, ...(range.key === r.key ? { background: "#fff", color: "#000", borderColor: "#fff" } : {}) }}>{x.l}</button>; })}
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", marginLeft: "0.4rem" }}>{range.from} → {range.to}</span>
      </div>

      {err && <p style={{ color: "#FF6666" }}>⚠ {err}</p>}
      {loading ? <Empty>Crunching the numbers…</Empty> : (
        <>
          <div style={{ background: "rgba(139,124,246,0.1)", border: "1px solid rgba(139,124,246,0.3)", borderRadius: 16, padding: "1.1rem 1.4rem", marginBottom: "1.5rem" }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>Estimated payroll this period</div>
            <div style={{ color: "#A99CF8", fontWeight: 900, fontSize: "1.9rem", lineHeight: 1.1 }}>${grand.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", marginTop: "0.25rem" }}>hours × rate + logged commission · review before paying</div>
          </div>

          {rows.length === 0 ? <Empty>No active staff.</Empty> : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {rows.map((r) => (
                <div key={r.staff_id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "1rem 1.15rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ color: "#fff", fontWeight: 800, fontSize: "1rem" }}>{r.name}</div>
                      <div style={{ display: "flex", gap: "0.15rem", marginTop: "0.2rem" }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} onClick={() => setRating(r.staff_id, n)} style={{ cursor: "pointer", color: n <= (r.rating || 0) ? "#FFB800" : "rgba(255,255,255,0.2)", fontSize: "1rem" }}>★</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#3DD68C", fontWeight: 900, fontSize: "1.3rem", lineHeight: 1 }}>${(r.total_pay || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem" }}>total pay</div>
                    </div>
                  </div>

                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", marginTop: "0.6rem" }}>
                    {r.hours}h × ${r.hourly_rate}/hr = <strong style={{ color: "#fff" }}>${r.base_pay.toLocaleString()}</strong>
                    {r.commission > 0 ? <> · commission <strong style={{ color: "#fff" }}>${r.commission.toLocaleString()}</strong></> : null}
                    {" · "}{r.days_worked}d worked · {r.shifts} shift{r.shifts === 1 ? "" : "s"}
                  </div>

                  {Object.keys(r.output || {}).length > 0 && (
                    <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.8rem", marginTop: "0.35rem" }}>
                      {SERVICE_TYPES.filter((t) => r.output[t.key]).map((t) => `${t.emoji} ${r.output[t.key]}`).join("   ")}
                    </div>
                  )}
                  {r.commission_note && <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.72rem", marginTop: "0.3rem" }}>commission rule: {r.commission_note}</div>}

                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
                    <input style={{ ...inp, marginBottom: 0, flex: 1, fontSize: "0.82rem", padding: "0.6rem 0.85rem" }} placeholder="Performance notes…" value={r.perf_notes || ""} onChange={(e) => setNote(r.staff_id, e.target.value)} onBlur={() => saveNote(r)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ---------------- WORK LOG (per-rep attribution) ---------------- */
const SERVICE_TYPES = [
  { key: "tire", label: "Tires", emoji: "🛞" },
  { key: "alignment", label: "Alignment", emoji: "🎯" },
  { key: "tpms", label: "TPMS", emoji: "💡" },
  { key: "oil", label: "Oil", emoji: "🛢️" },
  { key: "brake", label: "Brakes", emoji: "🛑" },
  { key: "lead", label: "Lead handled", emoji: "📞" },
  { key: "other", label: "Other", emoji: "➕" },
];
function WorkLogTab({ auth }) {
  const chip = { background: "rgba(255,255,255,0.05)", color: "#fff", padding: "0.45rem 0.7rem", fontSize: "0.78rem", fontWeight: 700, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 50, cursor: "pointer", fontFamily: "inherit" };
  const [entries, setEntries] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [days, setDays] = useState(0); // 0 = today
  const [form, setForm] = useState({ staff_id: "", service_type: "alignment", qty: 1, amount: "", note: "" });
  const [saving, setSaving] = useState(false);

  async function call(body) {
    const res = await fetch("/api/admin/service-log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Request failed");
    return d;
  }
  async function load(d) {
    setLoading(true); setErr("");
    try { const r = await call({ action: "list", days: d }); setEntries(r.entries); setStaff(r.staff); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(0); /* eslint-disable-next-line */ }, []);

  async function add() {
    if (!form.staff_id || !form.service_type) return;
    setSaving(true);
    try { const r = await call({ action: "add", entry: form, days }); setEntries(r.entries); setStaff(r.staff); setForm((f) => ({ ...f, qty: 1, amount: "", note: "" })); }
    catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }
  async function del(id) {
    try { const r = await call({ action: "delete", id, days }); setEntries(r.entries); setStaff(r.staff); }
    catch (e) { alert(e.message); }
  }
  function changeRange(d) { setDays(d); load(d); }

  const nameById = Object.fromEntries(staff.map((s) => [s.id, s.name]));
  const summary = {};
  for (const e of entries) {
    const sid = e.staff_id || "unassigned";
    const m = summary[sid] || (summary[sid] = { counts: {}, amount: 0 });
    m.counts[e.service_type] = (m.counts[e.service_type] || 0) + (Number(e.qty) || 0);
    m.amount += Number(e.amount) || 0;
  }
  const summaryRows = Object.entries(summary).sort((a, b) => b[1].amount - a[1].amount);

  if (loading) return <Empty>Loading work log…</Empty>;

  return (
    <>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,31,31,0.2)", borderRadius: 14, padding: "1.25rem", marginBottom: "1.5rem" }}>
        <h2 style={subHead}>Log work</h2>
        {staff.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" }}>Add staff in the 👥 Staff tab first.</p>
        ) : (
          <>
            <select style={{ ...inp, maxWidth: 240 }} value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })}>
              <option value="">Who did it?</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", margin: "0.25rem 0 0.75rem" }}>
              {SERVICE_TYPES.map((t) => {
                const on = form.service_type === t.key;
                return <button key={t.key} onClick={() => setForm({ ...form, service_type: t.key })} style={{ ...chip, ...(on ? { background: "#FF1F1F", borderColor: "#FF1F1F", color: "#fff" } : {}) }}>{t.emoji} {t.label}</button>;
              })}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <input style={{ ...inp, marginBottom: 0, width: 80 }} type="number" placeholder="Qty" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
              <input style={{ ...inp, marginBottom: 0, width: 110 }} type="number" placeholder="$ (opt)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              <input style={{ ...inp, marginBottom: 0, flex: 1, minWidth: 120 }} placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              <button onClick={add} disabled={!form.staff_id || saving} style={{ ...cta, opacity: !form.staff_id || saving ? 0.5 : 1 }}>{saving ? "…" : "Log it"}</button>
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem" }}>
        {[{ d: 0, l: "Today" }, { d: 7, l: "7 days" }, { d: 30, l: "30 days" }].map((r) => (
          <button key={r.d} onClick={() => changeRange(r.d)} style={{ ...chip, ...(days === r.d ? { background: "#fff", color: "#000", borderColor: "#fff" } : {}) }}>{r.l}</button>
        ))}
      </div>

      {err && <p style={{ color: "#FF6666" }}>⚠ {err}</p>}

      <h2 style={subHead}>Per rep ({days === 0 ? "today" : `last ${days} days`})</h2>
      {summaryRows.length === 0 ? <Empty>Nothing logged yet.</Empty> : (
        <div style={{ display: "grid", gap: "0.5rem", marginBottom: "2rem" }}>
          {summaryRows.map(([sid, m]) => (
            <div key={sid} style={{ ...rowStyle, gap: "0.75rem", flexWrap: "wrap" }}>
              <span style={{ color: "#fff", fontWeight: 700, width: 120 }}>{nameById[sid] || "Unassigned"}</span>
              <span style={{ flex: 1, color: "rgba(255,255,255,0.7)", fontSize: "0.85rem" }}>
                {SERVICE_TYPES.filter((t) => m.counts[t.key]).map((t) => `${t.emoji} ${m.counts[t.key]}`).join("   ") || "—"}
              </span>
              {m.amount > 0 && <span style={{ color: "#3DD68C", fontWeight: 700 }}>${m.amount.toLocaleString()}</span>}
            </div>
          ))}
        </div>
      )}

      <h2 style={subHead}>Recent entries</h2>
      {entries.length === 0 ? <Empty>No entries.</Empty> : (
        <div style={{ display: "grid", gap: "0.4rem" }}>
          {entries.slice(0, 50).map((e) => {
            const t = SERVICE_TYPES.find((x) => x.key === e.service_type);
            return (
              <div key={e.id} style={{ ...rowStyle, padding: "0.6rem 1rem", gap: "0.75rem" }}>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", width: 56 }}>{new Date(e.logged_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                <span style={{ color: "#fff", fontWeight: 600, fontSize: "0.85rem", flex: 1 }}>{nameById[e.staff_id] || "Unassigned"} · {t ? `${t.emoji} ${t.label}` : e.service_type} ×{e.qty}{e.note ? ` — ${e.note}` : ""}</span>
                {e.amount ? <span style={{ color: "#3DD68C", fontSize: "0.8rem" }}>${Number(e.amount).toLocaleString()}</span> : null}
                <button onClick={() => del(e.id)} style={{ ...ghostBtn, padding: "0.3rem 0.6rem", fontSize: "0.7rem" }}>✕</button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ---------------- TRAINING HUB ---------------- */
const TRAIN_CATS = [
  "Company Standards & Rules",
  "Warnings & Discipline",
  "How We Communicate",
  "How to Read a Tire",
  "Navigating the Warehouse",
  "Finalizing a POS Order",
  "Tire Installation Process",
  "Special Orders",
];

// Split guide content into "slides" — a new section starts at a #/## heading or
// a --- rule. Heading-only chunks get merged into the next slide so no slide is empty.
function hasBody(s) {
  return s.split("\n").some((l) => { const t = l.trim(); return t && !/^#{1,6}\s/.test(t) && !/^-{3,}$/.test(t); });
}
function splitSlides(content) {
  const text = (content || "").trim();
  if (!text) return ["(no content yet)"];
  const lines = text.split("\n");
  const raw = []; let cur = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^#{1,2}\s/.test(t) && cur.join("").trim()) { raw.push(cur.join("\n").trim()); cur = [line]; }
    else if (/^-{3,}$/.test(t)) { if (cur.join("").trim()) { raw.push(cur.join("\n").trim()); cur = []; } }
    else cur.push(line);
  }
  if (cur.join("").trim()) raw.push(cur.join("\n").trim());
  // merge any heading-only slide into the following one
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    if (!hasBody(raw[i]) && i < raw.length - 1) { raw[i + 1] = raw[i] + "\n\n" + raw[i + 1]; }
    else out.push(raw[i]);
  }
  return out.length ? out : [text];
}

// Lightweight markdown renderer for guide content (headings, bold, lists, simple tables).
function MD({ text }) {
  const lines = (text || "").split("\n");
  const els = []; let list = []; let listType = null;
  const flush = () => {
    if (!list.length) return;
    const Tag = listType === "ol" ? "ol" : "ul";
    els.push(<Tag key={"l" + els.length} style={{ margin: "0 0 0.6rem 1.15rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>{list}</Tag>);
    list = []; listType = null;
  };
  const inline = (s) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => /^\*\*[^*]+\*\*$/.test(p) ? <strong key={i} style={{ color: "#fff" }}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>);
  lines.forEach((raw, i) => {
    const t = raw.trim();
    const h = t.match(/^(#{1,6})\s+(.*)/);
    const ol = t.match(/^(\d+)\.\s+(.*)/);
    const ul = t.match(/^[-*]\s+(.*)/);
    if (h) { flush(); const lvl = h[1].length; els.push(<div key={i} style={{ color: "#fff", fontWeight: 800, fontSize: lvl <= 2 ? "1.02rem" : "0.92rem", margin: "0.5rem 0 0.4rem" }}>{inline(h[2])}</div>); }
    else if (ol) { if (listType !== "ol") flush(); listType = "ol"; list.push(<li key={i} style={{ marginBottom: "0.25rem" }}>{inline(ol[2])}</li>); }
    else if (ul) { if (listType !== "ul") flush(); listType = "ul"; list.push(<li key={i} style={{ marginBottom: "0.25rem" }}>{inline(ul[1])}</li>); }
    else if (/^-{3,}$/.test(t)) { /* horizontal rule — skip */ }
    else if (t.startsWith("|")) { if (!/^\|[\s:|-]+\|$/.test(t)) { flush(); const cells = t.split("|").map((c) => c.trim()).filter(Boolean); els.push(<p key={i} style={{ color: "rgba(255,255,255,0.8)", margin: "0 0 0.3rem", fontSize: "0.85rem" }}>{cells.join("  ·  ")}</p>); } }
    else if (t === "") { flush(); }
    else { flush(); els.push(<p key={i} style={{ color: "rgba(255,255,255,0.85)", margin: "0 0 0.6rem", lineHeight: 1.7 }}>{inline(t)}</p>); }
  });
  flush();
  return <div>{els}</div>;
}

// Gated slideshow: read each section (with a short read-timer) before Next; quiz unlocks at the end.
function LessonViewer({ module, passed, onTakeQuiz, onComplete, onUndo }) {
  const slides = splitSlides(module.content);
  const [idx, setIdx] = useState(0);
  const [canNext, setCanNext] = useState(false);
  useEffect(() => {
    setCanNext(false);
    const words = (slides[idx] || "").split(/\s+/).filter(Boolean).length;
    const wait = Math.min(8000, Math.max(2000, words * 90));
    const t = setTimeout(() => setCanNext(true), wait);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [idx, module.id]);
  const last = idx >= slides.length - 1;
  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: "0.7rem" }}>
        {slides.map((_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= idx ? "#FF1F1F" : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />)}
      </div>
      <div style={{ fontSize: "0.9rem", minHeight: 110, marginBottom: "0.85rem" }}><MD text={slides[idx]} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
        <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} style={{ ...ghostBtn, opacity: idx === 0 ? 0.4 : 1 }}>← Back</button>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.74rem" }}>Section {idx + 1} of {slides.length}</span>
        {!last ? (
          <button onClick={() => canNext && setIdx((i) => i + 1)} disabled={!canNext} style={{ ...cta, opacity: canNext ? 1 : 0.45 }}>{canNext ? "Next →" : "Reading…"}</button>
        ) : module.hasQuiz ? (
          <button onClick={onTakeQuiz} disabled={!canNext} style={{ ...cta, opacity: canNext ? 1 : 0.45 }}>{passed ? "Retake quiz" : "📝 Take quiz"}</button>
        ) : passed ? (
          <button onClick={onUndo} style={ghostBtn}>✓ Completed — undo</button>
        ) : (
          <button onClick={onComplete} disabled={!canNext} style={{ ...cta, opacity: canNext ? 1 : 0.45 }}>✓ Mark complete</button>
        )}
      </div>
    </div>
  );
}

function TrainingTab({ auth }) {
  const [modules, setModules] = useState([]);
  const [progress, setProgress] = useState({});
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [openedAt, setOpenedAt] = useState(Date.now());
  const [quizModId, setQuizModId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [ask, setAsk] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);

  async function api(body) {
    const res = await fetch("/api/admin/training", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    return res.json();
  }
  async function load() {
    setLoading(true);
    const d = await api({ action: "list" });
    setModules(d.modules || []); setProgress(d.progress || {}); setIsOwner(!!d.isOwner);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function openModule(id) {
    const opening = openId !== id;
    setOpenId(opening ? id : null);
    setQuizModId(null);
    if (opening) setOpenedAt(Date.now());
  }
  async function complete(id, done) { await api({ action: "complete", module_id: id, done }); load(); }
  async function saveModule(m) { await api({ action: "save", ...m }); setEditing(null); load(); }
  async function delModule(id) { if (!confirm("Delete this guide?")) return; await api({ action: "delete", id }); load(); }

  async function askTrainer() {
    if (!ask.trim()) return;
    setAsking(true); setAnswer("");
    try {
      const res = await fetch("/api/admin/train-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, mode: "ask", question: ask }) });
      const d = await res.json();
      setAnswer(d.answer || ("⚠ " + (d.error || "No answer")));
    } catch (e) { setAnswer("⚠ Network error"); }
    finally { setAsking(false); }
  }

  const byCat = {};
  modules.forEach((m) => { (byCat[m.category] = byCat[m.category] || []).push(m); });
  const cats = [...new Set([...TRAIN_CATS, ...Object.keys(byCat)])];
  const passedCount = Object.values(progress).filter((p) => p && p.passed).length;
  // Sequential lock: a guide unlocks only once every earlier guide is passed (owners see all).
  const ordered = [];
  cats.forEach((cat) => (byCat[cat] || []).forEach((m) => ordered.push(m)));
  const orderPos = {}; ordered.forEach((m, i) => { orderPos[m.id] = i; });
  let unlockedUpTo = 0;
  for (let i = 0; i < ordered.length; i++) { const p = progress[ordered[i].id]; if (p && p.passed) unlockedUpTo = i + 1; else break; }

  if (loading) return <Empty>Loading training…</Empty>;
  if (showReport) return <ReportCard auth={auth} onClose={() => setShowReport(false)} />;

  return (
    <>
      <div style={{ background: "linear-gradient(135deg, rgba(139,124,246,0.13), rgba(0,0,0,0))", border: "1px solid rgba(139,124,246,0.3)", borderRadius: 16, padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
        <p style={{ color: "#A99CF8", fontWeight: 800, fontSize: "0.74rem", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.6rem" }}>🧑‍🏫 Ask the Trainer</p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => e.key === "Enter" && askTrainer()} placeholder="e.g. What do I do when a customer has a special order?" style={{ ...inp, marginBottom: 0, flex: 1 }} />
          <button onClick={askTrainer} disabled={asking} style={cta}>{asking ? "…" : "Ask"}</button>
        </div>
        {answer && <div style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.88rem", lineHeight: 1.6, whiteSpace: "pre-wrap", marginTop: "0.85rem" }}>{answer}</div>}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>✓ {passedCount} of {modules.length} guides passed</span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {isOwner && <button onClick={() => setShowReport(true)} style={ghostBtn}>📊 Report card</button>}
          {isOwner && !editing && <button onClick={() => setEditing({ category: TRAIN_CATS[0], title: "", content: "" })} style={cta}>+ Add guide</button>}
        </div>
      </div>

      {editing && <ModuleEditor auth={auth} module={editing} onSave={saveModule} onCancel={() => setEditing(null)} />}

      {cats.map((cat) => (
        <div key={cat} style={{ marginBottom: "1.5rem" }}>
          <h2 style={subHead}>{cat}</h2>
          {(byCat[cat] || []).length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.8rem" }}>No guides yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {(byCat[cat] || []).map((m) => {
                const pr = progress[m.id];
                const locked = !isOwner && orderPos[m.id] > unlockedUpTo;
                const status = locked ? "🔒 Locked — finish the previous guide first"
                  : pr && pr.passed ? `✓ Passed${pr.score != null ? ` · ${pr.score}%` : ""}`
                  : pr && pr.score != null ? `${pr.score}% · retake to pass`
                  : m.hasQuiz ? `📝 ${m.quizCount} questions` : "Read & complete";
                return (
                  <div key={m.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: "0.5rem", opacity: locked ? 0.5 : 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${pr && pr.passed ? "#3DD68C" : "rgba(255,255,255,0.25)"}`, background: pr && pr.passed ? "#3DD68C" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontSize: "0.8rem", flexShrink: 0 }}>{locked ? "🔒" : pr && pr.passed ? "✓" : ""}</span>
                      <span onClick={() => !locked && openModule(m.id)} style={{ color: "#fff", fontWeight: 700, fontSize: "0.9rem", cursor: locked ? "default" : "pointer", flex: 1 }}>{m.title} <span style={{ color: pr && pr.passed ? "#3DD68C" : "rgba(255,255,255,0.4)", fontWeight: 500, fontSize: "0.78rem" }}>· {status}</span></span>
                      {isOwner && <button onClick={() => setEditing(m)} style={{ ...ghostBtn, fontSize: "0.68rem", padding: "0.3rem 0.6rem" }}>Edit</button>}
                      {isOwner && <button onClick={() => delModule(m.id)} style={{ background: "none", border: "none", color: "rgba(255,100,100,0.6)", cursor: "pointer", fontSize: "0.85rem" }}>✕</button>}
                      {!locked && <span onClick={() => openModule(m.id)} style={{ color: "rgba(255,255,255,0.3)", cursor: "pointer" }}>{openId === m.id ? "▲" : "▼"}</span>}
                    </div>
                    {!locked && openId === m.id && (
                      <div style={{ paddingLeft: "calc(22px + 0.75rem)" }}>
                        {quizModId === m.id ? (
                          <QuizRunner auth={auth} moduleId={m.id} startedAt={openedAt} onDone={() => load()} />
                        ) : (
                          <LessonViewer module={m} passed={pr && pr.passed} onTakeQuiz={() => setQuizModId(m.id)} onComplete={() => complete(m.id, true)} onUndo={() => complete(m.id, false)} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function QuizRunner({ auth, moduleId, startedAt, onDone }) {
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/training", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, action: "get-quiz", module_id: moduleId }) });
      const d = await res.json();
      setQuestions(d.questions || []);
    })(); /* eslint-disable-next-line */
  }, [moduleId]);

  async function submit() {
    if (Object.keys(answers).length < (questions ? questions.length : 0)) { setErr("Answer all questions first."); return; }
    setSubmitting(true); setErr("");
    const arr = questions.map((_, i) => answers[i]);
    const time_spent = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    const res = await fetch("/api/admin/training", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, action: "submit-quiz", module_id: moduleId, answers: arr, time_spent }) });
    const d = await res.json();
    setResult(d); setSubmitting(false);
    if (onDone) onDone();
  }

  if (!questions) return <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" }}>Loading quiz…</p>;
  if (!questions.length) return <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" }}>No quiz on this guide yet.</p>;

  if (result) {
    return (
      <div>
        <div style={{ color: result.passed ? "#3DD68C" : "#FF6666", fontWeight: 800, fontSize: "1.15rem", marginBottom: "0.5rem" }}>
          {result.passed ? "✓ Passed" : "✗ Not passed"} — {result.score}% ({result.correct}/{result.total})
        </div>
        {!result.passed && <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.82rem", marginBottom: "0.6rem" }}>You need {result.pass}% to pass. Review the guide and retake.</p>}
        {questions.map((q, i) => (
          <div key={i} style={{ marginBottom: "0.45rem", fontSize: "0.82rem" }}>
            <div style={{ color: result.results[i].correct ? "#3DD68C" : "#FF6666" }}>{result.results[i].correct ? "✓" : "✗"} {q.q}</div>
            {!result.results[i].correct && <div style={{ color: "rgba(255,255,255,0.6)", paddingLeft: "1.1rem" }}>Correct answer: {q.options[result.results[i].correctIndex]}</div>}
          </div>
        ))}
        <button onClick={() => { setResult(null); setAnswers({}); }} style={{ ...ghostBtn, marginTop: "0.5rem" }}>Retake</button>
      </div>
    );
  }

  return (
    <div>
      {questions.map((q, i) => (
        <div key={i} style={{ marginBottom: "0.9rem" }}>
          <div style={{ color: "#fff", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>{i + 1}. {q.q}</div>
          {q.options.map((opt, j) => (
            <label key={j} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", color: "rgba(255,255,255,0.8)", fontSize: "0.82rem", padding: "0.22rem 0", cursor: "pointer" }}>
              <input type="radio" name={`q${moduleId}_${i}`} checked={answers[i] === j} onChange={() => setAnswers((a) => ({ ...a, [i]: j }))} style={{ marginTop: 3 }} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      ))}
      {err && <p style={{ color: "#FF6666", fontSize: "0.8rem", marginBottom: "0.4rem" }}>{err}</p>}
      <button onClick={submit} disabled={submitting} style={cta}>{submitting ? "Grading…" : "Submit quiz"}</button>
    </div>
  );
}

function ReportCard({ auth, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/training", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, action: "report" }) });
      setData(await res.json());
    })(); /* eslint-disable-next-line */
  }, []);
  if (!data) return <Empty>Loading report…</Empty>;
  const total = (data.modules || []).length;
  const byEmail = {};
  (data.progress || []).forEach((p) => { (byEmail[p.email] = byEmail[p.email] || []).push(p); });
  const people = Object.entries(byEmail);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ ...subHead, margin: 0 }}>📊 Training Report Card</h2>
        <button onClick={onClose} style={ghostBtn}>← Back</button>
      </div>
      {people.length === 0 ? <Empty>No one has taken a quiz yet.</Empty> : (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {people.map(([email, rows]) => {
            const passed = rows.filter((r) => r.passed).length;
            const scored = rows.filter((r) => r.score != null);
            const avg = scored.length ? Math.round(scored.reduce((s, r) => s + (r.score || 0), 0) / scored.length) : 0;
            const mins = Math.round(rows.reduce((s, r) => s + (r.time_spent_seconds || 0), 0) / 60);
            const pct = total ? Math.round((passed / total) * 100) : 0;
            return (
              <div key={email} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.88rem" }}>{email}</span>
                  <span style={{ color: pct >= 100 ? "#3DD68C" : "rgba(255,255,255,0.7)", fontSize: "0.8rem" }}>{passed}/{total} passed · {avg}% avg · {mins}m total</span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "#3DD68C" : "#8B7CF6" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function ModuleEditor({ auth, module, onSave, onCancel }) {
  const [category, setCategory] = useState(module.category || TRAIN_CATS[0]);
  const [title, setTitle] = useState(module.title || "");
  const [content, setContent] = useState(module.content || "");
  const [bullets, setBullets] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [quiz, setQuiz] = useState(module.quiz || null);
  const [qCount, setQCount] = useState(8);
  const [genning, setGenning] = useState(false);
  const [qErr, setQErr] = useState("");

  async function aiDraft() {
    if (!title.trim()) return;
    setDrafting(true);
    try {
      const res = await fetch("/api/admin/train-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, mode: "draft", title, bullets }) });
      const d = await res.json();
      if (d.draft) setContent(d.draft);
    } catch (e) {}
    finally { setDrafting(false); }
  }
  async function genQuiz() {
    if (!content.trim()) { setQErr("Write or draft the guide first."); return; }
    setGenning(true); setQErr("");
    try {
      const res = await fetch("/api/admin/train-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, mode: "quiz", title, content, count: qCount }) });
      const d = await res.json();
      if (d.quiz) setQuiz(d.quiz); else setQErr(d.error || "Quiz generation failed.");
    } catch (e) { setQErr("Network error"); }
    finally { setGenning(false); }
  }

  const qCountActual = quiz && quiz.questions ? quiz.questions.length : 0;

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,31,31,0.25)", borderRadius: 14, padding: "1.25rem", marginBottom: "1.5rem" }}>
      <label style={fieldLabel}>Category</label>
      <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inp, appearance: "auto" }}>
        {TRAIN_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <label style={fieldLabel}>Title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. How to finalize a POS order" style={inp} />
      <label style={fieldLabel}>Quick bullets for the AI (optional)</label>
      <input value={bullets} onChange={(e) => setBullets(e.target.value)} placeholder="pull up customer, scan tires, add labor, take payment, print invoice" style={inp} />
      <button onClick={aiDraft} disabled={drafting || !title} style={{ ...ghostBtn, borderColor: "rgba(139,124,246,0.4)", color: "#A99CF8", marginBottom: "0.7rem", opacity: !title ? 0.4 : 1 }}>{drafting ? "✨ Writing the guide…" : "✨ AI draft the guide"}</button>
      <label style={fieldLabel}>Guide content</label>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} placeholder="Write the step-by-step guide, or tap ✨ AI draft above." style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />

      {/* Quiz */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.85rem", marginTop: "0.5rem" }}>
        <label style={fieldLabel}>Quiz {qCountActual > 0 ? `· ${qCountActual} questions ✓` : "(graded test on this guide)"}</label>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.6rem" }}>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}># questions (5–15):</span>
          <input type="number" min={5} max={15} value={qCount} onChange={(e) => setQCount(Math.min(15, Math.max(5, Number(e.target.value) || 5)))} style={{ ...inp, marginBottom: 0, width: 70, padding: "0.5rem" }} />
          <button onClick={genQuiz} disabled={genning} style={{ ...ghostBtn, borderColor: "rgba(139,124,246,0.4)", color: "#A99CF8" }}>{genning ? "✨ Building quiz…" : "✨ Generate quiz"}</button>
          {qErr && <span style={{ color: "#FF6666", fontSize: "0.78rem" }}>{qErr}</span>}
        </div>
        {quiz && quiz.questions && quiz.questions.map((q, i) => (
          <div key={i} style={{ fontSize: "0.78rem", marginBottom: "0.4rem", color: "rgba(255,255,255,0.6)" }}>
            <span style={{ color: "rgba(255,255,255,0.8)" }}>{i + 1}. {q.q}</span> <span style={{ color: "#3DD68C" }}>→ {q.options[q.answer]}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
        <button onClick={() => onSave({ id: module.id, category, title, content, quiz })} disabled={!title} style={{ ...cta, opacity: !title ? 0.4 : 1 }}>Save guide</button>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
      </div>
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
