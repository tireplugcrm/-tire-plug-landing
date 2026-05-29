import React, { useState, useEffect } from "react";
import Head from "next/head";

export default function CareersAdmin() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? sessionStorage.getItem("careers_pw") : "";
    if (saved) { setPassword(saved); load(saved); }
  }, []);

  async function load(pw) {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/careers/list", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Login failed"); setAuthed(false); return; }
      sessionStorage.setItem("careers_pw", pw);
      setApplicants(data.applicants || []);
      setAuthed(true);
    } catch (e) { setError("Network error"); }
    finally { setLoading(false); }
  }

  async function viewResume(path) {
    const res = await fetch("/api/careers/resume", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, path })
    });
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
  }

  async function saveApplicant(id, patch) {
    await fetch("/api/careers/update", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, id, ...patch })
    });
    load(password);
  }

  const live = applicants.filter((a) => a.status !== "rejected_knockout" && a.status !== "archived");
  const filtered = applicants.filter((a) => a.status === "rejected_knockout");

  if (!authed) {
    return (
      <Shell title="Careers Admin">
        <div style={{ maxWidth: 360, margin: "12vh auto 0" }}>
          <h1 style={{ color: "#fff", textAlign: "center", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", marginBottom: "1.5rem" }}>
            Hiring <span style={{ color: "#FF1F1F" }}>Dashboard</span>
          </h1>
          <input type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(password)}
            style={inp} />
          <button onClick={() => load(password)} disabled={loading} style={cta}>
            {loading ? "..." : "Enter"}
          </button>
          {error && <p style={{ color: "#FF6666", textAlign: "center", marginTop: "1rem", fontSize: "0.85rem" }}>{error}</p>}
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Careers Admin">
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h1 style={{ color: "#fff", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", fontSize: "1.5rem" }}>
            Applicants <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400, fontSize: "1rem" }}>({live.length} active)</span>
          </h1>
          <button onClick={() => load(password)} style={ghostBtn}>↻ Refresh</button>
        </div>

        {live.length === 0 && <p style={{ color: "rgba(255,255,255,0.5)" }}>No applications yet. Share <strong style={{ color: "#FF3838" }}>tireplugla.com/careers</strong> to start.</p>}

        <div style={{ display: "grid", gap: "0.75rem" }}>
          {live.map((a) => (
            <Row key={a.id} a={a} onClick={() => setSelected(a)} />
          ))}
        </div>

        {filtered.length > 0 && (
          <>
            <h2 style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.2em", margin: "2.5rem 0 1rem" }}>
              Auto-filtered ({filtered.length}) — failed knockout
            </h2>
            <div style={{ display: "grid", gap: "0.5rem", opacity: 0.55 }}>
              {filtered.map((a) => (
                <div key={a.id} style={{ ...rowStyle, cursor: "default" }}>
                  <span style={{ color: "#fff", fontWeight: 600 }}>{a.name}</span>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>{a.role_label}</span>
                  <span style={{ color: "#FF6666", fontSize: "0.75rem" }}>Not a fit</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {selected && (
        <Detail a={selected} onClose={() => setSelected(null)} onResume={viewResume} onSave={saveApplicant} />
      )}
    </Shell>
  );
}

function Row({ a, onClick }) {
  const score = a.strength_score;
  const color = a.disqualified ? "#FF6666" : score >= 85 ? "#3DD68C" : score >= 70 ? "#9ACD32" : score >= 55 ? "#FFB800" : "#FF8844";
  return (
    <div onClick={onClick} style={{ ...rowStyle, cursor: "pointer" }} className="adminRow">
      <div style={{ width: 64, textAlign: "center" }}>
        <div style={{ fontSize: "1.6rem", fontWeight: 900, color, lineHeight: 1 }}>{score != null ? Math.round(score) : "—"}</div>
        <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>SCORE</div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: "#fff", fontWeight: 700 }}>{a.name} {a.reviewed && <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.7rem" }}>· reviewed</span>}</div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>{a.role_label} · {a.band || a.status}</div>
      </div>
      {a.gate_reasons?.length > 0 && (
        <span style={{ background: "rgba(255,68,68,0.15)", color: "#FF6666", fontSize: "0.65rem", padding: "0.3rem 0.6rem", borderRadius: 50, fontWeight: 700, border: "1px solid rgba(255,68,68,0.3)" }}>
          ⚠ {a.gate_reasons.length} flag{a.gate_reasons.length > 1 ? "s" : ""}
        </span>
      )}
      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "1.2rem" }}>›</span>
    </div>
  );
}

function Detail({ a, onClose, onResume, onSave }) {
  const [notes, setNotes] = useState(a.owner_notes || "");
  const graded = a.graded || [];
  const traits = a.trait_scores || {};

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={drawer}>
        <button onClick={onClose} style={closeBtn}>✕</button>
        <h2 style={{ color: "#fff", fontWeight: 900, fontSize: "1.5rem", marginBottom: "0.25rem" }}>{a.name}</h2>
        <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: "1.25rem" }}>{a.role_label} · {a.email} · {a.phone}</p>

        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <Stat label="Strength" value={a.strength_score != null ? Math.round(a.strength_score) : "—"} />
          <Stat label="Band" value={a.band || a.status} small />
        </div>

        {a.gate_reasons?.length > 0 && (
          <div style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 12, padding: "1rem", marginBottom: "1.5rem" }}>
            <p style={{ color: "#FF6666", fontWeight: 800, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>⚠ Flags to check</p>
            {a.gate_reasons.map((g, i) => <p key={i} style={{ color: "#fff", fontSize: "0.85rem", marginBottom: "0.25rem" }}>• {g}</p>)}
          </div>
        )}

        {Object.keys(traits).length > 0 && (
          <Section title="Trait scores (0–5)">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              {Object.entries(traits).map(([t, v]) => (
                <div key={t} style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", padding: "0.5rem 0.75rem", borderRadius: 8 }}>
                  <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8rem" }}>{t.replace(/_/g, " ")}</span>
                  <span style={{ color: "#FF3838", fontWeight: 700, fontSize: "0.8rem" }}>{v}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {graded.length > 0 && (
          <Section title="Answers + grades">
            {graded.map((g, i) => (
              <div key={i} style={{ borderLeft: "2px solid rgba(255,31,31,0.3)", paddingLeft: "0.85rem", marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem" }}>{(g.questionId || "").replace(/_/g, " ")}</span>
                  <span style={{ color: g.score >= 4 ? "#3DD68C" : g.score >= 3 ? "#FFB800" : "#FF6666", fontWeight: 800, fontSize: "0.85rem" }}>{g.score != null ? `${g.score}/5` : "review"}</span>
                </div>
                <p style={{ color: "#fff", fontSize: "0.85rem", margin: "0.35rem 0", lineHeight: 1.5 }}>"{a.survey_answers?.[g.questionId] || ""}"</p>
                {g.reasoning && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", fontStyle: "italic" }}>{g.reasoning}</p>}
              </div>
            ))}
          </Section>
        )}

        {a.resume_review && (
          <Section title="Resume review">
            {a.resume_path && <button onClick={() => onResume(a.resume_path)} style={ghostBtn}>📄 Open resume PDF</button>}
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", margin: "0.75rem 0", lineHeight: 1.5 }}>{a.resume_review.overallNote}</p>
            {(a.resume_review.references || []).map((r, i) => (
              <div key={i} style={{ background: "rgba(255,31,31,0.06)", borderRadius: 8, padding: "0.6rem 0.85rem", marginBottom: "0.5rem" }}>
                <span style={{ color: "#FF3838", fontWeight: 700, fontSize: "0.82rem" }}>{r.name}</span>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}> — {r.relationship} {r.contact ? `(${r.contact})` : ""}</span>
                <p style={{ color: "#FFB800", fontSize: "0.75rem", marginTop: "0.25rem" }}>Ask: {r.mustAsk}</p>
              </div>
            ))}
          </Section>
        )}

        <Section title="Your notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} placeholder="Notes from the call / interview..." />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            <button onClick={() => onSave(a.id, { owner_notes: notes, reviewed: true })} style={cta}>Save & mark reviewed</button>
            <button onClick={() => onSave(a.id, { status: "hired" })} style={ghostBtn}>✓ Hired</button>
            <button onClick={() => onSave(a.id, { status: "archived" })} style={ghostBtn}>Archive</button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "0.75rem" }}>{title}</p>
      {children}
    </div>
  );
}
function Stat({ label, value, small }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "0.85rem 1.25rem", flex: 1, minWidth: 120 }}>
      <div style={{ color: "#FF3838", fontWeight: 900, fontSize: small ? "1rem" : "1.8rem", lineHeight: 1.1 }}>{value}</div>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
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
const inp = { width: "100%", padding: "1rem 1.15rem", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, background: "rgba(255,255,255,0.03)", color: "#fff", fontSize: "0.95rem", marginBottom: "0.6rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
const cta = { background: "linear-gradient(180deg, #FF2A2A 0%, #C20000 50%, #8B0000 100%)", color: "#fff", padding: "0.85rem 1.5rem", fontSize: "0.82rem", fontWeight: 800, border: "none", borderRadius: 8, cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "inherit" };
const ghostBtn = { background: "rgba(255,255,255,0.05)", color: "#fff", padding: "0.7rem 1.1rem", fontSize: "0.78rem", fontWeight: 700, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" };
const rowStyle = { display: "flex", alignItems: "center", gap: "1rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "0.85rem 1.25rem", transition: "all 0.2s ease" };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" };
const drawer = { width: "min(560px, 100%)", height: "100%", overflowY: "auto", background: "linear-gradient(135deg, #0c0c0c 0%, #000 100%)", borderLeft: "1px solid rgba(255,31,31,0.25)", padding: "2.5rem 2rem", position: "relative" };
const closeBtn = { position: "absolute", top: "1.25rem", right: "1.25rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", width: 36, height: 36, borderRadius: "50%", cursor: "pointer" };
