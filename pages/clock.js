import React, { useState, useEffect } from "react";
import Head from "next/head";

/* The Tire Plug — staff clock-in kiosk (shared shop tablet).
   Enter the shop kiosk code ONCE on the device (saved locally), then staff
   punch in/out with their 4-digit PIN. */
export default function ClockKiosk() {
  const [kioskCode, setKioskCode] = useState("");
  const [codeReady, setCodeReady] = useState(false);
  const [pin, setPin] = useState("");
  const [result, setResult] = useState(null); // { name, action, time, hours }
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("tp_kiosk_code") : "";
    if (saved) { setKioskCode(saved); setCodeReady(true); }
  }, []);

  function saveCode() {
    if (!kioskCode.trim()) return;
    localStorage.setItem("tp_kiosk_code", kioskCode.trim());
    setCodeReady(true);
  }
  function forgetDevice() {
    localStorage.removeItem("tp_kiosk_code");
    setKioskCode(""); setCodeReady(false); setPin(""); setResult(null); setError("");
  }

  function press(d) {
    setError(""); setResult(null);
    if (d === "del") return setPin((p) => p.slice(0, -1));
    if (d === "clear") return setPin("");
    if (pin.length < 6) setPin((p) => p + d);
  }

  async function submit() {
    if (!pin) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/clock", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kioskCode, pin }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Try again"); }
      else { setResult(d); setPin(""); }
    } catch (e) { setError("Network error"); }
    finally { setBusy(false); }
  }

  // Auto-clear the confirmation after a few seconds, ready for the next person.
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 4000);
    return () => clearTimeout(t);
  }, [result]);

  return (
    <>
      <Head><title>Clock In · The Tire Plug</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <main style={wrap}>
        <div style={{ width: "min(420px, 100%)" }}>
          <h1 style={{ textAlign: "center", color: "#fff", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "1.5rem", marginBottom: "0.25rem" }}>
            Tire Plug <span style={{ color: "#FF1F1F" }}>Time Clock</span>
          </h1>

          {!codeReady ? (
            <div style={{ marginTop: "2rem" }}>
              <p style={{ color: "rgba(255,255,255,0.6)", textAlign: "center", fontSize: "0.9rem", marginBottom: "1rem" }}>
                One-time device setup — enter the shop kiosk code.
              </p>
              <input value={kioskCode} onChange={(e) => setKioskCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveCode()}
                placeholder="Shop kiosk code" style={inp} type="password" />
              <button onClick={saveCode} style={cta}>Set up this device</button>
            </div>
          ) : (
            <>
              <p style={{ textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: "0.95rem", margin: "0.5rem 0 1.5rem" }}>
                Enter your PIN to clock in or out
              </p>

              <div style={{ minHeight: 64, marginBottom: "1rem", textAlign: "center" }}>
                {result ? (
                  <div style={{ background: result.action === "in" ? "rgba(61,214,140,0.12)" : "rgba(255,184,0,0.12)", border: `1px solid ${result.action === "in" ? "rgba(61,214,140,0.4)" : "rgba(255,184,0,0.4)"}`, borderRadius: 14, padding: "0.85rem 1rem" }}>
                    <div style={{ color: "#fff", fontWeight: 800, fontSize: "1.05rem" }}>
                      {result.action === "in" ? "✅ Clocked in" : "👋 Clocked out"} — {result.name}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.82rem", marginTop: "0.2rem" }}>
                      {new Date(result.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      {result.action === "out" && result.hours != null ? ` · ${result.hours} hrs this shift` : ""}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "2.4rem", letterSpacing: "0.4rem", color: "#fff", fontWeight: 800, fontFamily: "monospace" }}>
                    {pin ? "•".repeat(pin.length) : <span style={{ color: "rgba(255,255,255,0.25)" }}>••••</span>}
                  </div>
                )}
                {error && <p style={{ color: "#FF6666", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.6rem" }}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <button key={d} onClick={() => press(d)} style={key}>{d}</button>
                ))}
                <button onClick={() => press("clear")} style={{ ...key, fontSize: "0.9rem", color: "rgba(255,255,255,0.6)" }}>Clear</button>
                <button onClick={() => press("0")} style={key}>0</button>
                <button onClick={() => press("del")} style={{ ...key, fontSize: "1.3rem", color: "rgba(255,255,255,0.6)" }}>⌫</button>
              </div>

              <button onClick={submit} disabled={!pin || busy} style={{ ...cta, marginTop: "1rem", opacity: !pin || busy ? 0.45 : 1 }}>
                {busy ? "…" : "Clock in / out"}
              </button>

              <button onClick={forgetDevice} style={{ ...ghost, marginTop: "1.25rem" }}>Device setup</button>
            </>
          )}
        </div>
      </main>
    </>
  );
}

const wrap = { background: "#000", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1.25rem", fontFamily: "system-ui, -apple-system, sans-serif" };
const inp = { width: "100%", padding: "1rem 1.15rem", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: "1.05rem", marginBottom: "0.75rem", outline: "none", boxSizing: "border-box", textAlign: "center" };
const cta = { width: "100%", background: "linear-gradient(180deg, #FF2A2A 0%, #C20000 50%, #8B0000 100%)", color: "#fff", padding: "1.05rem 1.5rem", fontSize: "0.95rem", fontWeight: 800, border: "none", borderRadius: 12, cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "inherit" };
const key = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: "1.6rem", fontWeight: 700, padding: "1.1rem 0", borderRadius: 14, cursor: "pointer", fontFamily: "inherit" };
const ghost = { width: "100%", background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit" };
