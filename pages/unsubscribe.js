import React, { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

// Landing page for the "Unsubscribe" link in every marketing email.
// One button, no login: the signed link identifies the address.
export default function Unsubscribe() {
  const { query } = useRouter();
  const [state, setState] = useState("idle"); // idle | working | done | error
  const [msg, setMsg] = useState("");

  async function confirm() {
    setState("working");
    try {
      const r = await fetch("/api/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ e: query.e, t: query.t }) });
      const d = await r.json();
      if (r.ok) { setState("done"); setMsg(d.email); } else { setState("error"); setMsg(d.error); }
    } catch { setState("error"); setMsg("Network error. Please try again."); }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f4f4f4", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: "Helvetica, Arial, sans-serif" }}>
      <Head><title>Unsubscribe | The Tire Plug</title><meta name="robots" content="noindex" /></Head>
      <div style={{ background: "#fff", borderRadius: 16, maxWidth: 440, width: "100%", padding: "36px 28px", textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}>
        <img src="/images/email/logo.png" alt="The Tire Plug" width={110} style={{ display: "block", margin: "0 auto 20px" }} />
        {state === "done" ? (
          <>
            <h1 style={{ fontSize: 22, margin: "0 0 10px", color: "#111" }}>You're unsubscribed</h1>
            <p style={{ color: "#555", lineHeight: 1.6, margin: 0 }}><strong>{msg}</strong> won't get marketing emails from us anymore. Need tires later? Call <a href="tel:562-500-4625" style={{ color: "#E01B22" }}>562-500-4625</a>.</p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 22, margin: "0 0 10px", color: "#111" }}>Unsubscribe from our emails?</h1>
            <p style={{ color: "#555", lineHeight: 1.6, margin: "0 0 22px" }}>You'll stop getting deals and updates from The Tire Plug by email.</p>
            <button onClick={confirm} disabled={state === "working" || !query.e} style={{ background: "#E01B22", color: "#fff", border: "none", borderRadius: 8, padding: "14px 28px", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: state === "working" ? 0.6 : 1 }}>
              {state === "working" ? "Unsubscribing…" : "Yes, unsubscribe me"}
            </button>
            {state === "error" && <p style={{ color: "#c00", marginTop: 16, fontSize: 14 }}>{msg}</p>}
          </>
        )}
      </div>
    </main>
  );
}
