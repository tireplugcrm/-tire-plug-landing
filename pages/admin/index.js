import React, { useState, useEffect } from "react";
import Head from "next/head";

/* ============================================================
   The Tire Plug — Owner Admin Hub
   One password (same as hiring). Tabs: Leads · Subscribers ·
   Email · Replies · Hiring.
   ============================================================ */

export default function AdminHub() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("leads");
  const [data, setData] = useState({ leads: [], subscribers: [], campaigns: [], replies: [] });
  const [selectedLead, setSelectedLead] = useState(null);

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? sessionStorage.getItem("admin_pw") || sessionStorage.getItem("careers_pw")
        : "";
    if (saved) { setPassword(saved); load(saved); }
  }, []);

  async function load(pw) {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Login failed"); setAuthed(false); return; }
      sessionStorage.setItem("admin_pw", pw);
      setData({ leads: d.leads || [], subscribers: d.subscribers || [], campaigns: d.campaigns || [], replies: d.replies || [] });
      setAuthed(true);
    } catch (e) { setError("Network error"); }
    finally { setLoading(false); }
  }

  async function update(table, id, patch) {
    await fetch("/api/admin/update-lead", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, table, id, ...patch }),
    });
    load(password);
  }

  if (!authed) {
    return (
      <Shell title="Tire Plug Admin">
        <div style={{ maxWidth: 360, margin: "12vh auto 0" }}>
          <h1 style={{ color: "#fff", textAlign: "center", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", marginBottom: "1.5rem" }}>
            Tire Plug <span style={{ color: "#FF1F1F" }}>Admin</span>
          </h1>
          <input type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(password)} style={inp} />
          <button onClick={() => load(password)} disabled={loading} style={cta}>
            {loading ? "..." : "Enter"}
          </button>
          {error && <p style={{ color: "#FF6666", textAlign: "center", marginTop: "1rem", fontSize: "0.85rem" }}>{error}</p>}
        </div>
      </Shell>
    );
  }

  const unread = data.replies.filter((r) => !r.read).length;
  const liveLeads = data.leads.filter((l) => l.status !== "dead");
  const tabs = [
    { id: "leads", label: "Leads", count: liveLeads.length },
    { id: "subscribers", label: "Subscribers", count: data.subscribers.length },
    { id: "email", label: "Email" },
    { id: "replies", label: "Replies", count: unread || null, alert: unread > 0 },
    { id: "hiring", label: "Hiring" },
  ];

  return (
    <Shell title="Tire Plug Admin">
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <h1 style={{ color: "#fff", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", fontSize: "1.4rem", margin: 0 }}>
            Tire Plug <span style={{ color: "#FF1F1F" }}>Admin</span>
          </h1>
          <button onClick={() => load(password)} style={ghostBtn}>↻ Refresh</button>
        </div>

        {/* Tabs */}
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

        {tab === "leads" && <LeadsTab leads={data.leads} onOpen={setSelectedLead} />}
        {tab === "subscribers" && <SubscribersTab subs={data.subscribers} onUpdate={update} />}
        {tab === "email" && <EmailTab password={password} leads={data.leads} subs={data.subscribers} campaigns={data.campaigns} />}
        {tab === "replies" && <RepliesTab replies={data.replies} onUpdate={update} />}
        {tab === "hiring" && <HiringTab />}
      </div>

      {selectedLead && (
        <LeadDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} onUpdate={update} />
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

function LeadsTab({ leads, onOpen }) {
  const live = leads.filter((l) => l.status !== "dead").sort((a, b) => prio(a).rank - prio(b).rank || new Date(b.created_at) - new Date(a.created_at));
  const dead = leads.filter((l) => l.status === "dead");

  return (
    <>
      {live.length === 0 && <Empty>No leads yet. When someone completes the booking form on <strong style={{ color: "#FF3838" }}>tireplugla.com</strong>, they show up here.</Empty>}
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {live.map((l) => <LeadRow key={l.id} l={l} onClick={() => onOpen(l)} />)}
      </div>
      {dead.length > 0 && (
        <>
          <h2 style={subHead}>Dead leads ({dead.length})</h2>
          <div style={{ display: "grid", gap: "0.5rem", opacity: 0.5 }}>
            {dead.map((l) => <LeadRow key={l.id} l={l} onClick={() => onOpen(l)} />)}
          </div>
        </>
      )}
    </>
  );
}

function LeadRow({ l, onClick }) {
  const p = prio(l);
  return (
    <div onClick={onClick} style={{ ...rowStyle, cursor: "pointer" }} className="adminRow">
      <div style={{ width: 90 }}>
        <span style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${p.color}`, color: p.color, fontSize: "0.62rem", fontWeight: 800, padding: "0.25rem 0.5rem", borderRadius: 50, whiteSpace: "nowrap" }}>{p.label}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#fff", fontWeight: 700 }}>{l.name || "(no name)"} <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 500, fontSize: "0.8rem" }}>· {STATUS_LABEL[l.status] || l.status}</span></div>
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

function LeadDrawer({ lead, onClose, onUpdate }) {
  const [notes, setNotes] = useState(lead.owner_notes || "");
  const p = prio(lead);
  const statuses = ["new", "called", "booked", "dead"];
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

        <Section title="Request">
          <KV k="Service" v={lead.service} />
          <KV k="When" v={lead.service_timing} />
          <KV k="Vehicle" v={lead.vehicle} />
          <KV k="Tire size" v={lead.tire_size} />
          <KV k="Tire type" v={lead.tire_type} />
          <KV k="Email" v={lead.email} />
        </Section>

        <Section title="Status">
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {statuses.map((s) => (
              <button key={s} onClick={() => onUpdate("leads", lead.id, { status: s })}
                style={{ ...ghostBtn, background: lead.status === s ? "rgba(255,31,31,0.18)" : "rgba(255,255,255,0.05)", borderColor: lead.status === s ? "#FF1F1F" : "rgba(255,255,255,0.12)", color: lead.status === s ? "#FF6666" : "#fff" }}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Your notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} placeholder="Notes from the call..." />
          <button onClick={() => onUpdate("leads", lead.id, { owner_notes: notes })} style={cta}>Save notes</button>
        </Section>
      </div>
    </div>
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
          <button
            onClick={() => onUpdate("subscribers", s.id, { status: s.status === "active" ? "unsubscribed" : "active" })}
            style={{ ...ghostBtn, fontSize: "0.7rem", padding: "0.45rem 0.7rem" }}>
            {s.status === "active" ? "Unsubscribe" : "Re-activate"}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- EMAIL ---------------- */
function EmailTab({ password, leads, subs, campaigns }) {
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
        body: JSON.stringify({ password, audience, subject, message }),
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
          <button onClick={() => setConfirm(true)} disabled={!subject || !message} style={{ ...cta, opacity: !subject || !message ? 0.4 : 1 }}>
            Review &amp; send
          </button>
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
    return <Empty>No replies yet. When someone replies to an email blast, it shows up here (once inbound email is connected — see setup notes).</Empty>;
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
            <button onClick={() => onUpdate("email_replies", r.id, { read: !r.read })} style={{ ...ghostBtn, fontSize: "0.72rem", padding: "0.4rem 0.7rem" }}>
              {r.read ? "Mark unread" : "Mark read"}
            </button>
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
      <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
        Your AI hiring dashboard lives in its own dedicated space and works exactly as before.
      </p>
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
function Empty({ children }) {
  return <p style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{children}</p>;
}
function fmtDate(s, withTime) {
  if (!s) return "";
  const d = new Date(s);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return withTime ? `${date}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : date;
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
const cta = { display: "inline-block", background: "linear-gradient(180deg, #FF2A2A 0%, #C20000 50%, #8B0000 100%)", color: "#fff", padding: "0.8rem 1.4rem", fontSize: "0.8rem", fontWeight: 800, border: "none", borderRadius: 8, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "inherit", textDecoration: "none", textAlign: "center" };
const ghostBtn = { display: "inline-block", background: "rgba(255,255,255,0.05)", color: "#fff", padding: "0.7rem 1.1rem", fontSize: "0.78rem", fontWeight: 700, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", textAlign: "center" };
const tabBtn = (active) => ({ background: active ? "rgba(255,31,31,0.15)" : "transparent", color: active ? "#FF6666" : "rgba(255,255,255,0.6)", padding: "0.55rem 1rem", fontSize: "0.85rem", fontWeight: 700, border: active ? "1px solid rgba(255,31,31,0.3)" : "1px solid transparent", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" });
const rowStyle = { display: "flex", alignItems: "center", gap: "1rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "0.85rem 1.25rem", transition: "all 0.2s ease" };
const subHead = { color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.2em", margin: "2.5rem 0 1rem" };
const fieldLabel = { display: "block", color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.5rem" };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" };
const drawer = { width: "min(520px, 100%)", height: "100%", overflowY: "auto", background: "linear-gradient(135deg, #0c0c0c 0%, #000 100%)", borderLeft: "1px solid rgba(255,31,31,0.25)", padding: "2.5rem 2rem", position: "relative" };
const closeBtn = { position: "absolute", top: "1.25rem", right: "1.25rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", width: 36, height: 36, borderRadius: "50%", cursor: "pointer" };
