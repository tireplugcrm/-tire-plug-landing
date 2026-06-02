import React, { useState } from "react";
import Head from "next/head";

/* Public SMS opt-in page — a clear, single-screen consent form (for customers
   and for A2P carrier review). Linked from the footer. */
export default function SmsOptIn() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const canSubmit = name.trim() && phone.trim() && consent;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true); setErr("");
    try {
      const res = await fetch("/api/submit-booking", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, phone, email: "", vehicle: "N/A", tireSize: "N/A", tireType: "N/A",
          service: "SMS Updates", serviceTiming: "SMS Opt-in", leadPriority: "WARM",
          smsConsent: true, source: "Website SMS Opt-in",
          date: new Date().toISOString().split("T")[0], time: "00:00",
        }),
      });
      const d = await res.json();
      if (d.success) setDone(true);
      else setErr("Something went wrong — please call 562-513-0217.");
    } catch (e2) { setErr("Network error — please call 562-513-0217."); }
    finally { setSubmitting(false); }
  }

  return (
    <>
      <Head><title>Text Alerts · The Tire Plug</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <main style={{ background: "#000", minHeight: "100vh", padding: "3rem 1.25rem 5rem", fontFamily: "system-ui, -apple-system, sans-serif", color: "#fff" }}>
        <div style={{ maxWidth: 460, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
            <div style={{ width: 76, height: 76, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "0 0 0 2px rgba(255,31,31,0.4), 0 0 24px rgba(255,31,31,0.25)" }}>
              <img src="/images/logo.webp" alt="The Tire Plug" style={{ width: "130%", height: "130%", objectFit: "cover" }} />
            </div>
          </div>
          <h1 style={{ textAlign: "center", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", fontSize: "1.7rem", marginBottom: "0.5rem" }}>
            Get Tire Plug <span style={{ color: "#FF1F1F" }}>Text Updates</span>
          </h1>
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "0.92rem", lineHeight: 1.5, marginBottom: "2rem" }}>
            Quotes, appointment reminders, and exclusive deals — straight to your phone.
          </p>

          {done ? (
            <div style={{ textAlign: "center", background: "rgba(61,214,140,0.08)", border: "1px solid rgba(61,214,140,0.3)", borderRadius: 14, padding: "2rem 1.5rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>✓</div>
              <h2 style={{ color: "#3DD68C", fontWeight: 800, marginBottom: "0.5rem" }}>You're signed up!</h2>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.9rem" }}>Watch your phone for updates. Reply STOP anytime to opt out.</p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" style={inp} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" type="tel" style={inp} />

              <label style={{ display: "flex", alignItems: "flex-start", gap: "0.7rem", margin: "1rem 0 1.25rem", cursor: "pointer" }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: "0.2rem", width: 20, height: 20, accentColor: "#FF1F1F", flexShrink: 0, cursor: "pointer" }} />
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8rem", lineHeight: 1.55 }}>
                  Yes, sign me up. I agree to receive recurring automated text messages from The Tire Plug
                  (quotes, appointment reminders, and offers). Msg frequency varies. Msg &amp; data rates may apply.
                  Reply <strong>STOP</strong> to opt out, <strong>HELP</strong> for help. Consent is not a condition
                  of any purchase. See our{" "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#FF3838", textDecoration: "underline" }}>Privacy Policy</a>{" "}&amp;{" "}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#FF3838", textDecoration: "underline" }}>Terms</a>.
                </span>
              </label>

              <button type="submit" disabled={!canSubmit || submitting} style={{ ...cta, opacity: !canSubmit || submitting ? 0.4 : 1 }}>
                {submitting ? "Signing up…" : "Sign me up"}
              </button>
              {err && <p style={{ color: "#FF6666", textAlign: "center", marginTop: "1rem", fontSize: "0.85rem" }}>{err}</p>}
            </form>
          )}

          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: "0.72rem", marginTop: "1.5rem", lineHeight: 1.5 }}>
            The Tire Plug · Los Angeles, CA · 562-513-0217
          </p>
        </div>
      </main>
    </>
  );
}

const inp = { width: "100%", padding: "1rem 1.15rem", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, background: "rgba(255,255,255,0.03)", color: "#fff", fontSize: "0.95rem", marginBottom: "0.6rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
const cta = { width: "100%", background: "linear-gradient(180deg, #FF2A2A 0%, #C20000 50%, #8B0000 100%)", color: "#fff", padding: "1rem 1.5rem", fontSize: "0.85rem", fontWeight: 800, border: "none", borderRadius: 8, cursor: "pointer", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "inherit" };
