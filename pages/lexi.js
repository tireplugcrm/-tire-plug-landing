import React, { useEffect, useState } from "react";
import Head from "next/head";

/* Lexi's Commission Tracker. Big green Start, then RO # + RO name, and she's done.
   The shop matches each RO to Tekmetric and emails the commission recap every evening. */

const GREEN = "#16a34a";

export default function Lexi() {
  const [k, setK] = useState("");
  const [step, setStep] = useState("start"); // start | form | done
  const [ro, setRo] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [reported, setReported] = useState([]);

  async function call(body, key = k) {
    const res = await fetch("/api/lexi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ k: key, ...body }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Something went wrong. Try again.");
    return j;
  }
  async function load(key = k) {
    try { setReported((await call({ action: "state" }, key)).reported); setErr(""); } catch (e) { setErr(e.message); }
  }
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("k") || "";
    setK(key);
    if (key) load(key); else setErr("Open this page from the link in the text.");
    // eslint-disable-next-line
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await call({ action: "report", ro_number: ro, ro_name: name });
      setStep("done"); setRo(""); setName(""); load();
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  const big = { display: "block", width: "100%", border: 0, borderRadius: 18, background: GREEN, color: "#fff", fontWeight: 900, cursor: "pointer" };
  const input = { width: "100%", boxSizing: "border-box", fontSize: 22, padding: "16px 14px", borderRadius: 12, border: "2px solid #d4d4d8", marginTop: 6 };

  return (
    <main style={{ minHeight: "100vh", background: "#f4f4f5", fontFamily: "system-ui, -apple-system, sans-serif", padding: "32px 16px" }}>
      <Head><title>Lexi&apos;s Commission Tracker</title><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="robots" content="noindex" /></Head>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <h1 style={{ textAlign: "center", fontSize: 30, fontWeight: 900, margin: "0 0 28px", color: "#111" }}>Lexi&apos;s Commission Tracker</h1>

        {step === "start" && (
          <button type="button" onClick={() => setStep("form")} disabled={!k} style={{ ...big, fontSize: 44, padding: "70px 0", boxShadow: "0 10px 30px rgba(22,163,74,.35)" }}>Start</button>
        )}

        {step === "form" && (
          <form onSubmit={submit} style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 4px 18px rgba(0,0,0,.06)" }}>
            <p style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Which RO are you reporting?</p>
            <label style={{ display: "block", fontWeight: 700, color: "#444" }}>RO #
              <input style={input} inputMode="numeric" autoFocus value={ro} onChange={(e) => setRo(e.target.value)} placeholder="12345" required />
            </label>
            <label style={{ display: "block", fontWeight: 700, color: "#444", marginTop: 16 }}>RO Name
              <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name on the RO" required />
            </label>
            <button type="submit" disabled={busy} style={{ ...big, fontSize: 22, padding: "18px 0", marginTop: 22, opacity: busy ? 0.6 : 1 }}>{busy ? "Sending…" : "Submit"}</button>
          </form>
        )}

        {step === "done" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: GREEN, margin: "10px 0 20px" }}>Got it. You&apos;re done!</div>
            <button type="button" onClick={() => setStep("form")} style={{ ...big, fontSize: 20, padding: "18px 0" }}>Report another RO</button>
          </div>
        )}

        {err && <p style={{ color: "#b91c1c", fontWeight: 700, textAlign: "center", marginTop: 18 }}>{err}</p>}

        {reported.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#71717a", textTransform: "uppercase", letterSpacing: 1 }}>Reported today · {reported.length}</div>
            {reported.map((r) => (
              <div key={r.ro_number} style={{ display: "flex", justifyContent: "space-between", background: "#fff", borderRadius: 10, padding: "12px 14px", marginTop: 8 }}>
                <span><strong>RO #{r.ro_number}</strong> · {r.ro_name}</span>
                <span style={{ color: r.status === "matched" ? GREEN : "#a1a1aa", fontSize: 13, fontWeight: 700 }}>{r.status === "matched" ? "Matched" : r.status === "no-match" ? "Check RO #" : "Received"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
