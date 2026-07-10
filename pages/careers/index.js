import React, { useState } from "react";
import Head from "next/head";
import { ROLES, knockout, questionnaire } from "../../lib/hiring/index.js";

export default function Careers() {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState("");
  const [contact, setContact] = useState({ name: "", phone: "", email: "" });
  const [koAnswers, setKoAnswers] = useState({});
  const [survey, setSurvey] = useState({});
  const [resume, setResume] = useState(null); // { base64, filename }
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // 'received' | 'not_a_fit' | 'error'

  const TOTAL = 5;

  const canRole = !!role;
  const canContact = contact.name && contact.phone && contact.email;
  const canKo = knockout.questions.every((q) => koAnswers[q.id]);
  const canSurvey = questionnaire.questions.every(
    (q) => survey[q.id] && survey[q.id].trim().length > 0
  );

  const next = () => setStep((s) => Math.min(TOTAL, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const handleResume = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1] || "";
      setResume({ base64, filename: file.name });
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/careers/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          role,
          knockoutAnswers: koAnswers,
          surveyAnswers: survey,
          resumeBase64: resume?.base64 || null,
          resumeFilename: resume?.filename || null
        })
      });
      const data = await res.json();
      setDone(data.success ? data.outcome : "error");
    } catch (err) {
      setDone("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Careers — The Tire Plug | Join the Team</title>
        <meta name="description" content="Apply to join The Tire Plug. We hire for character first. Honest work, real pay, a team that has your back." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main style={pageStyle}>
        {/* ambient glows */}
        <div style={glowTop} />
        <div style={glowBottom} />

        <div style={{ maxWidth: 760, margin: "0 auto", position: "relative", zIndex: 2 }}>
          {/* brand bar */}
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <a href="/" style={{ textDecoration: "none" }}>
              <span style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 900, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                The Tire <span style={{ color: "#FF1F1F" }}>Plug</span>
              </span>
            </a>
          </div>

          {!done ? (
            <>
              {/* header */}
              <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                  <div style={{ width: 30, height: 1, background: "linear-gradient(90deg, transparent, #FF1F1F)" }} />
                  <span style={kicker}>Now Hiring</span>
                  <div style={{ width: 30, height: 1, background: "linear-gradient(90deg, #FF1F1F, transparent)" }} />
                </div>
                <h1 style={h1}>
                  <span style={whiteGrad}>Built Different.</span>
                  <span style={redGrad}>Hired Different.</span>
                </h1>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "1rem", maxWidth: 520, margin: "0 auto" }}>
                  We hire for character first — skill we can teach. This takes about 10 minutes. Be honest; that's the whole point.
                </p>
              </div>

              <div style={card}>
                {/* progress */}
                <div style={{ marginBottom: "2rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={progLabel}>Progress</span>
                    <span style={{ color: "#FF3838", fontSize: "0.7rem", fontWeight: 800 }}>{Math.round((step / TOTAL) * 100)}%</span>
                  </div>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(step / TOTAL) * 100}%`, background: "linear-gradient(90deg, #FF1F1F, #FF3838)", transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)", boxShadow: "0 0 10px rgba(255,31,31,0.6)" }} />
                  </div>
                </div>

                {/* STEP 1 — ROLE */}
                {step === 1 && (
                  <div className="step">
                    <p style={stepLabel}>Which role are you applying for?</p>
                    <p style={stepSub}>Pick the one that fits you best</p>
                    <div style={{ display: "grid", gap: "0.6rem" }}>
                      {ROLES.map((r) => (
                        <button key={r.id} type="button" onClick={() => setRole(r.id)} className="opt"
                          style={optBtn(role === r.id)}>
                          <span style={{ fontWeight: 700, color: role === r.id ? "#FF3838" : "#fff" }}>{r.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* STEP 2 — CONTACT */}
                {step === 2 && (
                  <div className="step">
                    <p style={stepLabel}>Let's start with the basics</p>
                    <p style={stepSub}>So we can reach you</p>
                    <input className="inp" style={input} placeholder="Full Name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
                    <input className="inp" style={input} placeholder="Phone Number" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
                    <input className="inp" style={input} placeholder="Email" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                  </div>
                )}

                {/* STEP 3 — KNOCKOUT */}
                {step === 3 && (
                  <div className="step">
                    <p style={stepLabel}>A few quick requirements</p>
                    <p style={stepSub}>Honest answers only</p>
                    {knockout.questions.map((q) => (
                      <div key={q.id} style={{ marginBottom: "1.1rem" }}>
                        <p style={{ color: "#fff", fontSize: "0.92rem", marginBottom: "0.5rem", fontWeight: 600 }}>{q.label}</p>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          {q.options.map((opt) => (
                            <button key={opt} type="button" onClick={() => setKoAnswers({ ...koAnswers, [q.id]: opt })}
                              className="opt" style={{ ...optBtn(koAnswers[q.id] === opt), flex: 1, textTransform: "capitalize", textAlign: "center", justifyContent: "center" }}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* STEP 4 — SURVEY */}
                {step === 4 && (
                  <div className="step">
                    <p style={stepLabel}>How you'd handle the floor</p>
                    <p style={stepSub}>There are no trick questions — just be real. Short answers are fine.</p>
                    {questionnaire.questions.map((q, i) => (
                      <div key={q.id} style={{ marginBottom: "1.3rem" }}>
                        <p style={{ color: "#FF3838", fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.1em", marginBottom: "0.4rem" }}>QUESTION {i + 1} OF {questionnaire.questions.length}</p>
                        <p style={{ color: "#fff", fontSize: "0.95rem", marginBottom: "0.6rem", lineHeight: 1.5 }}>{q.scenario}</p>
                        <textarea className="inp" rows={3} style={{ ...input, resize: "vertical", minHeight: 80 }}
                          placeholder="Your answer..." value={survey[q.id] || ""} onChange={(e) => setSurvey({ ...survey, [q.id]: e.target.value })} />
                      </div>
                    ))}
                  </div>
                )}

                {/* STEP 5 — RESUME + SUBMIT */}
                {step === 5 && (
                  <div className="step">
                    <p style={stepLabel}>Last step — your resume</p>
                    <p style={stepSub}>Optional, but it helps. PDF only.</p>
                    <label style={uploadBox} className="opt">
                      <input type="file" accept="application/pdf" onChange={handleResume} style={{ display: "none" }} />
                      {resume ? (
                        <span style={{ color: "#FF3838", fontWeight: 700 }}>✓ {resume.filename}</span>
                      ) : (
                        <span style={{ color: "rgba(255,255,255,0.7)" }}>📎 Tap to attach your resume (PDF)</span>
                      )}
                    </label>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", marginTop: "1rem", textAlign: "center" }}>
                      By submitting you confirm your answers are truthful. We check references and ask every one: "Would you rehire?"
                    </p>
                  </div>
                )}

                {/* NAV */}
                <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.5rem" }}>
                  {step > 1 && (
                    <button type="button" onClick={back} className="backBtn" style={backStyle}>← Back</button>
                  )}
                  {step < TOTAL ? (
                    <button type="button" onClick={next}
                      disabled={(step === 1 && !canRole) || (step === 2 && !canContact) || (step === 3 && !canKo) || (step === 4 && !canSurvey)}
                      className="cta" style={ctaStyle((step === 1 && !canRole) || (step === 2 && !canContact) || (step === 3 && !canKo) || (step === 4 && !canSurvey))}>
                      Continue →
                    </button>
                  ) : (
                    <button type="button" onClick={submit} disabled={submitting} className="cta" style={ctaStyle(submitting)}>
                      {submitting ? "SUBMITTING..." : "SUBMIT APPLICATION"}
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={card}>
              <div style={{ textAlign: "center", padding: "2.5rem 0" }}>
                {done === "received" && (
                  <>
                    <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🔧</div>
                    <h2 style={doneH}>Application <span style={redGrad2}>Received.</span></h2>
                    <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "1rem", marginBottom: "0.5rem" }}>Thanks, {contact.name.split(" ")[0]}. We review every application personally.</p>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem" }}>If it's a fit, we'll reach out to set up a time.</p>
                  </>
                )}
                {done === "not_a_fit" && (
                  <>
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🙏</div>
                    <h2 style={doneH}>Thanks for applying.</h2>
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.95rem", maxWidth: 420, margin: "0 auto" }}>{knockout.meta.rejection_message}</p>
                  </>
                )}
                {done === "error" && (
                  <>
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
                    <h2 style={doneH}>Something went wrong.</h2>
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.95rem" }}>Please try again, or call us at 562-500-4625.</p>
                  </>
                )}
                <a href="/" style={{ display: "inline-block", marginTop: "1.75rem", color: "#FF3838", textDecoration: "none", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>← Back to Home</a>
              </div>
            </div>
          )}
        </div>

        <style jsx>{`
          .inp:focus { border-color: #FF1F1F !important; background: rgba(255,31,31,0.05) !important; box-shadow: 0 0 20px rgba(255,31,31,0.15); }
          .opt:hover { background: rgba(255,31,31,0.08) !important; border-color: rgba(255,31,31,0.4) !important; }
          .backBtn:hover { background: rgba(255,255,255,0.08) !important; }
          .cta:hover:not(:disabled) { transform: translateY(-2px); }
          .step { animation: slideIn 0.4s cubic-bezier(0.4,0,0.2,1); }
          @keyframes slideIn { from { opacity: 0; transform: translateX(15px); } to { opacity: 1; transform: translateX(0); } }
        `}</style>
      </main>
    </>
  );
}

/* ---- styles ---- */
const pageStyle = { background: "#000", minHeight: "100vh", padding: "3rem 1.25rem 5rem", color: "#fff", position: "relative", overflow: "hidden", fontFamily: "system-ui, -apple-system, sans-serif" };
const glowTop = { position: "absolute", top: "10%", left: "-10%", width: 600, height: 600, background: "radial-gradient(circle, rgba(255,31,31,0.12) 0%, transparent 60%)", filter: "blur(120px)", pointerEvents: "none" };
const glowBottom = { position: "absolute", bottom: "5%", right: "-10%", width: 500, height: 500, background: "radial-gradient(circle, rgba(255,31,31,0.1) 0%, transparent 60%)", filter: "blur(120px)", pointerEvents: "none" };
const kicker = { color: "#FF3838", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase" };
const h1 = { fontSize: "clamp(2.25rem, 6vw, 4rem)", fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.04em", textTransform: "uppercase", marginBottom: "1rem" };
const whiteGrad = { display: "block", background: "linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.85) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" };
const redGrad = { display: "block", background: "linear-gradient(180deg, #FF3838 0%, #B30000 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", filter: "drop-shadow(0 0 30px rgba(255,31,31,0.4))" };
const redGrad2 = { background: "linear-gradient(180deg, #FF3838 0%, #B30000 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" };
const card = { background: "linear-gradient(135deg, rgba(20,20,20,0.85) 0%, rgba(0,0,0,0.95) 100%)", border: "1px solid rgba(255,31,31,0.25)", borderRadius: 20, padding: "2.25rem 2rem", boxShadow: "0 30px 80px rgba(0,0,0,0.5), 0 0 80px rgba(255,31,31,0.1)" };
const progLabel = { color: "rgba(255,255,255,0.4)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase" };
const stepLabel = { color: "#fff", fontSize: "1.4rem", marginBottom: "0.35rem", letterSpacing: "-0.02em", fontWeight: 800, textTransform: "uppercase" };
const stepSub = { color: "rgba(255,255,255,0.55)", fontSize: "0.82rem", marginBottom: "1.25rem" };
const input = { width: "100%", padding: "1rem 1.15rem", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, background: "rgba(255,255,255,0.03)", color: "#fff", fontSize: "0.95rem", marginBottom: "0.6rem", fontFamily: "inherit", outline: "none", transition: "all 0.3s ease", boxSizing: "border-box" };
const uploadBox = { display: "flex", alignItems: "center", justifyContent: "center", padding: "1.75rem", border: "1px dashed rgba(255,31,31,0.4)", borderRadius: 12, background: "rgba(255,31,31,0.04)", cursor: "pointer", textAlign: "center" };
const doneH = { color: "#fff", fontSize: "1.9rem", fontWeight: 900, marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "-0.02em" };

function optBtn(selected) {
  return { background: selected ? "rgba(255,31,31,0.15)" : "rgba(255,255,255,0.03)", border: selected ? "1px solid #FF1F1F" : "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "1rem", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.3s ease", display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.95rem", boxShadow: selected ? "0 0 20px rgba(255,31,31,0.2)" : "none" };
}
function ctaStyle(disabled) {
  return { flex: 2, background: "linear-gradient(180deg, #FF2A2A 0%, #C20000 50%, #8B0000 100%)", color: "#fff", padding: "1.15rem", fontSize: "0.9rem", fontWeight: 800, border: "none", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", letterSpacing: "0.2em", textTransform: "uppercase", boxShadow: "0 10px 30px rgba(139,0,0,0.5), 0 0 50px rgba(255,42,42,0.25)", fontFamily: "inherit", transition: "all 0.3s ease", opacity: disabled ? 0.4 : 1 };
}
const backStyle = { flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", padding: "1.15rem", fontSize: "0.85rem", fontWeight: 700, borderRadius: 8, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.15em", textTransform: "uppercase", transition: "all 0.3s ease" };
