import React, { useState, useEffect, useMemo, useRef } from "react";
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
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState({ leads: [], subscribers: [], campaigns: [], replies: [], reminders: [], unreadByLead: {}, team: [], me: null });
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  const authObj = () => (accessToken ? { accessToken } : { password });

  // Guard against the auth listener firing multiple times for one sign-in. Without
  // this, getSession() + several onAuthStateChange events each hit request-access,
  // generating (and emailing the owner) a fresh code each time — the user saw 4.
  const accessRequestedRef = useRef(false);

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
    // Only request access (and trigger a code email) once per sign-in.
    if (accessRequestedRef.current) return;
    accessRequestedRef.current = true;
    try {
      const res = await fetch("/api/admin/request-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken: token }) });
      const d = await res.json();
      if (d.status === "approved") loadWith({ accessToken: token });
      else if (d.status === "pending") setNeedsCode(true);
      else { setError(d.error || "Access error"); accessRequestedRef.current = false; }
    } catch (e) { setError("Network error"); accessRequestedRef.current = false; }
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
    accessRequestedRef.current = false;
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
          <h1 style={{ color: "#1a1a1a", fontWeight: 900, textTransform: "uppercase", fontSize: "1.3rem", marginBottom: "0.5rem" }}>Access <span style={{ color: "#FF1F1F" }}>Code</span></h1>
          <p style={{ color: "rgba(0,0,0,0.6)", fontSize: "0.85rem", lineHeight: 1.5, marginBottom: "1.5rem" }}>
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
          <h1 style={{ color: "#1a1a1a", textAlign: "center", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", marginBottom: "1.5rem", fontSize: "1.5rem" }}>
            Tire Plug <span style={{ color: "#FF1F1F" }}>Admin</span>
          </h1>
          <button onClick={signInGoogle} style={googleBtn}>
            <span style={{ fontWeight: 900, color: "#4285F4" }}>G</span> Sign in with Google
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.25rem 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.1)" }} /><span style={{ color: "rgba(0,0,0,0.4)", fontSize: "0.7rem" }}>OR</span><div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.1)" }} />
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
  const navCounts = { leads: liveLeads.length, subscribers: data.subscribers.length, replies: unreadReplies };
  const NAV_GROUPS = [
    { items: [ { id: "overview", icon: "🏠", label: "Overview" }, { id: "shopfloor", icon: "🔧", label: "Shop Floor" } ] },
    { title: "Sales & Customers", items: [ { id: "leads", icon: "🎯", label: "Leads" }, { id: "conversions", icon: "💸", label: "Conversions" }, { id: "ads", icon: "📣", label: "Ads" }, { id: "customers", icon: "📇", label: "Customers" }, { id: "reviews", icon: "⭐", label: "Reviews" }, { id: "subscribers", icon: "📬", label: "Subscribers" }, { id: "email", icon: "✉️", label: "Email" }, { id: "replies", icon: "💬", label: "Replies", alert: unreadReplies > 0 } ] },
    { title: "Money", items: [ { id: "pnl", icon: "📈", label: "Weekly P&L" }, { id: "costs", icon: "🧾", label: "Costs" }, { id: "payroll", icon: "💵", label: "Payroll" } ] },
    { title: "Team", items: [ { id: "staff", icon: "👥", label: "Staff" }, { id: "schedule", icon: "🗓️", label: "Schedule" }, { id: "worklog", icon: "📋", label: "Work Log" }, { id: "hiring", icon: "📝", label: "Hiring" } ] },
    { title: "Tools", items: [ { id: "training", icon: "📚", label: "Training" } ] },
  ];

  const selectedLead = data.leads.find((l) => l.id === selectedLeadId) || null;
  const auth = authObj();

  return (
    <Shell title="Tire Plug Admin">
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <aside style={{ width: 234, flexShrink: 0, background: "#fff", borderRight: "1px solid rgba(0,0,0,0.08)", padding: "1.1rem 0.85rem", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0 0.5rem 1.1rem" }}>
            <Logo size={32} />
            <span style={{ color: "#111", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.01em", fontSize: "0.98rem" }}>Tire Plug</span>
          </div>
          {NAV_GROUPS.map((grp, gi) => (
            <div key={grp.title || `g${gi}`} style={{ marginBottom: "0.35rem" }}>
              {grp.title && <div style={{ color: "rgba(0,0,0,0.38)", fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.13em", padding: "0.7rem 0.6rem 0.3rem" }}>{grp.title}</div>}
              {grp.items.map((it) => {
                const active = tab === it.id;
                const cnt = navCounts[it.id];
                return (
                  <button key={it.id} onClick={() => setTab(it.id)} style={{ display: "flex", alignItems: "center", gap: "0.6rem", width: "100%", textAlign: "left", background: active ? "#f1f2f4" : "transparent", color: active ? "#111" : "rgba(0,0,0,0.62)", fontWeight: active ? 800 : 600, border: "none", borderLeft: active ? "3px solid #FF1F1F" : "3px solid transparent", padding: "0.5rem 0.55rem", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem" }}>
                    <span style={{ fontSize: "1rem", width: 18, textAlign: "center" }}>{it.icon}</span>
                    <span style={{ flex: 1 }}>{it.label}</span>
                    {cnt ? <span style={{ background: it.alert ? "#FF1F1F" : "rgba(0,0,0,0.08)", color: it.alert ? "#fff" : "rgba(0,0,0,0.6)", fontSize: "0.62rem", fontWeight: 800, padding: "0.05rem 0.4rem", borderRadius: 50 }}>{cnt}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        <main style={{ flex: 1, minWidth: 0, padding: "1.4rem 2rem 4rem" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
            {data.me && data.me.email !== "owner" && <span style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.8rem" }}>{data.me.name}</span>}
            <button onClick={() => loadWith(authObj())} style={ghostBtn}>↻</button>
            <button onClick={signOut} style={ghostBtn}>Sign out</button>
          </div>

        {tab === "overview" && <OverviewTab auth={auth} />}
        {tab === "shopfloor" && <ShopFloorTab auth={auth} />}
        {tab === "leads" && (
          <LeadsTab data={data} dueCount={dueCount} onOpen={setSelectedLeadId} onReminder={reminderAction} onRevoke={revoke} />
        )}
        {tab === "conversions" && <ConversionsTab data={data} />}
        {tab === "ads" && <AdsTab auth={auth} />}
        {tab === "subscribers" && <SubscribersTab subs={data.subscribers} onUpdate={update} />}
        {tab === "email" && <EmailTab auth={auth} leads={data.leads} subs={data.subscribers} campaigns={data.campaigns} />}
        {tab === "replies" && <RepliesTab replies={data.replies} onUpdate={update} />}
        {tab === "training" && <TrainingTab auth={auth} />}
        {tab === "hiring" && <HiringTab />}
        {tab === "staff" && <StaffTab auth={auth} />}
        {tab === "schedule" && <ScheduleTab auth={auth} />}
        {tab === "worklog" && <WorkLogTab auth={auth} />}
        {tab === "payroll" && <PayrollTab auth={auth} />}
        {tab === "pnl" && <PnlTab auth={auth} />}
        {tab === "costs" && <CostsTab auth={auth} />}
        {tab === "customers" && <CustomersTab auth={auth} />}
        {tab === "reviews" && <ReviewsTab auth={auth} />}
        </main>
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
  SHOPPING: { rank: 2, color: "rgba(0,0,0,0.55)", label: "⚪ Shopping" },
};
function prio(l) { return PRIORITY[l.lead_priority] || { rank: 3, color: "rgba(0,0,0,0.55)", label: l.lead_priority || "—" }; }
const STATUS_LABEL = { new: "New", called: "Called", booked: "✓ Booked", dead: "Dead" };

/* ---------------- CONVERSIONS (funnel -> won deals) ---------------- */
function ConversionsTab({ data }) {
  const money = (n) => `$${(Number(n) || 0).toLocaleString()}`;
  const won = (data.leads || []).filter((l) => l.status === "booked")
    .sort((a, b) => String(b.booked_at || b.created_at || "").localeCompare(String(a.booked_at || a.created_at || "")));
  const allTotal = won.reduce((s, l) => s + Number(l.revenue_amount || 0), 0);
  const ym = new Date().toISOString().slice(0, 7);
  const monthWon = won.filter((l) => String(l.booked_at || "").slice(0, 7) === ym);
  const monthTotal = monthWon.reduce((s, l) => s + Number(l.revenue_amount || 0), 0);
  const totalLeads = (data.leads || []).length;
  const rate = totalLeads ? Math.round((won.length / totalLeads) * 100) : 0;
  const bySource = {};
  won.forEach((l) => { const sc = l.source || "unknown"; (bySource[sc] = bySource[sc] || { rev: 0, n: 0 }); bySource[sc].rev += Number(l.revenue_amount || 0); bySource[sc].n += 1; });
  const sourceRows = Object.entries(bySource).sort((a, b) => b[1].rev - a[1].rev);
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <h1 style={{ color: "#111", fontWeight: 900, fontSize: "1.4rem", margin: 0 }}>Funnel → Won Deals</h1>
      </div>
      <p style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.85rem", marginBottom: "1.25rem" }}>Leads from your CRM funnel that turned into won deals. Mark a lead as booked (with the sale amount) from the lead's page and it'll show here.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.75rem", marginBottom: "1.75rem" }}>
        <BigStat label="Won This Month" value={money(monthTotal)} color="#1a7f4b" />
        <BigStat label="Converted This Month" value={monthWon.length} color="#1a1a1a" />
        <BigStat label="Won All-Time" value={money(allTotal)} color="#1a7f4b" />
        <BigStat label="Total Conversions" value={won.length} color="#1a1a1a" />
        <BigStat label="Conversion Rate" value={`${rate}%`} color="#1a1a1a" />
      </div>
      {sourceRows.length > 0 && (
        <div style={{ marginBottom: "1.75rem" }}>
          <h2 style={subHead}>Revenue by source</h2>
          <div style={{ display: "grid", gap: "0.4rem" }}>
            {sourceRows.map(([src, v]) => (
              <div key={src} style={{ ...rowStyle, gap: "0.75rem", padding: "0.6rem 1rem" }}>
                <span style={{ flex: 1, color: "#111", fontWeight: 600, fontSize: "0.85rem" }}>{src}</span>
                <span style={{ color: "rgba(0,0,0,0.5)", fontSize: "0.78rem" }}>{v.n} deal{v.n === 1 ? "" : "s"}</span>
                <span style={{ color: "#1a7f4b", fontWeight: 800, fontSize: "0.9rem" }}>{money(v.rev)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {won.length === 0 ? <Empty>No conversions yet. When you mark a lead as booked with the sale amount, it’ll show here as a won deal with the revenue.</Empty> : (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {won.map((l) => (
            <div key={l.id} style={{ ...rowStyle, gap: "0.75rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#111", fontWeight: 700 }}>{l.name || "(lead)"} <span style={{ color: "rgba(0,0,0,0.4)", fontWeight: 500, fontSize: "0.78rem" }}>{l.phone || ""}</span></div>
                <div style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.78rem" }}>{[l.service, l.vehicle].filter(Boolean).join(" · ") || "—"}{l.source ? ` · ${l.source}` : ""}</div>
              </div>
              <span style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.75rem" }}>{l.booked_at ? new Date(l.booked_at).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}</span>
              <span style={{ color: "#1a7f4b", fontWeight: 800, fontSize: "0.95rem" }}>{money(l.revenue_amount)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const FUNNEL_META = {
  new: { label: "New", color: "#FF8844" },
  quoted: { label: "Quoted", color: "#5BC8FF" },
  follow_up: { label: "Follow-up", color: "#FFB800" },
  cold: { label: "Cold", color: "#8A94A6" },
  engaged: { label: "Replied", color: "#3DD68C" },
  won: { label: "Won", color: "#1a7f4b" },
};
// Live funnel stage from timestamps: New -> Quoted -> (30min) Follow-up -> (24h, no reply) Cold.
function funnelStage(l) {
  if (l.status === "booked") return "won";
  if (!l.quoted_at) return l.status === "called" ? "quoted" : "new";
  if (l.last_reply_at && new Date(l.last_reply_at) > new Date(l.quoted_at)) return "engaged";
  const mins = (Date.now() - new Date(l.quoted_at).getTime()) / 60000;
  if (mins < 30) return "quoted";
  if (mins < 1440) return "follow_up";
  return "cold";
}

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
  else if (["new", "quoted", "follow_up", "cold", "engaged"].includes(filter)) live = live.filter((l) => funnelStage(l) === filter);
  live = live.sort((a, b) => prio(a).rank - prio(b).rank || new Date(b.created_at) - new Date(a.created_at));

  const dead = data.leads.filter((l) => l.status === "dead");
  const chips = [
    { id: "all", label: "All" },
    { id: "hot", label: "🔴 Hot" },
    { id: "new", label: "New" },
    { id: "quoted", label: "Quoted" },
    { id: "follow_up", label: "Follow-up" },
    { id: "cold", label: "Cold" },
  ];

  return (
    <>
      {/* Recently Active team board */}
      <ActiveBoard team={data.team} me={data.me} onRevoke={onRevoke} />

      {/* Revenue summary */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <div style={{ background: "linear-gradient(135deg, rgba(61,214,140,0.12), rgba(0,0,0,0))", border: "1px solid rgba(61,214,140,0.3)", borderRadius: 14, padding: "0.85rem 1.25rem", flex: 1, minWidth: 200 }}>
          <div style={{ color: "#3DD68C", fontWeight: 900, fontSize: "1.6rem", lineHeight: 1 }}>${revenue.toLocaleString()}</div>
          <div style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>From web leads this month · {monthLeads.length} booked</div>
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
                  <span onClick={() => l && onOpen(l.id)} style={{ color: "#1a1a1a", fontWeight: 700, cursor: "pointer", fontSize: "0.88rem" }}>{l ? l.name : "(lead)"}</span>
                  <span style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.82rem" }}> — {r.note || (r.kind === "service_ready" ? "Tires are in" : "Follow up")} · {dueLabel(r.due_at)}</span>
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
          <button key={c.id} onClick={() => setFilter(c.id)} style={{ ...ghostBtn, fontSize: "0.72rem", padding: "0.55rem 0.8rem", background: filter === c.id ? "rgba(255,31,31,0.18)" : "#ffffff", borderColor: filter === c.id ? "#FF1F1F" : "rgba(0,0,0,0.1)", color: filter === c.id ? "#C20000" : "rgba(0,0,0,0.6)" }}>{c.label}</button>
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
  const fm = FUNNEL_META[funnelStage(l)];
  return (
    <div onClick={onClick} style={{ ...rowStyle, cursor: "pointer" }} className="adminRow">
      <div style={{ width: 90 }}>
        <span style={{ background: "#ffffff", border: `1px solid ${p.color}`, color: p.color, fontSize: "0.62rem", fontWeight: 800, padding: "0.25rem 0.5rem", borderRadius: 50, whiteSpace: "nowrap" }}>{p.label}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#1a1a1a", fontWeight: 700 }}>
          {l.name || "(no name)"} <span style={{ color: "rgba(0,0,0,0.42)", fontWeight: 500, fontSize: "0.8rem" }}>· {STATUS_LABEL[l.status] || l.status}</span>
          {fm && <span style={{ marginLeft: 6, background: `${fm.color}22`, color: fm.color, fontSize: "0.6rem", fontWeight: 800, padding: "0.12rem 0.5rem", borderRadius: 50 }}>{fm.label}</span>}
          {unread > 0 && <span style={{ marginLeft: 6, background: "#FF1F1F", color: "#fff", fontSize: "0.6rem", fontWeight: 800, padding: "0.1rem 0.4rem", borderRadius: 50 }}>💬 {unread}</span>}
        </div>
        <div style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.service || "—"}{l.vehicle ? ` · ${l.vehicle}` : ""}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ color: l.channel === "instagram" ? "#E1306C" : "#FF3838", fontSize: "0.82rem", fontWeight: 700 }}>{l.channel === "instagram" ? "📸 Instagram" : (l.phone || "—")}</div>
        <div style={{ color: "rgba(0,0,0,0.4)", fontSize: "0.68rem" }}>{fmtDate(l.created_at)}</div>
      </div>
      <span style={{ color: "rgba(0,0,0,0.4)", fontSize: "1.2rem" }}>›</span>
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
        <span style={{ background: "#ffffff", border: `1px solid ${p.color}`, color: p.color, fontSize: "0.65rem", fontWeight: 800, padding: "0.25rem 0.6rem", borderRadius: 50 }}>{p.label}</span>
        <h2 style={{ color: "#1a1a1a", fontWeight: 900, fontSize: "1.5rem", margin: "0.75rem 0 0.25rem" }}>{lead.name || "(no name)"}</h2>
        <p style={{ color: "rgba(0,0,0,0.55)", marginBottom: "1.25rem", fontSize: "0.9rem" }}>{fmtDate(lead.created_at, true)} · via {lead.source || "website"}</p>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {lead.phone && <a href={`tel:${lead.phone}`} style={cta}>📞 Call {lead.phone}</a>}
          {lead.email && <a href={`mailto:${lead.email}`} style={ghostBtn}>✉ Email</a>}
        </div>

        {/* Status (instant) */}
        <Section title="Status">
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {statuses.map((s) => (
              <button key={s} onClick={() => onUpdate("leads", lead.id, { status: s })}
                style={{ ...ghostBtn, background: lead.status === s ? "rgba(255,31,31,0.18)" : "#ffffff", borderColor: lead.status === s ? "#FF1F1F" : "rgba(0,0,0,0.1)", color: lead.status === s ? "#C20000" : "rgba(0,0,0,0.6)" }}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {lead.status === "booked" && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.75rem" }}>
              <span style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.85rem" }}>💵 Sale amount $</span>
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
    return `Hi ${lead.name?.split(" ")[0] || "there"}, here's your tire quote from The Tire Plug:\n\n${lines.join("\n")}\n\nText or call 562-500-4625 to lock it in!`;
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 50px 70px 24px", gap: "0.4rem", fontSize: "0.62rem", color: "rgba(0,0,0,0.45)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 0.2rem" }}>
          <span>Brand</span><span>$ Each</span><span>Qty</span><span>Total</span><span></span>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ marginBottom: "0.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 50px 70px 24px", gap: "0.4rem", alignItems: "center" }}>
              <input value={r.brand} onChange={(e) => setRow(i, "brand", e.target.value)} placeholder="Goodyear" style={miniInp} />
              <input value={r.price} onChange={(e) => setRow(i, "price", e.target.value)} placeholder="159" inputMode="decimal" style={miniInp} />
              <input value={r.qty} onChange={(e) => setRow(i, "qty", e.target.value)} inputMode="numeric" style={miniInp} />
              <span style={{ color: "#3DD68C", fontWeight: 700, fontSize: "0.82rem" }}>${((Number(r.price) || 0) * (Number(r.qty) || 0)).toLocaleString()}</span>
              <button onClick={() => removeRow(i)} style={{ background: "none", border: "none", color: "rgba(0,0,0,0.4)", cursor: "pointer", fontSize: "1rem" }}>×</button>
            </div>
            <input value={r.warranty || ""} onChange={(e) => setRow(i, "warranty", e.target.value)} placeholder="Warranty (e.g. 60,000 mi)" style={{ ...miniInp, marginTop: "0.35rem" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <button onClick={addRow} style={{ ...ghostBtn, fontSize: "0.72rem", padding: "0.4rem 0.7rem" }}>+ Add brand</button>
        {grand > 0 && <span style={{ color: "rgba(0,0,0,0.6)", fontSize: "0.8rem" }}>Top total: <strong style={{ color: "#3DD68C" }}>${grand.toLocaleString()}</strong></span>}
      </div>

      {/* Optional Road Hazard Warranty add-on */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem", background: "rgba(0,0,0,0.02)", border: "1px solid #ffffff", borderRadius: 8, padding: "0.5rem 0.7rem" }}>
        <span style={{ color: "rgba(0,0,0,0.62)", fontSize: "0.78rem", flex: 1 }}>🛡️ Road Hazard Warranty</span>
        <span style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.78rem" }}>$</span>
        <input value={roadHazard} onChange={(e) => setRoadHazard(e.target.value)} placeholder="0" inputMode="decimal" style={{ ...miniInp, width: 70 }} />
        <span style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.72rem" }}>/ tire</span>
      </div>

      {/* Add-on services */}
      <div style={{ marginBottom: "0.85rem" }}>
        <p style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>Add-on services</p>
        {[
          { key: "alignment", label: "🎯 Wheel Alignment" },
          { key: "oilChange", label: "🛢️ Oil Change" },
        ].map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", background: "rgba(0,0,0,0.02)", border: "1px solid #ffffff", borderRadius: 8, padding: "0.45rem 0.7rem" }}>
            <span style={{ color: "rgba(0,0,0,0.62)", fontSize: "0.78rem", flex: 1 }}>{s.label}</span>
            <span style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.78rem" }}>$</span>
            <input value={services[s.key] || ""} onChange={(e) => setSvc(s.key, e.target.value)} placeholder="0" inputMode="decimal" style={{ ...miniInp, width: 70 }} />
          </div>
        ))}
        {/* TPMS — set of 4 OR each */}
        <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid #ffffff", borderRadius: 8, padding: "0.45rem 0.7rem" }}>
          <span style={{ color: "rgba(0,0,0,0.62)", fontSize: "0.78rem" }}>💡 TPMS Sensors</span>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.4rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.72rem" }}>Set of 4 $</span>
              <input value={services.tpmsSet || ""} onChange={(e) => setSvc("tpmsSet", e.target.value)} placeholder="199" inputMode="decimal" style={{ ...miniInp, width: 60 }} />
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.72rem" }}>Each $</span>
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

  // Drop the location/booking prompt into the box (fixed template).
  function fillLocation() {
    const fn = (lead.name || "").split(" ")[0] || "there";
    setDraft(`Hi ${fn}! We're at The Tire Plug — 2331 E Olympic Blvd, Los Angeles. What day and time works best for you and we'll get you set up?`);
    setDraftKind("manual");
  }

  return (
    <Section title={isIg ? "📸 Instagram DM" : "Text messages"}>
      {!lead.phone && !isIg ? (
        <p style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.82rem" }}>No phone number on file for this lead.</p>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 260, overflowY: "auto", marginBottom: "0.75rem", padding: thread.length ? "0.25rem" : 0 }}>
            {thread.length === 0 && <p style={{ color: "rgba(0,0,0,0.42)", fontSize: "0.8rem" }}>No texts yet. Send the first one below 👇</p>}
            {thread.map((m) => (
              <div key={m.id} style={{ alignSelf: m.direction === "outbound" ? "flex-end" : "flex-start", maxWidth: "80%", background: m.direction === "outbound" ? "linear-gradient(180deg,#C20000,#8B0000)" : "#ffffff", color: "#1a1a1a", padding: "0.5rem 0.8rem", borderRadius: 14, fontSize: "0.85rem", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
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
          {draftKind === "quote" && draft && <p style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.68rem", marginTop: "0.35rem" }}>Sending this will start the 30min / 4hr / 12hr follow-ups (canceled if they reply).</p>}
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
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#ffffff", borderRadius: 8, padding: "0.5rem 0.75rem" }}>
              <span>{r.kind === "service_ready" ? "🛞" : "📞"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#1a1a1a", fontSize: "0.82rem" }}>{r.note || (r.kind === "service_ready" ? "Tires are in — come in" : "Follow up")}</div>
                <div style={{ color: isDueOrOverdue(r.due_at) ? "#FFB800" : "rgba(0,0,0,0.45)", fontSize: "0.7rem" }}>{dueLabel(r.due_at)}</div>
              </div>
              <button onClick={() => onReminder({ action: "complete", id: r.id })} style={{ ...ghostBtn, fontSize: "0.68rem", padding: "0.3rem 0.6rem" }}>Done</button>
            </div>
          ))}
        </div>
      )}
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reminder note (optional)" style={{ ...inp, marginBottom: "0.5rem" }} />
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.5rem" }}>
        <button onClick={() => setKind("followup")} style={{ ...ghostBtn, flex: 1, fontSize: "0.72rem", background: kind === "followup" ? "rgba(255,31,31,0.18)" : "#ffffff", borderColor: kind === "followup" ? "#FF1F1F" : "rgba(0,0,0,0.1)" }}>📞 General follow-up</button>
        <button onClick={() => setKind("service_ready")} style={{ ...ghostBtn, flex: 1, fontSize: "0.72rem", background: kind === "service_ready" ? "rgba(255,31,31,0.18)" : "#ffffff", borderColor: kind === "service_ready" ? "#FF1F1F" : "rgba(0,0,0,0.1)" }}>🛞 Tires are in</button>
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
            <div style={{ color: "#1a1a1a", fontWeight: 700 }}>{s.name || "(no name)"}</div>
            <div style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.8rem" }}>{s.email}</div>
          </div>
          <span style={{ color: "rgba(0,0,0,0.4)", fontSize: "0.7rem", marginRight: "0.5rem" }}>{fmtDate(s.created_at)}</span>
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
              <button key={a.id} onClick={() => setAudience(a.id)} style={{ ...ghostBtn, flex: 1, background: audience === a.id ? "rgba(255,31,31,0.18)" : "#ffffff", borderColor: audience === a.id ? "#FF1F1F" : "rgba(0,0,0,0.1)" }}>
                {a.label} <span style={{ color: "rgba(0,0,0,0.55)" }}>({a.n})</span>
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
          <p style={{ color: "rgba(0,0,0,0.42)", fontSize: "0.72rem", marginTop: "0.4rem" }}>Your message gets wrapped in the red/black Tire Plug email design automatically. Replies come back to you.</p>
        </div>

        {!confirm ? (
          <button onClick={() => setConfirm(true)} disabled={!subject || !message} style={{ ...cta, opacity: !subject || !message ? 0.4 : 1 }}>Review &amp; send</button>
        ) : (
          <div style={{ background: "rgba(255,31,31,0.08)", border: "1px solid rgba(255,31,31,0.3)", borderRadius: 12, padding: "1rem" }}>
            <p style={{ color: "#1a1a1a", fontSize: "0.9rem", marginBottom: "0.75rem" }}>
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
                  <div style={{ color: "#1a1a1a", fontWeight: 600, fontSize: "0.85rem" }}>{c.subject}</div>
                  <div style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.72rem" }}>to {c.audience} · {fmtDate(c.created_at, true)}</div>
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
        <div key={r.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: "0.4rem", background: r.read ? "rgba(0,0,0,0.02)" : "rgba(255,31,31,0.05)", borderColor: r.read ? "rgba(0,0,0,0.08)" : "rgba(255,31,31,0.25)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ color: "#1a1a1a", fontWeight: 700 }}>{r.from_name || r.from_email}</span>
              {r.from_name && <span style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.78rem" }}> · {r.from_email}</span>}
            </div>
            <span style={{ color: "rgba(0,0,0,0.4)", fontSize: "0.7rem" }}>{fmtDate(r.created_at, true)}</span>
          </div>
          <div style={{ color: "rgba(0,0,0,0.62)", fontSize: "0.82rem", fontWeight: 600 }}>{r.subject}</div>
          <div style={{ color: "rgba(0,0,0,0.6)", fontSize: "0.82rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{r.body}</div>
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
/* ---------------- OVERVIEW (command center) ---------------- */
function OverviewTab({ auth }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/ceo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth }) });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Could not load");
        if (on) setD(j);
      } catch (e) { if (on) setErr(e.message); }
      finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
    /* eslint-disable-next-line */
  }, []);
  const ls = (d && d.leadStats) || {}, ops = (d && d.ops) || {};
  const jobs = ops.jobs || {};
  return (
    <>
      <h1 style={{ color: "#111", fontWeight: 900, fontSize: "1.5rem", margin: "0 0 1.25rem" }}>Overview</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.75rem" }}>
        <BigStat label="Active Leads" value={ls.activeLeads != null ? ls.activeLeads : "—"} color="#1a1a1a" />
        <BigStat label="Jobs In Bay" value={jobs.in_bay != null ? jobs.in_bay : "—"} color="#1a1a1a" />
        <BigStat label="Due For Tires" value={ops.dueForTires != null ? ops.dueForTires : "—"} color="#FF1F1F" />
      </div>
      <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16, padding: "1.25rem 1.5rem" }}>
        <div style={{ color: "#111", fontWeight: 800, fontSize: "0.78rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.75rem" }}>🧠 CEO Agent · today's briefing</div>
        {loading ? <Empty>Reading every department…</Empty> : err ? <p style={{ color: "#FF6666" }}>⚠ {err}</p> : (
          <div style={{ color: "rgba(0,0,0,0.78)", fontSize: "0.92rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{d.briefing}</div>
        )}
      </div>
    </>
  );
}

/* ---------------- SHOP FLOOR / WORK ORDERS ---------------- */
const WO_COLS = [
  { k: "waiting", l: "Waiting", c: "#FFB800" },
  { k: "in_bay", l: "In Bay", c: "#5BC8FF" },
  { k: "done", l: "Done", c: "#3DD68C" },
];
function woMins(iso) {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function ShopFloorTab({ auth }) {
  const chip = { background: "#ffffff", color: "#1a1a1a", padding: "0.45rem 0.7rem", fontSize: "0.78rem", fontWeight: 700, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 50, cursor: "pointer", fontFamily: "inherit" };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [loc, setLoc] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ customer_name: "", phone: "", vehicle: "", service: "", location: "Olympic", assigned_staff_id: "", note: "" });

  async function call(body) {
    const res = await fetch("/api/admin/work-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  }
  async function load(silent) {
    if (!silent) setLoading(true);
    try { setData(await call({ action: "list" })); setErr(""); }
    catch (e) { setErr(e.message); }
    finally { if (!silent) setLoading(false); }
  }
  useEffect(() => { load(); const t = setInterval(() => load(true), 20000); return () => clearInterval(t); /* eslint-disable-next-line */ }, []);

  async function create() {
    if (!form.customer_name && !form.vehicle) return;
    try { setData(await call({ action: "create", order: form })); setForm({ customer_name: "", phone: "", vehicle: "", service: "", location: form.location, assigned_staff_id: "", note: "" }); setShowNew(false); }
    catch (e) { alert(e.message); }
  }
  async function act(body) { try { setData(await call(body)); } catch (e) { alert(e.message); } }

  if (loading && !data) return <Empty>Loading the shop floor…</Empty>;
  const d = data || { orders: [], staff: [] };
  const nameById = Object.fromEntries(d.staff.map((s) => [s.id, s.name]));
  const orders = d.orders.filter((o) => loc === "all" || o.location === loc);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {["all", "Olympic"].map((l) => <button key={l} onClick={() => setLoc(l)} style={{ ...chip, ...(loc === l ? { background: "#1a1a1a", color: "#fff", borderColor: "#1a1a1a" } : {}) }}>{l === "all" ? "All" : l}</button>)}
        </div>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <span style={{ color: "rgba(0,0,0,0.42)", fontSize: "0.72rem" }}>auto-refreshes</span>
          <button onClick={() => setShowNew((s) => !s)} style={cta}>{showNew ? "✕ Close" : "+ New work order"}</button>
        </div>
      </div>

      {showNew && (
        <div style={{ background: "#ffffff", border: "1px solid rgba(255,31,31,0.2)", borderRadius: 14, padding: "1.1rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <input style={inp} placeholder="Customer name" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            <input style={inp} placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input style={inp} placeholder="Vehicle (e.g. 2019 Camry)" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} />
            <input style={inp} placeholder="Service (4 tires + align)" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} />
            <select style={inp} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}><option value="Olympic">Olympic</option></select>
            <select style={inp} value={form.assigned_staff_id} onChange={(e) => setForm({ ...form, assigned_staff_id: e.target.value })}><option value="">Assign tech…</option>{d.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </div>
          <button onClick={create} disabled={!form.customer_name && !form.vehicle} style={{ ...cta, marginTop: "0.5rem", opacity: (!form.customer_name && !form.vehicle) ? 0.5 : 1 }}>Add to board</button>
        </div>
      )}

      {err && <p style={{ color: "#FF6666" }}>⚠ {err}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
        {WO_COLS.map((col) => {
          const items = orders.filter((o) => o.status === col.k);
          return (
            <div key={col.k}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: col.c }} />
                <span style={{ color: "#1a1a1a", fontWeight: 800, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>{col.l}</span>
                <span style={{ color: "rgba(0,0,0,0.42)" }}>{items.length}</span>
              </div>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {items.length === 0 && <div style={{ color: "rgba(0,0,0,0.2)", fontSize: "0.8rem", padding: "0.5rem" }}>—</div>}
                {items.map((o) => {
                  const t = o.status === "done" ? o.done_at : o.status === "in_bay" ? o.started_at : o.created_at;
                  return (
                    <div key={o.id} style={{ background: "#ffffff", border: `1px solid ${col.c}33`, borderRadius: 12, padding: "0.75rem 0.85rem" }}>
                      <div style={{ color: "#1a1a1a", fontWeight: 700, fontSize: "0.86rem" }}>{o.customer_name || "—"} {o.location && <span style={{ color: "rgba(0,0,0,0.4)", fontWeight: 500, fontSize: "0.72rem" }}>{o.location}</span>}</div>
                      {o.vehicle && <div style={{ color: "rgba(0,0,0,0.62)", fontSize: "0.78rem" }}>{o.vehicle}</div>}
                      {o.service && <div style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.78rem" }}>{o.service}</div>}
                      <div style={{ color: "rgba(0,0,0,0.42)", fontSize: "0.7rem", margin: "0.3rem 0" }}>{woMins(t)} {o.assigned_staff_id ? `· ${nameById[o.assigned_staff_id] || "tech"}` : ""}</div>
                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                        <select value={o.assigned_staff_id || ""} onChange={(e) => act({ action: "assign", id: o.id, assigned_staff_id: e.target.value })} style={{ ...inp, marginBottom: 0, padding: "0.3rem 0.5rem", fontSize: "0.72rem", width: 110 }}>
                          <option value="">tech…</option>{d.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        {o.status === "waiting" && <button onClick={() => act({ action: "setStatus", id: o.id, status: "in_bay" })} style={{ ...chip, padding: "0.3rem 0.6rem" }}>▶ In Bay</button>}
                        {o.status === "in_bay" && <button onClick={() => act({ action: "setStatus", id: o.id, status: "done" })} style={{ ...chip, padding: "0.3rem 0.6rem", background: "#1f7a4d", borderColor: "#1f7a4d" }}>✓ Done</button>}
                        {o.status === "done" && <button onClick={() => act({ action: "archive", id: o.id })} style={{ ...chip, padding: "0.3rem 0.6rem" }}>Clear</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function BigStat({ label, value, color }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16, padding: "1.25rem 1.5rem" }}>
      <div style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.4rem" }}>{label}</div>
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
        <span style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.8rem" }}>
          👥 {activeList.length} active · <span style={{ color: "#3DD68C" }}>{activeList.filter((s) => s.clocked_in).length} on the clock</span>
        </span>
        {!editing && (
          <button onClick={() => setEditing({ active: true, location: "Olympic", pay_type: "hourly_commission" })} style={cta}>+ Add staff</button>
        )}
      </div>
      <p style={{ color: "rgba(0,0,0,0.42)", fontSize: "0.75rem", marginBottom: "1.25rem" }}>
        Clock-in kiosk for the shop tablet: <span style={{ color: "#FF6666" }}>tireplugla.com/clock</span> — staff punch in/out with their PIN.
      </p>

      {editing && (
        <div style={{ background: "#ffffff", border: "1px solid rgba(255,31,31,0.2)", borderRadius: 14, padding: "1.25rem", marginBottom: "1.5rem" }}>
          <h2 style={subHead}>{editing.id ? "Edit" : "New"} staff member</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
            <StaffField label="Name"><input style={inp} value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></StaffField>
            <StaffField label="Role"><input style={inp} placeholder="Tire Technician" value={editing.role || ""} onChange={(e) => setEditing({ ...editing, role: e.target.value })} /></StaffField>
            <StaffField label="Location">
              <select style={inp} value={editing.location || ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })}>
                <option value="Olympic">Olympic</option>
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
      <div style={{ color: "rgba(0,0,0,0.5)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.25rem" }}>{label}</div>
      {children}
    </div>
  );
}
function StaffRow({ s, onEdit, onToggle }) {
  return (
    <div style={{ ...rowStyle, gap: "0.75rem" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#1a1a1a", fontWeight: 700 }}>
          {s.name} <span style={{ color: "rgba(0,0,0,0.42)", fontWeight: 500, fontSize: "0.8rem" }}>{s.role || ""}</span>
          {s.clocked_in && <span style={{ marginLeft: 8, color: "#3DD68C", fontSize: "0.7rem", fontWeight: 700 }}>● on the clock</span>}
        </div>
        <div style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.78rem" }}>
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
  const chip = { background: "#ffffff", color: "#1a1a1a", padding: "0.45rem 0.7rem", fontSize: "0.78rem", fontWeight: 700, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 50, cursor: "pointer", fontFamily: "inherit" };
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
          <span style={{ color: "#1a1a1a", fontWeight: 700, fontSize: "0.9rem" }}>Week of {weekStart.toLocaleDateString([], { month: "short", day: "numeric" })}</span>
          <button onClick={() => shiftWeek(1)} style={chip}>›</button>
          <button onClick={() => setWeekStart(mondayOf(new Date()))} style={{ ...chip, marginLeft: "0.4rem" }}>This week</button>
        </div>
        <p style={{ color: "rgba(0,0,0,0.42)", fontSize: "0.72rem", margin: 0 }}>📲 Auto-texts each tech their shift each morning.</p>
      </div>

      {err && <p style={{ color: "#FF6666" }}>⚠ {err}</p>}
      {loading ? <Empty>Loading schedule…</Empty> : staff.length === 0 ? <Empty>Add staff in the 👥 Staff tab first.</Empty> : (
        <div style={{ display: "grid", gap: "0.6rem" }}>
          {days.map((d, i) => {
            const ds = ymd(d);
            const dayShifts = byDate[ds] || [];
            const isToday = ds === todayStr;
            return (
              <div key={ds} style={{ background: "#ffffff", border: `1px solid ${isToday ? "rgba(255,31,31,0.35)" : "rgba(0,0,0,0.08)"}`, borderRadius: 12, padding: "0.85rem 1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: dayShifts.length || adding === ds ? "0.6rem" : 0 }}>
                  <span style={{ color: isToday ? "#C20000" : "#1a1a1a", fontWeight: 800, fontSize: "0.85rem" }}>
                    {dayNames[i]} {d.toLocaleDateString([], { month: "short", day: "numeric" })}{isToday ? " · today" : ""}
                  </span>
                  <button onClick={() => { setAdding(adding === ds ? null : ds); setForm((f) => ({ ...f, staff_id: "" })); }} style={chip}>{adding === ds ? "✕" : "＋ shift"}</button>
                </div>

                {dayShifts.map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.35rem 0" }}>
                    <span style={{ color: "#1a1a1a", fontWeight: 600, fontSize: "0.85rem", flex: 1 }}>
                      {nameById[s.staff_id] || "—"} <span style={{ color: "rgba(0,0,0,0.55)", fontWeight: 400 }}>{[s.start_time, s.end_time].filter(Boolean).join("–")}{s.location ? ` · ${s.location}` : ""}</span>
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

/* ---------------- CUSTOMERS (reactivation engine) ---------------- */
const CUST_SEGS = [
  { k: "all", l: "All" },
  { k: "due_tires", l: "🛞 Due for tires" },
  { k: "lapsed", l: "👋 Lapsed 12mo+" },
  { k: "recent", l: "⭐ Recent" },
  { k: "vip", l: "👑 VIP" },
  { k: "commercial", l: "🏢 Commercial" },
];
function CustomersTab({ auth }) {
  const chip = { background: "#ffffff", color: "#1a1a1a", padding: "0.45rem 0.7rem", fontSize: "0.78rem", fontWeight: 700, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 50, cursor: "pointer", fontFamily: "inherit" };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [seg, setSeg] = useState("all");
  const [months, setMonths] = useState(24);
  const [syncing, setSyncing] = useState(false);
  const [showCampaign, setShowCampaign] = useState(false);

  async function call(body) {
    const res = await fetch("/api/admin/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  }
  async function load() {
    setLoading(true); setErr("");
    try { setData(await call({ action: "list" })); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function sync() {
    setSyncing(true); setErr("");
    try {
      const res = await fetch("/api/admin/sync-customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, months }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Sync failed");
      await load();
    } catch (e) { setErr(e.message); }
    finally { setSyncing(false); }
  }
  async function toggleCommercial(c) {
    const val = !c.is_commercial;
    setData((d) => ({ ...d, customers: d.customers.map((x) => x.id === c.id ? { ...x, is_commercial: val, segments: val ? [...new Set([...x.segments, "commercial"])] : x.segments.filter((s) => s !== "commercial") } : x), counts: { ...d.counts, commercial: d.counts.commercial + (val ? 1 : -1) } }));
    try { await call({ action: "setFlag", id: c.id, is_commercial: val }); } catch (e) { alert(e.message); load(); }
  }
  async function acceptSuggested() { try { await call({ action: "applySuggested" }); await load(); } catch (e) { alert(e.message); } }
  function copyNumbers(list) {
    const nums = list.map((c) => c.phone).filter(Boolean);
    navigator.clipboard?.writeText(nums.join("\n"));
    alert(`Copied ${nums.length} phone numbers — paste into your dialer or call list.`);
  }

  const money = (n) => `$${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  if (loading) return <Empty>Loading customers…</Empty>;
  const d = data || { customers: [], counts: {}, avgTicket: 0, duePotential: 0 };

  if (!d.customers.length) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
        <p style={{ color: "rgba(0,0,0,0.6)", marginBottom: "1.25rem" }}>No customer list yet. Build it from your TireBase order history.</p>
        <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
          {[12, 24, 36, 48].map((m) => <button key={m} onClick={() => setMonths(m)} style={{ ...chip, ...(months === m ? { background: "#1a1a1a", color: "#fff", borderColor: "#1a1a1a" } : {}) }}>{m} mo</button>)}
        </div>
        <button onClick={sync} disabled={syncing} style={{ ...cta, opacity: syncing ? 0.6 : 1 }}>{syncing ? "Syncing… (may take a minute)" : `Sync ${months} months from TireBase`}</button>
        {err && <p style={{ color: "#FF6666", marginTop: "1rem" }}>⚠ {err}</p>}
      </div>
    );
  }

  const list = d.customers.filter((c) => seg === "all" || c.segments.includes(seg));
  const shown = list.slice(0, 200);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        <span style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.8rem" }}>📇 {d.counts.all} customers · avg ticket {money(d.avgTicket)}</span>
        <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", flexWrap: "wrap" }}>
          {[12, 24, 36, 48].map((m) => <button key={m} onClick={() => setMonths(m)} style={{ ...chip, padding: "0.3rem 0.55rem", ...(months === m ? { background: "rgba(0,0,0,0.18)" } : {}) }}>{m}mo</button>)}
          <button onClick={sync} disabled={syncing} style={{ ...ghostBtn, opacity: syncing ? 0.6 : 1 }}>{syncing ? "Syncing…" : "↻ Re-sync"}</button>
        </div>
      </div>

      {/* Due-for-tires potential */}
      <div style={{ background: "rgba(255,42,42,0.08)", border: "1px solid rgba(255,42,42,0.3)", borderRadius: 16, padding: "1.1rem 1.4rem", marginBottom: "1.25rem" }}>
        <div style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>🛞 Due for tires (3+ yrs since last set)</div>
        <div style={{ color: "#FF6B6B", fontWeight: 900, fontSize: "1.7rem", lineHeight: 1.1 }}>{d.counts.due_tires || 0} customers · ~{money(d.duePotential)} potential</div>
        <div style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.72rem", marginTop: "0.25rem" }}>estimate = due customers × avg ticket · call list ready below</div>
      </div>

      {/* Suggested commercial */}
      {d.counts.suggested > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(91,200,255,0.08)", border: "1px solid rgba(91,200,255,0.3)", borderRadius: 12, padding: "0.7rem 1rem", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <span style={{ color: "#9ad5ff", fontSize: "0.84rem" }}>🏢 {d.counts.suggested} accounts look commercial (business name / repeat volume)</span>
          <button onClick={acceptSuggested} style={cta}>Mark all as commercial</button>
        </div>
      )}

      {/* Segment chips */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {CUST_SEGS.map((s) => (
          <button key={s.k} onClick={() => setSeg(s.k)} style={{ ...chip, ...(seg === s.k ? { background: "#1a1a1a", color: "#fff", borderColor: "#1a1a1a" } : {}) }}>
            {s.l} <span style={{ opacity: 0.6 }}>{s.k === "all" ? d.counts.all : (d.counts[s.k] || 0)}</span>
          </button>
        ))}
        <button onClick={() => copyNumbers(list)} style={{ ...chip, marginLeft: "auto" }}>📋 Copy {list.length} numbers</button>
      </div>

      <div style={{ marginBottom: "1.25rem" }}>
        <button onClick={() => setShowCampaign((s) => !s)} style={cta}>📣 {showCampaign ? "Close campaign" : `Send a campaign to ${CUST_SEGS.find((s) => s.k === seg)?.l || seg}`}</button>
      </div>
      {showCampaign && <CampaignPanel auth={auth} segment={seg} label={CUST_SEGS.find((s) => s.k === seg)?.l || seg} />}

      {err && <p style={{ color: "#FF6666" }}>⚠ {err}</p>}

      <div style={{ display: "grid", gap: "0.4rem" }}>
        {shown.map((c) => (
          <div key={c.id} style={{ ...rowStyle, gap: "0.6rem", padding: "0.6rem 1rem" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#1a1a1a", fontWeight: 700, fontSize: "0.86rem" }}>
                {c.name} {c.is_commercial && <span style={{ color: "#5BC8FF", fontSize: "0.7rem" }}>🏢</span>}
                {c.sms_opt_in && <span style={{ color: "#3DD68C", fontSize: "0.65rem", marginLeft: 4 }}>opt-in✓</span>}
              </div>
              <div style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.75rem" }}>
                {c.phone || "no phone"} · {money(c.total_spent)} lifetime · {c.order_count} orders
                {c.last_tire_date ? ` · tires ${c.last_tire_date}` : ""}
              </div>
            </div>
            <button onClick={() => toggleCommercial(c)} style={{ ...ghostBtn, padding: "0.3rem 0.6rem", fontSize: "0.7rem", ...(c.is_commercial ? { borderColor: "#5BC8FF", color: "#9ad5ff" } : {}) }}>
              {c.is_commercial ? "Commercial ✓" : "Mark commercial"}
            </button>
          </div>
        ))}
      </div>
      {list.length > shown.length && <p style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.78rem", marginTop: "0.75rem" }}>Showing first 200 of {list.length}. Use “Copy numbers” for the full list.</p>}
    </>
  );
}

function CampaignPanel({ auth, segment, label }) {
  const [channel, setChannel] = useState("sms");
  const [recip, setRecip] = useState(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState("");
  const [confirm, setConfirm] = useState(false);

  async function call(b) {
    const res = await fetch("/api/admin/campaign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, segment, channel, ...b }) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  }
  async function loadRecip() { try { setRecip(await call({ action: "recipients" })); } catch (e) { setRecip(null); } }
  useEffect(() => { setConfirm(false); setResult(""); loadRecip(); /* eslint-disable-next-line */ }, [channel, segment]);

  async function draft() {
    setBusy("draft");
    try { const r = await call({ action: "draft" }); setBody(r.body || ""); if (r.subject) setSubject(r.subject); }
    catch (e) { alert(e.message); }
    finally { setBusy(""); }
  }
  async function send() {
    setBusy("send"); setResult("");
    try { const r = await call({ action: "send", body, subject }); setResult(`✅ Sent ${r.sent} of ${r.reachable}${r.failed ? ` · ${r.failed} failed` : ""}.`); setConfirm(false); }
    catch (e) { alert(e.message); }
    finally { setBusy(""); }
  }

  const n = recip ? recip.reachable : 0;
  return (
    <div style={{ background: "#ffffff", border: "1px solid rgba(255,31,31,0.25)", borderRadius: 14, padding: "1.25rem", marginBottom: "1.25rem" }}>
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem" }}>
        {["sms", "email"].map((ch) => (
          <button key={ch} onClick={() => setChannel(ch)} style={{ background: channel === ch ? "#FF1F1F" : "#ffffff", color: "#1a1a1a", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 50, padding: "0.4rem 0.9rem", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>{ch === "sms" ? "📲 SMS" : "✉️ Email"}</button>
        ))}
      </div>

      <p style={{ color: "rgba(0,0,0,0.6)", fontSize: "0.8rem", marginBottom: "0.5rem" }}>
        <strong style={{ color: "#1a1a1a" }}>{label}</strong>: {recip ? `${recip.total} customers · ` : ""}
        <strong style={{ color: n ? "#3DD68C" : "#FF6666" }}>{n} reachable by {channel === "sms" ? "text" : "email"}</strong>
      </p>
      {channel === "sms" && <p style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.72rem", marginBottom: "0.75rem" }}>SMS sends only to opted-in customers. Delivery requires your A2P campaign to be approved.</p>}
      {channel === "email" && <p style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.72rem", marginBottom: "0.75rem" }}>Email sends to customers with an address on file (most TireBase customers have none yet).</p>}

      {channel === "email" && <input style={{ ...inp }} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />}
      <textarea style={{ ...inp, minHeight: 110, resize: "vertical" }} placeholder="Your message… use {name} for the first name" value={body} onChange={(e) => setBody(e.target.value)} />
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button onClick={draft} disabled={busy === "draft"} style={ghostBtn}>{busy === "draft" ? "Writing…" : "🤖 Draft with AI"}</button>
        {!confirm ? (
          <button onClick={() => setConfirm(true)} disabled={!body.trim() || !n} style={{ ...cta, opacity: !body.trim() || !n ? 0.5 : 1 }}>Send…</button>
        ) : (
          <button onClick={send} disabled={busy === "send"} style={{ ...cta, background: "#C20000" }}>{busy === "send" ? "Sending…" : `Confirm — send to ${n}`}</button>
        )}
      </div>
      {result && <p style={{ color: "#3DD68C", marginTop: "0.75rem", fontWeight: 700 }}>{result}</p>}
    </div>
  );
}

/* ---------------- REVIEWS & REFERRALS ---------------- */
function ReviewsTab({ auth }) {
  const [s, setS] = useState({ review_url_olympic: "", booking_url: "" });
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState("");
  async function call(b) { const res = await fetch("/api/admin/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...b }) }); const j = await res.json(); if (!res.ok) throw new Error(j.error || "Request failed"); return j; }
  useEffect(() => { call({ action: "getSettings" }).then((d) => { setS(d); setLoaded(true); }).catch(() => setLoaded(true)); /* eslint-disable-next-line */ }, []);
  async function save() { try { await call({ action: "setSettings", ...s }); setSaved("Saved ✓"); setTimeout(() => setSaved(""), 2000); } catch (e) { alert(e.message); } }
  async function toggleAuto(on) { const ns = { ...s, auto_reviews: on ? "on" : "off" }; setS(ns); try { await call({ action: "setSettings", ...ns }); } catch (e) { alert(e.message); } }
  if (!loaded) return <Empty>Loading…</Empty>;
  return (
    <>
      <div style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 14, padding: "1.1rem 1.25rem", marginBottom: "1.5rem" }}>
        <h2 style={subHead}>Links</h2>
        <div style={{ color: "rgba(0,0,0,0.5)", fontSize: "0.7rem", marginBottom: "0.25rem" }}>GOOGLE REVIEW LINK — OLYMPIC (DOWNTOWN)</div>
        <input style={inp} placeholder="Olympic shop Google review link" value={s.review_url_olympic || ""} onChange={(e) => setS({ ...s, review_url_olympic: e.target.value })} />
        <div style={{ color: "rgba(0,0,0,0.5)", fontSize: "0.7rem", margin: "0.25rem 0" }}>BOOKING LINK (for referrals)</div>
        <input style={inp} placeholder="https://tireplugla.com/#booking" value={s.booking_url} onChange={(e) => setS({ ...s, booking_url: e.target.value })} />
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.4rem" }}>
          <button onClick={save} style={cta}>Save links</button>
          {saved && <span style={{ color: "#3DD68C", fontSize: "0.82rem", fontWeight: 700 }}>{saved}</span>}
        </div>
        {!s.review_url_olympic && <p style={{ color: "#FFB800", fontSize: "0.75rem", marginTop: "0.5rem" }}>⚠ Add your Google review link so review requests include it. (Find it in your shop's Google Business profile → Ask for reviews.)</p>}
      </div>

      <div style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 14, padding: "1.1rem 1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#111", fontWeight: 800, fontSize: "0.95rem" }}>🤖 Auto-ask for reviews (daily)</div>
          <div style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.82rem", marginTop: "0.2rem", maxWidth: 580 }}>Each morning, automatically asks recent customers (not already asked) for a Google review — texts opted-in customers, emails those with an address. Needs your review link above; SMS delivers once your A2P campaign is approved.</div>
        </div>
        <button onClick={() => toggleAuto(s.auto_reviews !== "on")} style={{ ...cta, background: s.auto_reviews === "on" ? "#1a7f4b" : "#8A94A6", whiteSpace: "nowrap" }}>{s.auto_reviews === "on" ? "● ON" : "Turn ON"}</button>
      </div>

      <h2 style={subHead}>⭐ Ask recent customers for a review</h2>
      <ReviewSend auth={auth} mode="review" />

      <h2 style={{ ...subHead, marginTop: "2rem" }}>🤝 Refer a friend</h2>
      <ReviewSend auth={auth} mode="referral" />
    </>
  );
}
function ReviewSend({ auth, mode }) {
  const chip = { background: "#ffffff", color: "#1a1a1a", padding: "0.4rem 0.8rem", fontSize: "0.78rem", fontWeight: 700, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 50, cursor: "pointer", fontFamily: "inherit" };
  const [channel, setChannel] = useState("email");
  const [segment, setSegment] = useState("all");
  const [recip, setRecip] = useState(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState("");

  async function call(b) { const res = await fetch("/api/admin/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, mode, channel, segment, ...b }) }); const j = await res.json(); if (!res.ok) throw new Error(j.error || "Request failed"); return j; }
  async function loadRecip() { try { setRecip(await call({ action: "recipients" })); } catch (e) { setRecip(null); } }
  useEffect(() => { setConfirm(false); setResult(""); loadRecip(); /* eslint-disable-next-line */ }, [channel, segment]);
  async function draft() { setBusy("draft"); try { const r = await call({ action: "draft" }); setBody(r.body || ""); if (r.subject) setSubject(r.subject); } catch (e) { alert(e.message); } finally { setBusy(""); } }
  async function send() { setBusy("send"); setResult(""); try { const r = await call({ action: "send", body, subject }); setResult(`✅ Sent ${r.sent} of ${r.reachable}${r.failed ? ` · ${r.failed} failed` : ""}.`); setConfirm(false); } catch (e) { alert(e.message); } finally { setBusy(""); } }
  const n = recip ? recip.reachable : 0;

  return (
    <div style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: "1.1rem 1.25rem" }}>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
        {["email", "sms"].map((ch) => <button key={ch} onClick={() => setChannel(ch)} style={{ ...chip, ...(channel === ch ? { background: "#FF1F1F", borderColor: "#FF1F1F" } : {}) }}>{ch === "sms" ? "📲 SMS" : "✉️ Email"}</button>)}
        {mode === "referral" && (
          <select style={{ ...inp, marginBottom: 0, width: 150, padding: "0.4rem 0.7rem" }} value={segment} onChange={(e) => setSegment(e.target.value)}>
            <option value="all">All customers</option><option value="vip">VIP</option><option value="lapsed">Lapsed</option><option value="commercial">Commercial</option>
          </select>
        )}
      </div>
      <p style={{ color: "rgba(0,0,0,0.6)", fontSize: "0.8rem", marginBottom: "0.6rem" }}>
        {mode === "review" ? "Recent customers not yet asked" : "Recipients"}: {recip ? `${recip.total} · ` : ""}<strong style={{ color: n ? "#3DD68C" : "#FF6666" }}>{n} reachable by {channel === "sms" ? "text" : "email"}</strong>
        {channel === "sms" ? " — opted-in only, needs A2P approval" : ""}
      </p>
      {channel === "email" && <input style={inp} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />}
      <textarea style={{ ...inp, minHeight: 90, resize: "vertical" }} placeholder="Message… {name} = first name" value={body} onChange={(e) => setBody(e.target.value)} />
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button onClick={draft} disabled={busy === "draft"} style={ghostBtn}>{busy === "draft" ? "Writing…" : "🤖 Draft with AI"}</button>
        {!confirm ? <button onClick={() => setConfirm(true)} disabled={!body.trim() || !n} style={{ ...cta, opacity: !body.trim() || !n ? 0.5 : 1 }}>Send…</button>
          : <button onClick={send} disabled={busy === "send"} style={{ ...cta, background: "#C20000" }}>{busy === "send" ? "Sending…" : `Confirm — send to ${n}`}</button>}
      </div>
      {result && <p style={{ color: "#3DD68C", marginTop: "0.6rem", fontWeight: 700 }}>{result}</p>}
    </div>
  );
}

/* ---------------- WEEKLY P&L ---------------- */
const PNL_FLAG = {
  negative: { e: "🟥", bg: "#FFE9EC", label: "Negative profit" },
  low: { e: "🟨", bg: "#FFFBE6", label: "Low (<$30/tire)" },
  high: { e: "🟩", bg: "#EAF7EE", label: "High (>$60/tire)" },
  pickup: { e: "📦", bg: "#E8F6FE", label: "Pickup-only" },
  missing: { e: "🟧", bg: "#FFF2E2", label: "Missing tire cost" },
  unmatched: { e: "⚠️", bg: "#FFE3E3", label: "No detail matched — check this invoice" },
  refund: { e: "↩️", bg: "#F3E8FF", label: "Refund (reverses a sale)" },
};
function pnlRowBg(flags) {
  for (const f of ["refund", "unmatched", "missing", "negative", "low", "high", "pickup"]) if (flags.includes(f)) return PNL_FLAG[f].bg;
  return "transparent";
}

// Read a cost the owner typed. Strips $, commas, and stray spaces so "$1,140" -> 1140.
// Returns NaN for anything that isn't a real number so the caller can refuse to save it
// (silently turning bad input into 0 once wiped out a whole night of entered costs).
function parseCost(v) {
  const s = String(v ?? "").replace(/[^0-9.\-]/g, "");
  if (s === "" || s === "-" || s === "." || s === "-.") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function PnlTab({ auth }) {
  const [start, setStart] = useState(() => ymd(mondayOf(new Date())));
  const [wk, setWk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [journal, setJournal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [uploadKey, setUploadKey] = useState(0); // bump to remount file inputs so they visually clear after a save
  const [openDay, setOpenDay] = useState(null);
  const [costVals, setCostVals] = useState({});
  const [dl, setDl] = useState(false);
  const [costItems, setCostItems] = useState([]);
  const [costEdits, setCostEdits] = useState({});
  const [showCosts, setShowCosts] = useState(false);
  const [savingCosts, setSavingCosts] = useState(false);

  async function call(body) {
    const res = await fetch("/api/admin/pnl", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  }
  async function loadWeek(s) {
    setLoading(true); setErr("");
    try { setWk(await call({ action: "week", start: s })); }
    catch (e) { setErr(e.message); } finally { setLoading(false); }
  }
  async function loadCostItems(s) {
    try {
      const r = await call({ action: "costbook", start: s });
      setCostItems(r.items || []);
      setCostEdits(Object.fromEntries((r.items || []).map((i) => [i.key, i.unit_cost == null ? "" : String(i.unit_cost)])));
    } catch (e) { /* non-fatal */ }
  }
  useEffect(() => { loadWeek(start); loadCostItems(start); /* eslint-disable-next-line */ }, [start]);

  async function saveEditedCosts() {
    const typed = costItems.filter((i) => String(costEdits[i.key] ?? "").trim() !== "");
    const bad = typed.filter((i) => Number.isNaN(parseCost(costEdits[i.key])));
    const items = typed
      .filter((i) => !Number.isNaN(parseCost(costEdits[i.key])))
      .map((i) => ({ match_key: i.key, label: i.description, unit_cost: parseCost(costEdits[i.key]) }));
    if (bad.length) { setNote(`⚠️ Couldn't read ${bad.length} cost${bad.length > 1 ? "s" : ""} (use numbers only — no letters): ${bad.map((i) => i.description).join(", ")}`); return; }
    if (!items.length) { setNote("Enter at least one cost."); return; }
    setSavingCosts(true);
    try { await call({ action: "costs_bulk", items }); await loadWeek(start); await loadCostItems(start); setNote(`✓ Saved ${items.length} cost change${items.length > 1 ? "s" : ""}`); }
    catch (e) { setNote(`⚠️ ${e.message}`); } finally { setSavingCosts(false); }
  }

  const toB64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

  async function processDay() {
    if (!journal || !detail) { setNote("Pick both PDFs first."); return; }
    setBusy(true); setNote("");
    try {
      const [journalB64, detailB64] = await Promise.all([toB64(journal), toB64(detail)]);
      const r = await call({ action: "upload", journalB64, detailB64 });
      setNote(`✓ Processed ${r.date} — ${r.day.invoices} invoices${r.unmatched?.length ? ` (⚠️ no detail for: ${r.unmatched.join(", ")})` : ""}. Pick the next day's two PDFs below.`);
      setJournal(null); setDetail(null); setUploadKey((k) => k + 1);
      await loadWeek(start); await loadCostItems(start);
    } catch (e) { setNote(`⚠️ ${e.message}`); } finally { setBusy(false); }
  }

  // Unique missing tire costs across the week, queued 3 at a time.
  const missing = useMemo(() => {
    if (!wk) return [];
    const map = {};
    wk.days.forEach((d) => d.missing.forEach((m) => { map[m.key] = m; }));
    return Object.values(map);
  }, [wk]);
  const queue = missing.slice(0, 3);

  async function saveCosts() {
    // Save anything the user actually typed — including 0 (free/used tires).
    const typed = queue.filter((m) => String(costVals[m.key] ?? "").trim() !== "");
    const bad = typed.filter((m) => Number.isNaN(parseCost(costVals[m.key])));
    const items = typed
      .filter((m) => !Number.isNaN(parseCost(costVals[m.key])))
      .map((m) => ({ match_key: m.key, label: m.description, unit_cost: parseCost(costVals[m.key]) }));
    if (bad.length) { setNote(`⚠️ Couldn't read ${bad.length} cost${bad.length > 1 ? "s" : ""} (use numbers only — no letters): ${bad.map((m) => m.description).join(", ")}`); return; }
    if (!items.length) { setNote("Enter a cost first — use 0 for free/used tires."); return; }
    setBusy(true);
    try { await call({ action: "costs_bulk", items }); setCostVals({}); await loadWeek(start); await loadCostItems(start); setNote(`✓ Saved ${items.length} cost${items.length > 1 ? "s" : ""}`); }
    catch (e) { setNote(`⚠️ ${e.message}`); } finally { setBusy(false); }
  }

  async function downloadExcel() {
    setDl(true);
    try {
      const res = await fetch("/api/admin/pnl-export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, start }) });
      if (!res.ok) { alert("Could not generate the workbook."); return; }
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `TirePlug-PnL-Week-${start}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } finally { setDl(false); }
  }

  const money = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const money0 = (n) => `$${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const s = wk?.summary;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 900 }}>📈 Weekly P&amp;L</h2>
          <p style={{ margin: "0.2rem 0 0", color: "rgba(0,0,0,0.5)", fontSize: "0.82rem" }}>Upload each day's Sales Journal + Sales Detail. Tire costs are remembered — fill once, kept forever.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <label style={{ fontSize: "0.75rem", color: "rgba(0,0,0,0.55)" }}>Week of</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...miniInp, width: 150 }} />
          <button onClick={downloadExcel} disabled={dl} style={cta}>{dl ? "…" : "⬇ Excel"}</button>
        </div>
      </div>

      {/* Upload */}
      <Section title="Add a day">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.6rem", alignItems: "end" }}>
          <div>
            <label style={{ fontSize: "0.72rem", color: "rgba(0,0,0,0.55)", display: "block", marginBottom: "0.25rem" }}>Sales Journal PDF {journal ? "✓" : ""}</label>
            <input key={`j-${uploadKey}`} type="file" accept="application/pdf" onChange={(e) => setJournal(e.target.files[0])} style={{ fontSize: "0.78rem" }} />
          </div>
          <div>
            <label style={{ fontSize: "0.72rem", color: "rgba(0,0,0,0.55)", display: "block", marginBottom: "0.25rem" }}>Sales Detail PDF {detail ? "✓" : ""}</label>
            <input key={`d-${uploadKey}`} type="file" accept="application/pdf" onChange={(e) => setDetail(e.target.files[0])} style={{ fontSize: "0.78rem" }} />
          </div>
          <button onClick={processDay} disabled={busy} style={{ ...cta, opacity: busy ? 0.5 : 1 }}>{busy ? "Reading…" : "Process day"}</button>
        </div>
        {note && <p style={{ marginTop: "0.6rem", fontSize: "0.82rem", color: note.startsWith("⚠️") ? "#E5484D" : "#2E7D32" }}>{note}</p>}
        <p style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: "rgba(0,0,0,0.4)" }}>The day's date is read from the PDF automatically. Re-uploading a day overwrites it.</p>
      </Section>

      {err && <p style={{ color: "#E5484D" }}>{err}</p>}
      {loading && <p style={{ color: "rgba(0,0,0,0.5)" }}>Loading…</p>}

      {/* Weekly summary */}
      {s && (
        <Section title={`Week summary · ${wk.dates[0]} → ${wk.dates[6]}`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.6rem", marginBottom: "0.9rem" }}>
            {[
              ["Revenue", money0(s.revenue)], ["COGS", money0(s.cogs)], ["Gross profit", money0(s.grossProfit)],
              ["Commissions", money0(s.commissions)], ["Rent", money0(s.rent)],
              ["Net profit", money0(s.net), s.net < 0 ? "#C62828" : "#2E7D32"],
            ].map(([k, v, c]) => (
              <div key={k} style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: "0.7rem 0.8rem" }}>
                <div style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.45)" }}>{k}</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: c || "#1a1a1a" }}>{v}</div>
              </div>
            ))}
          </div>
          {/* Partner split */}
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
            <div style={{ flex: 1, minWidth: 200, background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: "0.7rem 0.8rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700 }}>Party A <span style={{ color: "rgba(0,0,0,0.45)", fontWeight: 400 }}>(COGS + 50% GP + 50% tax)</span></div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800 }}>{money(s.partnerA)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 200, background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: "0.7rem 0.8rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700 }}>Party B <span style={{ color: "rgba(0,0,0,0.45)", fontWeight: 400 }}>(50% GP + 50% tax)</span></div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800 }}>{money(s.partnerB)}</div>
            </div>
          </div>
          {/* Per-day strip */}
          <div style={{ display: "grid", gap: "0.35rem" }}>
            {wk.days.map((d) => {
              const has = d.invoices > 0;
              return (
                <button key={d.date} onClick={() => setOpenDay(openDay === d.date ? null : d.date)} style={{ display: "grid", gridTemplateColumns: "150px repeat(4, 1fr) auto", gap: "0.5rem", alignItems: "center", background: openDay === d.date ? "#f1f2f4" : "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: "0.5rem 0.7rem", cursor: has ? "pointer" : "default", textAlign: "left", fontFamily: "inherit", opacity: has ? 1 : 0.5 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.8rem" }}>{new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                  <span style={{ fontSize: "0.78rem" }}>{has ? `${d.invoices} inv` : "—"}</span>
                  <span style={{ fontSize: "0.78rem" }}>{has ? money0(d.revenue) : ""}</span>
                  <span style={{ fontSize: "0.78rem", color: "rgba(0,0,0,0.55)" }}>{has ? `GP ${money0(d.grossProfit)}` : ""}</span>
                  <span style={{ fontSize: "0.78rem" }}>{has && d.commissions ? `comm ${money0(d.commissions)}` : ""}</span>
                  <span style={{ fontSize: "0.72rem" }}>{has && d.flags.missing ? `🟧${d.flags.missing}` : ""}{has && d.flags.negative ? ` 🟥${d.flags.negative}` : ""}</span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* Missing costs — 3 at a time */}
      {missing.length > 0 && (
        <Section title={`🟧 Missing tire costs (${missing.length})`}>
          <p style={{ fontSize: "0.8rem", color: "rgba(0,0,0,0.55)", marginTop: 0 }}>Enter our cost per unit — <strong>type 0 for free / used / trade-in tires</strong>. Saved to the shared cost book, so Finance learns them too. Showing {queue.length} of {missing.length}.</p>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {queue.map((m) => (
              <div key={m.key} style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: "0.5rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.82rem" }}>
                  <span style={{ display: "inline-block", fontSize: "0.66rem", fontWeight: 700, background: m.category === "tire" ? "#EEF" : m.category === "tpms" ? "#E8F6FE" : "#FFF2E2", borderRadius: 5, padding: "0.1rem 0.4rem", marginRight: "0.4rem" }}>{m.category === "tire" ? "🛞 Tire" : m.category === "tpms" ? "💡 TPMS" : "🛢️ Oil"}</span>
                  {m.description} <span style={{ color: "rgba(0,0,0,0.4)" }}>(qty {m.qty})</span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <span style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.8rem" }}>$</span>
                  <input value={costVals[m.key] || ""} onChange={(e) => setCostVals({ ...costVals, [m.key]: e.target.value })} placeholder="cost" inputMode="decimal" style={miniInp} />
                </div>
              </div>
            ))}
          </div>
          <button onClick={saveCosts} disabled={busy} style={{ ...cta, marginTop: "0.7rem" }}>{busy ? "Saving…" : "Save costs"}</button>
        </Section>
      )}

      {/* Edit any cost (corrections) */}
      {costItems.length > 0 && (
        <Section title={`💲 Edit costs (${costItems.length})`}>
          <button onClick={() => setShowCosts(!showCosts)} style={{ ...ghostBtn, marginBottom: showCosts ? "0.7rem" : 0 }}>{showCosts ? "Hide costs" : "Show / edit all costs"}</button>
          {showCosts && (
            <>
              <p style={{ fontSize: "0.78rem", color: "rgba(0,0,0,0.5)", margin: "0 0 0.6rem" }}>Cost per unit — per tire, per TPMS sensor, per oil change. Editing here updates the shared cost book and recalculates every day instantly. Fix a typo anytime.</p>
              <div style={{ display: "grid", gap: "0.4rem", maxHeight: 380, overflowY: "auto", paddingRight: "0.3rem" }}>
                {costItems.map((m) => (
                  <div key={m.key} style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.8rem" }}>
                      <span style={{ display: "inline-block", fontSize: "0.66rem", fontWeight: 700, background: m.category === "tire" ? "#EEF" : m.category === "tpms" ? "#E8F6FE" : "#FFF2E2", borderRadius: 5, padding: "0.1rem 0.4rem", marginRight: "0.4rem" }}>{m.category === "tire" ? "🛞 Tire" : m.category === "tpms" ? "💡 TPMS" : "🛢️ Oil"}</span>
                      {m.description} <span style={{ color: "rgba(0,0,0,0.4)" }}>(qty {m.qty})</span>
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <span style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.8rem" }}>$</span>
                      <input value={costEdits[m.key] ?? ""} onChange={(e) => setCostEdits({ ...costEdits, [m.key]: e.target.value })} placeholder="per unit" inputMode="decimal" style={miniInp} />
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={saveEditedCosts} disabled={savingCosts} style={{ ...cta, marginTop: "0.7rem" }}>{savingCosts ? "Saving…" : "Save cost changes"}</button>
            </>
          )}
        </Section>
      )}

      {/* Day detail */}
      {openDay && wk && (() => {
        const d = wk.days.find((x) => x.date === openDay);
        if (!d || !d.rows.length) return null;
        return (
          <Section title={`${new Date(openDay + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · ${d.invoices} invoices`}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "rgba(0,0,0,0.5)", borderBottom: "1px solid rgba(0,0,0,0.1)" }}>
                    {["Inv", "Rep", "Customer", "Description", "Tires", "Tire $/ea", "TPMS", "TPMS $/ea", "Oil", "Oil $/ea", "Total Cost", "Retail", "Tax", "Profit", "Comm", "Flags"].map((h) => <th key={h} style={{ padding: "0.4rem 0.5rem", whiteSpace: "nowrap" }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {d.rows.map((r) => (
                    <tr key={r.inv_no} style={{ background: pnlRowBg(r.flags), borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                      <td style={{ padding: "0.4rem 0.5rem", fontWeight: 700, whiteSpace: "nowrap" }}>{r.inv_no}</td>
                      <td style={{ padding: "0.4rem 0.5rem", whiteSpace: "nowrap" }}>{r.rep}{r.eligible ? "" : " *"}</td>
                      <td style={{ padding: "0.4rem 0.5rem", whiteSpace: "nowrap" }}>{r.customer}</td>
                      <td style={{ padding: "0.4rem 0.5rem", maxWidth: 260 }}>{r.description}</td>
                      <td style={{ padding: "0.4rem 0.5rem", textAlign: "center" }}>{r.tireQty || ""}</td>
                      <td style={{ padding: "0.4rem 0.5rem" }}>{r.tireUnitCost ? money(r.tireUnitCost) : ""}</td>
                      <td style={{ padding: "0.4rem 0.5rem", textAlign: "center" }}>{r.tpmsQty || ""}</td>
                      <td style={{ padding: "0.4rem 0.5rem" }}>{r.tpmsUnitCost ? money(r.tpmsUnitCost) : ""}</td>
                      <td style={{ padding: "0.4rem 0.5rem", textAlign: "center" }}>{r.oilQty || ""}</td>
                      <td style={{ padding: "0.4rem 0.5rem" }}>{r.oilUnitCost ? money(r.oilUnitCost) : ""}</td>
                      <td style={{ padding: "0.4rem 0.5rem", fontWeight: 600 }}>{money(r.totalCost)}</td>
                      <td style={{ padding: "0.4rem 0.5rem" }}>{money(r.retail)}</td>
                      <td style={{ padding: "0.4rem 0.5rem", color: "rgba(0,0,0,0.5)" }}>{money(r.tax)}</td>
                      <td style={{ padding: "0.4rem 0.5rem", fontWeight: 700 }}>{money(r.totalProfit)}</td>
                      <td style={{ padding: "0.4rem 0.5rem", color: "#2E7D32", fontWeight: 700 }}>{r.commission ? money0(r.commission) : ""}</td>
                      <td style={{ padding: "0.4rem 0.5rem", whiteSpace: "nowrap" }}>{r.flags.map((f) => PNL_FLAG[f].e).join(" ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: "0.7rem", fontSize: "0.72rem", color: "rgba(0,0,0,0.5)" }}>
              {Object.entries(PNL_FLAG).map(([k, v]) => <span key={k}>{v.e} {v.label}</span>)}
              <span>* not commission-eligible</span>
            </div>
            {Object.keys(d.commissionsByRep).length > 0 && (
              <p style={{ marginTop: "0.6rem", fontSize: "0.8rem" }}><strong>Commissions:</strong> {Object.entries(d.commissionsByRep).map(([r, a]) => `${r} ${money0(a)}`).join(" · ")}</p>
            )}
          </Section>
        );
      })()}
    </div>
  );
}

/* ---------------- COSTS / BREAK-EVEN ---------------- */
const COST_META = {
  rent:      { emoji: "🏠", label: "Rent" },
  payroll:   { emoji: "💵", label: "Payroll" },
  marketing: { emoji: "📣", label: "Marketing / Ads" },
  utilities: { emoji: "💡", label: "Utilities" },
  insurance: { emoji: "🛡️", label: "Insurance" },
  supplies:  { emoji: "📦", label: "Supplies" },
  other:     { emoji: "🧾", label: "Other" },
};
const FREQ_LABEL = { monthly: "per month", weekly: "per week", biweekly: "every 2 weeks", yearly: "per year", one_time: "one-time" };
// Mirror of toMonthly() in the API so the list totals match the server.
function costToMonthly(amount, frequency) {
  const a = Number(amount) || 0;
  if (frequency === "weekly") return a * (52 / 12);
  if (frequency === "biweekly") return a * (26 / 12);
  if (frequency === "yearly") return a / 12;
  if (frequency === "one_time") return 0;
  return a;
}

function AdsTab({ auth }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [range, setRange] = useState("last_30d");

  const RANGE_OPTS = [
    { id: "last_7d", label: "7 days" },
    { id: "last_30d", label: "30 days" },
    { id: "last_90d", label: "90 days" },
    { id: "this_month", label: "This month" },
  ];

  async function call(body) {
    const res = await fetch("/api/admin/ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  }
  async function load(r = range) {
    setLoading(true); setErr("");
    try { setState(await call({ range: r })); }
    catch (e) { setErr(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(range); /* eslint-disable-next-line */ }, [range]);

  const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;
  const money2 = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const numf = (n) => Math.round(Number(n) || 0).toLocaleString();

  const card = { background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: "1.1rem 1.2rem" };
  const heroNum = { fontSize: "2.1rem", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.02em" };
  const kicker = { margin: 0, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(0,0,0,0.45)" };

  const header = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 900 }}>📣 Ads</h2>
        <p style={{ margin: "0.2rem 0 0", color: "rgba(0,0,0,0.5)", fontSize: "0.82rem" }}>What your Meta ads spent, what came back, and a rough return — all in one place.</p>
      </div>
      <div style={{ display: "flex", gap: "0.35rem" }}>
        {RANGE_OPTS.map((o) => {
          const on = range === o.id;
          return (
            <button key={o.id} onClick={() => setRange(o.id)} style={{ background: on ? "#111" : "#fff", color: on ? "#fff" : "rgba(0,0,0,0.6)", border: "1px solid rgba(0,0,0,0.14)", borderRadius: 8, padding: "0.4rem 0.7rem", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{o.label}</button>
          );
        })}
      </div>
    </div>
  );

  if (state?.needsSetup || (state && !state.ok)) {
    return (
      <div>
        {header}
        <div style={{ ...card, background: "#FFF7E6", borderColor: "#FFE0A3" }}>
          <p style={{ margin: 0, fontWeight: 800 }}>Connect your Meta ad account</p>
          <p style={{ margin: "0.5rem 0 0", color: "rgba(0,0,0,0.72)", lineHeight: 1.6, fontSize: "0.9rem" }}>
            {state?.error || "Meta Ads isn't connected yet."} To turn this on, add two values in Vercel (Project → Settings → Environment Variables), then redeploy:
          </p>
          <ul style={{ margin: "0.6rem 0 0", paddingLeft: "1.1rem", color: "rgba(0,0,0,0.72)", fontSize: "0.88rem", lineHeight: 1.7 }}>
            <li><b>META_ACCESS_TOKEN</b> — a long-lived token with <i>ads_read</i> (see <b>ADS-SETUP.md</b> for the click-by-click).</li>
            <li><b>META_AD_ACCOUNT_ID</b> — your ad account number: <b>886261905697554</b>.</li>
          </ul>
          <button onClick={() => load()} style={{ ...cta, marginTop: "0.9rem" }}>Check again</button>
        </div>
      </div>
    );
  }

  const t = state?.totals || {};
  const campaigns = state?.campaigns || [];

  return (
    <div>
      {header}
      {err && <div style={{ ...card, background: "#FDECEC", borderColor: "#F5B5B5", marginBottom: "0.8rem", fontSize: "0.88rem" }}>⚠️ {err}</div>}

      {loading && !state ? <Empty>Loading ads…</Empty> : (
        <>
          {/* ---- Headline numbers ---- */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.8rem", marginBottom: "0.8rem" }}>
            <div style={{ ...card, background: "#111", color: "#fff", border: "none" }}>
              <p style={{ ...kicker, color: "rgba(255,255,255,0.6)" }}>Ad spend</p>
              <div style={{ ...heroNum, margin: "0.35rem 0 0", color: "#fff" }}>{money(t.spend)}</div>
              <p style={{ margin: "0.4rem 0 0", fontSize: "0.74rem", color: "rgba(255,255,255,0.6)" }}>{state?.rangeLabel}</p>
            </div>
            <div style={card}>
              <p style={kicker}>Results (leads / DMs)</p>
              <div style={{ ...heroNum, margin: "0.35rem 0 0" }}>{numf(t.results)}</div>
              <p style={{ margin: "0.4rem 0 0", fontSize: "0.74rem", color: "rgba(0,0,0,0.45)" }}>counted by Meta</p>
            </div>
            <div style={card}>
              <p style={kicker}>Cost per result</p>
              <div style={{ ...heroNum, margin: "0.35rem 0 0" }}>{t.costPerResult != null ? money2(t.costPerResult) : "—"}</div>
              <p style={{ margin: "0.4rem 0 0", fontSize: "0.74rem", color: "rgba(0,0,0,0.45)" }}>spend ÷ results</p>
            </div>
            <div style={{ ...card, background: t.roas != null && t.roas >= 1 ? "#EAF7EE" : "#fff", borderColor: t.roas != null && t.roas >= 1 ? "#BFE6C9" : "rgba(0,0,0,0.08)" }}>
              <p style={kicker}>Blended ROAS</p>
              <div style={{ ...heroNum, margin: "0.35rem 0 0", color: t.roas != null && t.roas >= 1 ? "#137a37" : "#1a1a1a" }}>{t.roas != null ? `${t.roas.toFixed(1)}×` : "—"}</div>
              <p style={{ margin: "0.4rem 0 0", fontSize: "0.74rem", color: "rgba(0,0,0,0.45)" }}>{t.revenue != null ? `${money(t.revenue)} booked` : "no revenue data"}</p>
            </div>
          </div>

          {/* ---- Honesty note about the ROAS ---- */}
          <div style={{ ...card, background: "#F7F8FA", marginBottom: "0.8rem", fontSize: "0.82rem", color: "rgba(0,0,0,0.62)", lineHeight: 1.55 }}>
            <b>How to read “Blended ROAS”:</b> it's all booked web-lead revenue ({t.bookedCount ?? 0} booked) ÷ ad spend for this window. It's a rough directional number — some of that revenue comes from Google or word-of-mouth, not just ads. <b>True per-ad tracking</b> (knowing exactly which ad drove each booking) is the next step up.
          </div>

          {/* ---- Per-campaign table ---- */}
          {campaigns.length === 0 ? (
            <Empty>No campaigns ran in this window.</Empty>
          ) : (
            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem", minWidth: 640 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "rgba(0,0,0,0.5)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      <th style={{ padding: "0.7rem 1rem" }}>Campaign</th>
                      <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Spend</th>
                      <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Results</th>
                      <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Cost / result</th>
                      <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Reach</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                        <td style={{ padding: "0.7rem 1rem", fontWeight: 700 }}>{c.name}</td>
                        <td style={{ padding: "0.7rem 1rem", textAlign: "right" }}>{money(c.spend)}</td>
                        <td style={{ padding: "0.7rem 1rem", textAlign: "right" }}>{numf(c.results)}</td>
                        <td style={{ padding: "0.7rem 1rem", textAlign: "right" }}>{c.costPerResult != null ? money2(c.costPerResult) : "—"}</td>
                        <td style={{ padding: "0.7rem 1rem", textAlign: "right", color: "rgba(0,0,0,0.55)" }}>{numf(c.reach)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CostsTab({ auth }) {
  const [state, setState] = useState(null);     // API response
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Preferences that only affect the display math — kept on this device.
  const [openDays, setOpenDays] = useState(7);
  const [manualMargin, setManualMargin] = useState(35); // % — used only if there's no P&L yet
  useEffect(() => {
    const od = Number(localStorage.getItem("tp_costs_open_days"));
    if (od >= 1 && od <= 7) setOpenDays(od);
    const mm = Number(localStorage.getItem("tp_costs_manual_margin"));
    if (mm > 0 && mm < 100) setManualMargin(mm);
  }, []);
  const setOpenDaysP = (n) => { setOpenDays(n); localStorage.setItem("tp_costs_open_days", String(n)); };
  const setManualMarginP = (n) => { setManualMargin(n); localStorage.setItem("tp_costs_manual_margin", String(n)); };

  // Add / edit form
  const blank = { id: null, label: "", category: "rent", amount: "", frequency: "monthly" };
  const [form, setForm] = useState(blank);
  const editing = !!form.id;

  async function call(body) {
    const res = await fetch("/api/admin/costs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  }
  async function load() {
    setLoading(true); setErr("");
    try { setState(await call({ action: "list" })); }
    catch (e) { setErr(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function save() {
    if (!form.label.trim()) { setNote("Give the cost a name (like Rent)."); return; }
    if (Number.isNaN(parseCost(form.amount))) { setNote("⚠️ Amount must be a number."); return; }
    setBusy(true); setNote("");
    try {
      await call({ action: "save", id: form.id, label: form.label, category: form.category, amount: form.amount, frequency: form.frequency });
      setForm(blank); setNote("✓ Saved"); await load();
    } catch (e) { setNote(`⚠️ ${e.message}`); } finally { setBusy(false); }
  }
  async function remove(id, label) {
    if (!confirm(`Remove "${label}"?`)) return;
    setBusy(true);
    try { await call({ action: "delete", id }); if (form.id === id) setForm(blank); await load(); }
    catch (e) { setNote(`⚠️ ${e.message}`); } finally { setBusy(false); }
  }
  function quickAdd(category) {
    const m = COST_META[category];
    setForm({ id: null, label: m.label, category, amount: "", frequency: category === "payroll" ? "weekly" : "monthly" });
  }

  const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;
  const money2 = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const costs = state?.costs || [];
  const monthly = state?.monthlyRecurring || 0;
  const oneTime = state?.oneTimeTotal || 0;
  const openDaysPerMonth = openDays * (52 / 12);
  const dailyProfitTarget = openDaysPerMonth > 0 ? monthly / openDaysPerMonth : 0;

  const pnlMargin = state?.margin?.marginPct ?? null;   // 0..1 or null
  const marginPct = pnlMargin != null ? pnlMargin : manualMargin / 100;
  const dailySalesTarget = marginPct > 0 ? dailyProfitTarget / marginPct : null;

  const recentDays = state?.margin?.days || 0;
  const avgDailySales = recentDays > 0 ? state.margin.revenue / recentDays : null;

  const grouped = {};
  costs.forEach((c) => { (grouped[c.category] || (grouped[c.category] = [])).push(c); });

  const card = { background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: "1.1rem 1.2rem" };
  const heroNum = { fontSize: "2.1rem", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.02em" };

  if (state?.needsSetup) {
    return (
      <div>
        <h2 style={{ margin: "0 0 0.4rem", fontSize: "1.3rem", fontWeight: 900 }}>🧾 Costs</h2>
        <div style={{ ...card, background: "#FFF7E6", borderColor: "#FFE0A3" }}>
          <p style={{ margin: 0, fontWeight: 700 }}>One-time setup needed</p>
          <p style={{ margin: "0.5rem 0 0", color: "rgba(0,0,0,0.7)", lineHeight: 1.6, fontSize: "0.9rem" }}>
            Open your Supabase project → SQL Editor → paste the contents of <b>lib/costs-schema.sql</b> and hit Run. Then refresh this page.
            (If you already ran the Finance setup, this may just be a hiccup — refresh first.)
          </p>
          <button onClick={load} style={{ ...cta, marginTop: "0.9rem" }}>Refresh</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 900 }}>🧾 Costs &amp; Break-Even</h2>
        <p style={{ margin: "0.2rem 0 0", color: "rgba(0,0,0,0.5)", fontSize: "0.82rem" }}>Enter your fixed costs (rent, payroll, marketing…) and see exactly how much you need each day to break even.</p>
      </div>

      {loading && !state ? <Empty>Loading…</Empty> : (
        <>
          {/* ---- The two daily targets ---- */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "0.8rem", marginBottom: "0.8rem" }}>
            <div style={{ ...card, background: "#111", color: "#fff", border: "none" }}>
              <p style={{ margin: 0, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.6)" }}>Sales you need / day</p>
              <div style={{ ...heroNum, margin: "0.35rem 0 0", color: "#fff" }}>{dailySalesTarget != null ? money(dailySalesTarget) : "—"}</div>
              <p style={{ margin: "0.4rem 0 0", fontSize: "0.76rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.45 }}>
                Money rung up each day to cover all costs{marginPct > 0 ? ` (at ${Math.round(marginPct * 100)}% profit margin)` : ""}.
              </p>
            </div>
            <div style={{ ...card, borderColor: "rgba(0,0,0,0.12)" }}>
              <p style={{ margin: 0, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(0,0,0,0.45)" }}>Profit you need / day</p>
              <div style={{ ...heroNum, margin: "0.35rem 0 0", color: "#1a1a1a" }}>{money(dailyProfitTarget)}</div>
              <p style={{ margin: "0.4rem 0 0", fontSize: "0.76rem", color: "rgba(0,0,0,0.5)", lineHeight: 1.45 }}>
                Profit left <i>after</i> paying for the tires. Anything above this is your take-home.
              </p>
            </div>
          </div>

          {/* ---- How the number is built ---- */}
          <div style={{ ...card, marginBottom: "0.8rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1.2rem 2rem", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "1.15rem", fontWeight: 800 }}>{money(monthly)}<span style={{ fontSize: "0.8rem", fontWeight: 600, color: "rgba(0,0,0,0.45)" }}> /month</span></div>
                <div style={{ fontSize: "0.72rem", color: "rgba(0,0,0,0.45)" }}>total fixed costs</div>
              </div>
              <div style={{ fontSize: "1.2rem", color: "rgba(0,0,0,0.25)" }}>÷</div>
              <div>
                <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                  <label style={{ fontSize: "0.78rem", color: "rgba(0,0,0,0.6)" }}>open</label>
                  <select value={openDays} onChange={(e) => setOpenDaysP(Number(e.target.value))} style={{ ...miniInp, width: "auto", padding: "0.35rem 0.5rem" }}>
                    {[5, 6, 7].map((d) => <option key={d} value={d}>{d} days/wk</option>)}
                  </select>
                </div>
                <div style={{ fontSize: "0.72rem", color: "rgba(0,0,0,0.45)", marginTop: "0.2rem" }}>≈ {Math.round(openDaysPerMonth)} days/month</div>
              </div>
              <div style={{ fontSize: "1.2rem", color: "rgba(0,0,0,0.25)" }}>=</div>
              <div>
                <div style={{ fontSize: "1.15rem", fontWeight: 800 }}>{money(dailyProfitTarget)}<span style={{ fontSize: "0.8rem", fontWeight: 600, color: "rgba(0,0,0,0.45)" }}> /day</span></div>
                <div style={{ fontSize: "0.72rem", color: "rgba(0,0,0,0.45)" }}>break-even profit</div>
              </div>
            </div>

            {/* Margin source + recent comparison */}
            <div style={{ marginTop: "0.9rem", paddingTop: "0.9rem", borderTop: "1px solid rgba(0,0,0,0.07)", fontSize: "0.82rem", color: "rgba(0,0,0,0.65)", lineHeight: 1.6 }}>
              {pnlMargin != null ? (
                <>Profit margin <b>{Math.round(pnlMargin * 100)}%</b> — measured from your last {recentDays} day{recentDays === 1 ? "" : "s"} of Weekly P&amp;L.
                  {avgDailySales != null && (
                    <> Your recent average is <b>{money(avgDailySales)}/day</b> in sales — {avgDailySales >= (dailySalesTarget || 0)
                      ? <span style={{ color: "#1a7f4b", fontWeight: 700 }}>above break-even 🎉</span>
                      : <span style={{ color: "#c02626", fontWeight: 700 }}>{money((dailySalesTarget || 0) - avgDailySales)}/day short</span>}.</>
                  )}
                </>
              ) : (
                <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem" }}>
                  No Weekly P&amp;L uploaded yet, so I'm estimating sales with a
                  <input type="number" value={manualMargin} onChange={(e) => setManualMarginP(Number(e.target.value) || 0)} style={{ ...miniInp, width: 60, padding: "0.3rem 0.4rem" }} />
                  % profit margin. Upload some days in Weekly P&amp;L and this becomes exact.
                </span>
              )}
            </div>
            {oneTime > 0 && <p style={{ margin: "0.6rem 0 0", fontSize: "0.76rem", color: "rgba(0,0,0,0.45)" }}>Plus {money(oneTime)} in one-time costs (not counted in the daily number).</p>}
          </div>

          {/* ---- Add / edit a cost ---- */}
          <Section title={editing ? "Edit cost" : "Add a cost"}>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.7rem" }}>
              {["rent", "payroll", "marketing"].map((c) => (
                <button key={c} onClick={() => quickAdd(c)} style={{ background: "#f1f2f4", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 50, padding: "0.4rem 0.8rem", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  ＋ {COST_META[c].emoji} {COST_META[c].label}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr auto", gap: "0.5rem", alignItems: "end" }}>
              <div>
                <label style={miniLbl}>Name</label>
                <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Olympic rent" style={miniInp} />
              </div>
              <div>
                <label style={miniLbl}>Type</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={miniInp}>
                  {Object.keys(COST_META).map((k) => <option key={k} value={k}>{COST_META[k].emoji} {COST_META[k].label}</option>)}
                </select>
              </div>
              <div>
                <label style={miniLbl}>Amount</label>
                <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="$" inputMode="decimal" style={miniInp} />
              </div>
              <div>
                <label style={miniLbl}>How often</label>
                <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} style={miniInp}>
                  {Object.keys(FREQ_LABEL).map((k) => <option key={k} value={k}>{FREQ_LABEL[k]}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: "0.3rem" }}>
                <button onClick={save} disabled={busy} style={{ ...cta, opacity: busy ? 0.5 : 1, padding: "0.7rem 1rem" }}>{editing ? "Save" : "Add"}</button>
                {editing && <button onClick={() => setForm(blank)} style={{ ...miniInp, width: "auto", cursor: "pointer", fontWeight: 700 }}>✕</button>}
              </div>
            </div>
            {note && <p style={{ margin: "0.6rem 0 0", fontSize: "0.82rem", color: note.startsWith("✓") ? "#1a7f4b" : "#c02626" }}>{note}</p>}
          </Section>

          {/* ---- Cost list ---- */}
          <Section title="Your costs">
            {err && <p style={{ color: "#c02626", fontSize: "0.85rem" }}>⚠️ {err}</p>}
            {!costs.length ? <Empty>No costs yet. Add your rent, payroll, and marketing above to see your daily target.</Empty> : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {Object.keys(grouped).map((cat) => (
                  <div key={cat}>
                    {grouped[cat].map((c) => (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.7rem", padding: "0.6rem 0.8rem", background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, marginBottom: "0.35rem" }}>
                        <span style={{ fontSize: "1.1rem" }}>{(COST_META[c.category] || COST_META.other).emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{c.label}</div>
                          <div style={{ fontSize: "0.74rem", color: "rgba(0,0,0,0.45)" }}>{money2(c.amount)} {FREQ_LABEL[c.frequency]}{c.frequency !== "monthly" && c.frequency !== "one_time" ? ` · ${money(costToMonthly(c.amount, c.frequency))}/mo` : ""}</div>
                        </div>
                        <button onClick={() => setForm({ id: c.id, label: c.label, category: c.category || "other", amount: String(c.amount), frequency: c.frequency || "monthly" })} style={rowBtn}>Edit</button>
                        <button onClick={() => remove(c.id, c.label)} style={{ ...rowBtn, color: "#c02626" }}>Delete</button>
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0.8rem", fontWeight: 800, fontSize: "0.9rem", borderTop: "2px solid rgba(0,0,0,0.1)", marginTop: "0.2rem" }}>
                  <span>Total per month</span><span>{money(monthly)}</span>
                </div>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
const miniLbl = { fontSize: "0.68rem", color: "rgba(0,0,0,0.5)", display: "block", marginBottom: "0.2rem", fontWeight: 600 };
const rowBtn = { background: "transparent", border: "1px solid rgba(0,0,0,0.14)", borderRadius: 7, padding: "0.35rem 0.6rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", color: "#1a1a1a" };

/* ---------------- PAYROLL + PERFORMANCE (Phase 5) ---------------- */
function PayrollTab({ auth }) {
  const chip = { background: "#ffffff", color: "#1a1a1a", padding: "0.45rem 0.7rem", fontSize: "0.78rem", fontWeight: 700, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 50, cursor: "pointer", fontFamily: "inherit" };
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
        {presets.map((x) => { const r = x.p(); return <button key={x.l} onClick={() => setRange(r)} style={{ ...chip, ...(range.key === r.key ? { background: "#1a1a1a", color: "#fff", borderColor: "#1a1a1a" } : {}) }}>{x.l}</button>; })}
        <span style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.78rem", marginLeft: "0.4rem" }}>{range.from} → {range.to}</span>
      </div>

      {err && <p style={{ color: "#FF6666" }}>⚠ {err}</p>}
      {loading ? <Empty>Crunching the numbers…</Empty> : (
        <>
          <div style={{ background: "rgba(139,124,246,0.1)", border: "1px solid rgba(139,124,246,0.3)", borderRadius: 16, padding: "1.1rem 1.4rem", marginBottom: "1.5rem" }}>
            <div style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>Estimated payroll this period</div>
            <div style={{ color: "#A99CF8", fontWeight: 900, fontSize: "1.9rem", lineHeight: 1.1 }}>${grand.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <div style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.72rem", marginTop: "0.25rem" }}>hours × rate + logged commission · review before paying</div>
          </div>

          {rows.length === 0 ? <Empty>No active staff.</Empty> : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {rows.map((r) => (
                <div key={r.staff_id} style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: "1rem 1.15rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ color: "#1a1a1a", fontWeight: 800, fontSize: "1rem" }}>{r.name}</div>
                      <div style={{ display: "flex", gap: "0.15rem", marginTop: "0.2rem" }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} onClick={() => setRating(r.staff_id, n)} style={{ cursor: "pointer", color: n <= (r.rating || 0) ? "#FFB800" : "rgba(0,0,0,0.18)", fontSize: "1rem" }}>★</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#3DD68C", fontWeight: 900, fontSize: "1.3rem", lineHeight: 1 }}>${(r.total_pay || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      <div style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.7rem" }}>total pay</div>
                    </div>
                  </div>

                  <div style={{ color: "rgba(0,0,0,0.6)", fontSize: "0.8rem", marginTop: "0.6rem" }}>
                    {r.hours}h × ${r.hourly_rate}/hr = <strong style={{ color: "#1a1a1a" }}>${r.base_pay.toLocaleString()}</strong>
                    {r.commission > 0 ? <> · commission <strong style={{ color: "#1a1a1a" }}>${r.commission.toLocaleString()}</strong></> : null}
                    {" · "}{r.days_worked}d worked · {r.shifts} shift{r.shifts === 1 ? "" : "s"}
                  </div>

                  {Object.keys(r.output || {}).length > 0 && (
                    <div style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.8rem", marginTop: "0.35rem" }}>
                      {SERVICE_TYPES.filter((t) => r.output[t.key]).map((t) => `${t.emoji} ${r.output[t.key]}`).join("   ")}
                    </div>
                  )}
                  {r.commission_note && <div style={{ color: "rgba(0,0,0,0.4)", fontSize: "0.72rem", marginTop: "0.3rem" }}>commission rule: {r.commission_note}</div>}

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
  const chip = { background: "#ffffff", color: "#1a1a1a", padding: "0.45rem 0.7rem", fontSize: "0.78rem", fontWeight: 700, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 50, cursor: "pointer", fontFamily: "inherit" };
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
      <div style={{ background: "#ffffff", border: "1px solid rgba(255,31,31,0.2)", borderRadius: 14, padding: "1.25rem", marginBottom: "1.5rem" }}>
        <h2 style={subHead}>Log work</h2>
        {staff.length === 0 ? (
          <p style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.85rem" }}>Add staff in the 👥 Staff tab first.</p>
        ) : (
          <>
            <select style={{ ...inp, maxWidth: 240 }} value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })}>
              <option value="">Who did it?</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", margin: "0.25rem 0 0.75rem" }}>
              {SERVICE_TYPES.map((t) => {
                const on = form.service_type === t.key;
                return <button key={t.key} onClick={() => setForm({ ...form, service_type: t.key })} style={{ ...chip, ...(on ? { background: "#FF1F1F", borderColor: "#FF1F1F", color: "#1a1a1a" } : {}) }}>{t.emoji} {t.label}</button>;
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
          <button key={r.d} onClick={() => changeRange(r.d)} style={{ ...chip, ...(days === r.d ? { background: "#1a1a1a", color: "#fff", borderColor: "#1a1a1a" } : {}) }}>{r.l}</button>
        ))}
      </div>

      {err && <p style={{ color: "#FF6666" }}>⚠ {err}</p>}

      <h2 style={subHead}>Per rep ({days === 0 ? "today" : `last ${days} days`})</h2>
      {summaryRows.length === 0 ? <Empty>Nothing logged yet.</Empty> : (
        <div style={{ display: "grid", gap: "0.5rem", marginBottom: "2rem" }}>
          {summaryRows.map(([sid, m]) => (
            <div key={sid} style={{ ...rowStyle, gap: "0.75rem", flexWrap: "wrap" }}>
              <span style={{ color: "#1a1a1a", fontWeight: 700, width: 120 }}>{nameById[sid] || "Unassigned"}</span>
              <span style={{ flex: 1, color: "rgba(0,0,0,0.62)", fontSize: "0.85rem" }}>
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
                <span style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.72rem", width: 56 }}>{new Date(e.logged_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                <span style={{ color: "#1a1a1a", fontWeight: 600, fontSize: "0.85rem", flex: 1 }}>{nameById[e.staff_id] || "Unassigned"} · {t ? `${t.emoji} ${t.label}` : e.service_type} ×{e.qty}{e.note ? ` — ${e.note}` : ""}</span>
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
    els.push(<Tag key={"l" + els.length} style={{ margin: "0 0 0.6rem 1.15rem", color: "rgba(0,0,0,0.8)", lineHeight: 1.6 }}>{list}</Tag>);
    list = []; listType = null;
  };
  const inline = (s) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => /^\*\*[^*]+\*\*$/.test(p) ? <strong key={i} style={{ color: "#1a1a1a" }}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>);
  lines.forEach((raw, i) => {
    const t = raw.trim();
    const h = t.match(/^(#{1,6})\s+(.*)/);
    const ol = t.match(/^(\d+)\.\s+(.*)/);
    const ul = t.match(/^[-*]\s+(.*)/);
    if (h) { flush(); const lvl = h[1].length; els.push(<div key={i} style={{ color: "#1a1a1a", fontWeight: 800, fontSize: lvl <= 2 ? "1.02rem" : "0.92rem", margin: "0.5rem 0 0.4rem" }}>{inline(h[2])}</div>); }
    else if (ol) { if (listType !== "ol") flush(); listType = "ol"; list.push(<li key={i} style={{ marginBottom: "0.25rem" }}>{inline(ol[2])}</li>); }
    else if (ul) { if (listType !== "ul") flush(); listType = "ul"; list.push(<li key={i} style={{ marginBottom: "0.25rem" }}>{inline(ul[1])}</li>); }
    else if (/^-{3,}$/.test(t)) { /* horizontal rule — skip */ }
    else if (t.startsWith("|")) { if (!/^\|[\s:|-]+\|$/.test(t)) { flush(); const cells = t.split("|").map((c) => c.trim()).filter(Boolean); els.push(<p key={i} style={{ color: "rgba(0,0,0,0.7)", margin: "0 0 0.3rem", fontSize: "0.85rem" }}>{cells.join("  ·  ")}</p>); } }
    else if (t === "") { flush(); }
    else { flush(); els.push(<p key={i} style={{ color: "rgba(0,0,0,0.8)", margin: "0 0 0.6rem", lineHeight: 1.7 }}>{inline(t)}</p>); }
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
        {slides.map((_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= idx ? "#FF1F1F" : "rgba(0,0,0,0.1)", transition: "background 0.3s" }} />)}
      </div>
      <div style={{ fontSize: "0.9rem", minHeight: 110, marginBottom: "0.85rem" }}><MD text={slides[idx]} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
        <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} style={{ ...ghostBtn, opacity: idx === 0 ? 0.4 : 1 }}>← Back</button>
        <span style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.74rem" }}>Section {idx + 1} of {slides.length}</span>
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
        {answer && <div style={{ color: "rgba(0,0,0,0.8)", fontSize: "0.88rem", lineHeight: 1.6, whiteSpace: "pre-wrap", marginTop: "0.85rem" }}>{answer}</div>}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <span style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.8rem" }}>✓ {passedCount} of {modules.length} guides passed</span>
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
            <p style={{ color: "rgba(0,0,0,0.4)", fontSize: "0.8rem" }}>No guides yet.</p>
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
                      <span style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${pr && pr.passed ? "#3DD68C" : "rgba(0,0,0,0.2)"}`, background: pr && pr.passed ? "#3DD68C" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontSize: "0.8rem", flexShrink: 0 }}>{locked ? "🔒" : pr && pr.passed ? "✓" : ""}</span>
                      <span onClick={() => !locked && openModule(m.id)} style={{ color: "#1a1a1a", fontWeight: 700, fontSize: "0.9rem", cursor: locked ? "default" : "pointer", flex: 1 }}>{m.title} <span style={{ color: pr && pr.passed ? "#3DD68C" : "rgba(0,0,0,0.45)", fontWeight: 500, fontSize: "0.78rem" }}>· {status}</span></span>
                      {isOwner && <button onClick={() => setEditing(m)} style={{ ...ghostBtn, fontSize: "0.68rem", padding: "0.3rem 0.6rem" }}>Edit</button>}
                      {isOwner && <button onClick={() => delModule(m.id)} style={{ background: "none", border: "none", color: "rgba(255,100,100,0.6)", cursor: "pointer", fontSize: "0.85rem" }}>✕</button>}
                      {!locked && <span onClick={() => openModule(m.id)} style={{ color: "rgba(0,0,0,0.4)", cursor: "pointer" }}>{openId === m.id ? "▲" : "▼"}</span>}
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

  if (!questions) return <p style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.85rem" }}>Loading quiz…</p>;
  if (!questions.length) return <p style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.85rem" }}>No quiz on this guide yet.</p>;

  if (result) {
    return (
      <div>
        <div style={{ color: result.passed ? "#3DD68C" : "#FF6666", fontWeight: 800, fontSize: "1.15rem", marginBottom: "0.5rem" }}>
          {result.passed ? "✓ Passed" : "✗ Not passed"} — {result.score}% ({result.correct}/{result.total})
        </div>
        {!result.passed && <p style={{ color: "rgba(0,0,0,0.6)", fontSize: "0.82rem", marginBottom: "0.6rem" }}>You need {result.pass}% to pass. Review the guide and retake.</p>}
        {questions.map((q, i) => (
          <div key={i} style={{ marginBottom: "0.45rem", fontSize: "0.82rem" }}>
            <div style={{ color: result.results[i].correct ? "#3DD68C" : "#FF6666" }}>{result.results[i].correct ? "✓" : "✗"} {q.q}</div>
            {!result.results[i].correct && <div style={{ color: "rgba(0,0,0,0.6)", paddingLeft: "1.1rem" }}>Correct answer: {q.options[result.results[i].correctIndex]}</div>}
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
          <div style={{ color: "#1a1a1a", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>{i + 1}. {q.q}</div>
          {q.options.map((opt, j) => (
            <label key={j} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", color: "rgba(0,0,0,0.7)", fontSize: "0.82rem", padding: "0.22rem 0", cursor: "pointer" }}>
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
                  <span style={{ color: "#1a1a1a", fontWeight: 700, fontSize: "0.88rem" }}>{email}</span>
                  <span style={{ color: pct >= 100 ? "#3DD68C" : "rgba(0,0,0,0.62)", fontSize: "0.8rem" }}>{passed}/{total} passed · {avg}% avg · {mins}m total</span>
                </div>
                <div style={{ height: 6, background: "#ffffff", borderRadius: 4, overflow: "hidden" }}>
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
    <div style={{ background: "#ffffff", border: "1px solid rgba(255,31,31,0.25)", borderRadius: 14, padding: "1.25rem", marginBottom: "1.5rem" }}>
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
      <div style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: "0.85rem", marginTop: "0.5rem" }}>
        <label style={fieldLabel}>Quiz {qCountActual > 0 ? `· ${qCountActual} questions ✓` : "(graded test on this guide)"}</label>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.6rem" }}>
          <span style={{ color: "rgba(0,0,0,0.55)", fontSize: "0.78rem" }}># questions (5–15):</span>
          <input type="number" min={5} max={15} value={qCount} onChange={(e) => setQCount(Math.min(15, Math.max(5, Number(e.target.value) || 5)))} style={{ ...inp, marginBottom: 0, width: 70, padding: "0.5rem" }} />
          <button onClick={genQuiz} disabled={genning} style={{ ...ghostBtn, borderColor: "rgba(139,124,246,0.4)", color: "#A99CF8" }}>{genning ? "✨ Building quiz…" : "✨ Generate quiz"}</button>
          {qErr && <span style={{ color: "#FF6666", fontSize: "0.78rem" }}>{qErr}</span>}
        </div>
        {quiz && quiz.questions && quiz.questions.map((q, i) => (
          <div key={i} style={{ fontSize: "0.78rem", marginBottom: "0.4rem", color: "rgba(0,0,0,0.6)" }}>
            <span style={{ color: "rgba(0,0,0,0.7)" }}>{i + 1}. {q.q}</span> <span style={{ color: "#3DD68C" }}>→ {q.options[q.answer]}</span>
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
    <div style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16, padding: "2.5rem", textAlign: "center" }}>
      <p style={{ color: "rgba(0,0,0,0.6)", marginBottom: "1.25rem", lineHeight: 1.6 }}>Your AI hiring dashboard lives in its own dedicated space and works exactly as before.</p>
      <a href="/careers/admin" style={cta}>Open Hiring Dashboard →</a>
    </div>
  );
}

/* ---------------- shared bits ---------------- */
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <p style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "0.75rem" }}>{title}</p>
      {children}
    </div>
  );
}
function KV({ k, v }) {
  if (!v) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.4rem 0", borderBottom: "1px solid #ffffff" }}>
      <span style={{ color: "rgba(0,0,0,0.5)", fontSize: "0.8rem" }}>{k}</span>
      <span style={{ color: "#1a1a1a", fontSize: "0.85rem", textAlign: "right" }}>{v}</span>
    </div>
  );
}
function Empty({ children }) { return <p style={{ color: "rgba(0,0,0,0.55)", lineHeight: 1.6 }}>{children}</p>; }

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
    <div style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: "0.9rem 1.25rem", marginBottom: "1.5rem" }}>
      <p style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "0.7rem" }}>Recently Active</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        {team.map((m) => {
          const online = isOnline(m.last_active);
          return (
            <div key={m.email} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#ffffff", border: "1px solid #ffffff", borderRadius: 50, padding: "0.35rem 0.8rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: online ? "#3DD68C" : "rgba(0,0,0,0.2)", boxShadow: online ? "0 0 8px #3DD68C" : "none", flexShrink: 0 }} />
              <span style={{ color: "#1a1a1a", fontWeight: 600, fontSize: "0.82rem" }}>{m.name || m.email}{m.is_owner ? " 👑" : ""}</span>
              <span style={{ color: online ? "#3DD68C" : "rgba(0,0,0,0.45)", fontSize: "0.72rem" }}>{agoLabel(m.last_active)}</span>
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
      <div style={{ background: "#f5f6f8", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1a1a1a" }}>
        {children}
        <style jsx>{`.adminRow:hover { border-color: rgba(0,0,0,0.18) !important; background: #fafbfc !important; }`}</style>
      </div>
    </>
  );
}

/* styles */
const inp = { width: "100%", padding: "0.9rem 1.1rem", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10, background: "#ffffff", color: "#1a1a1a", fontSize: "0.95rem", marginBottom: "0.6rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
const miniInp = { width: "100%", padding: "0.5rem 0.6rem", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, background: "#ffffff", color: "#1a1a1a", fontSize: "0.82rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
const cta = { display: "inline-block", background: "#1a1a1a", color: "#fff", padding: "0.8rem 1.4rem", fontSize: "0.8rem", fontWeight: 800, border: "none", borderRadius: 8, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "inherit", textDecoration: "none", textAlign: "center" };
const ghostBtn = { display: "inline-block", background: "#ffffff", color: "#1a1a1a", padding: "0.7rem 1.1rem", fontSize: "0.78rem", fontWeight: 700, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", textAlign: "center" };
const googleBtn = { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem", background: "#fff", color: "#1a1a1a", padding: "0.85rem 1.5rem", fontSize: "0.9rem", fontWeight: 700, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" };
const tabBtn = (active) => ({ background: active ? "rgba(255,31,31,0.15)" : "transparent", color: active ? "#FF6666" : "rgba(0,0,0,0.6)", padding: "0.55rem 1rem", fontSize: "0.85rem", fontWeight: 700, border: active ? "1px solid rgba(255,31,31,0.3)" : "1px solid transparent", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" });
const rowStyle = { display: "flex", alignItems: "center", gap: "1rem", background: "#ffffff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: "0.85rem 1.25rem", transition: "all 0.2s ease" };
const subHead = { color: "rgba(0,0,0,0.45)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.2em", margin: "2.5rem 0 1rem" };
const fieldLabel = { display: "block", color: "rgba(0,0,0,0.55)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.5rem" };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" };
const drawer = { width: "min(540px, 100%)", height: "100%", overflowY: "auto", background: "#fff", borderLeft: "1px solid rgba(0,0,0,0.1)", boxShadow: "-10px 0 30px rgba(0,0,0,0.12)", padding: "2.5rem 2rem", position: "relative" };
const closeBtn = { position: "absolute", top: "1.25rem", right: "1.25rem", background: "#ffffff", border: "1px solid rgba(0,0,0,0.1)", color: "#1a1a1a", width: 36, height: 36, borderRadius: "50%", cursor: "pointer" };
