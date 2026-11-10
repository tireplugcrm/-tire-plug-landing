import React, { useEffect, useState } from "react";
import Head from "next/head";
import BelenBonus from "../components/BelenBonus.js";
import TodoTab from "../components/admin/TodoTab.js";

/* Belen's page. iPhone-style 4-digit passcode (same as /junior), then three tabs:
   Today (her to-do list from the admin, she ticks it off), Good to know (shop info, no boxes) and My bonus (her business accounts,
   the profit they brought in this month and her bonus; she can add a business she just signed).
   The owner edits both from the admin "Belen" tab. ?demo=1 shows made-up bonus numbers. */

const KEYS = [["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"], null, ["0", ""], "del"];
const SS = "belen_code";

async function post(body, url = "/api/belen") {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(j.error || "Something went wrong."); e.status = res.status; throw e; }
  return j;
}

export default function Belen() {
  const [code, setCode] = useState("");
  const [ok, setOk] = useState(false);
  const [demo, setDemo] = useState(""); // "", "1", or "edit" (shows the owner's controls; nothing saves)
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);
  const [view, setView] = useState("today");

  useEffect(() => {
    const dm = new URLSearchParams(window.location.search).get("demo"); if (dm) { setDemo(dm); setOk(true); setView("bonus"); return; }
    let saved = "";
    try { saved = sessionStorage.getItem(SS) || ""; } catch { /* private mode */ }
    if (saved) post({ code: saved, action: "state" }).then(() => { setCode(saved); setOk(true); post({ code: saved, action: "ping", event: "open" }).catch(() => {}); }).catch(() => { try { sessionStorage.removeItem(SS); } catch { /* */ } });
  }, []);

  async function press(k) {
    if (checking) return;
    if (k === "del") { setCode((c) => c.slice(0, -1)); setErr(""); return; }
    const next = (code + k).slice(0, 4);
    setCode(next);
    if (next.length < 4) return;
    setChecking(true);
    try {
      await post({ code: next, action: "state" });
      try { sessionStorage.setItem(SS, next); } catch { /* */ }
      setOk(true);
      post({ code: next, action: "ping", event: "open" }).catch(() => {});
    } catch (e) {
      setErr(e.message); setShake(true);
      setTimeout(() => { setShake(false); setCode(""); }, 450);
    }
    setChecking(false);
  }

  useEffect(() => {
    if (ok) return undefined;
    const onKey = (e) => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === "Backspace") press("del"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const call = (body) => post(demo ? { demo: true, ...body } : { code, ...body });
  const todoCall = (body) => post({ code, who: "belen", ...body }, "/api/admin/todo");

  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(120% 80% at 50% 0%, #1f2937 0%, #0b0f15 70%)", color: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", padding: "28px 16px 40px", boxSizing: "border-box" }}>
      <Head>
        <title>Belen · The Tire Plug</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="robots" content="noindex" />
        <meta name="theme-color" content="#0b0f15" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,300..500,0,0" />
      </Head>
      <style>{`@keyframes shake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-8px)}40%,60%{transform:translateX(8px)}}
        .kp{width:78px;height:78px;border-radius:50%;border:0;background:rgba(255,255,255,.14);color:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:inherit;-webkit-tap-highlight-color:transparent;transition:background .12s}
        .kp:active{background:rgba(255,255,255,.4)}`}</style>

      {!ok ? (
        <div style={{ maxWidth: 320, margin: "0 auto", textAlign: "center", paddingTop: "6vh" }}>
          <div style={{ fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,.55)" }}>The Tire Plug</div>
          <div style={{ fontSize: 22, fontWeight: 500, margin: "10px 0 22px" }}>Enter Passcode</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 22, marginBottom: 14, animation: shake ? "shake .45s" : "none" }}>
            {[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 13, height: 13, borderRadius: "50%", border: "1.5px solid #fff", background: i < code.length ? "#fff" : "transparent" }} />)}
          </div>
          <div style={{ height: 22, fontSize: 14, color: "#fca5a5" }}>{err}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 78px)", gap: "16px 24px", justifyContent: "center", marginTop: 18 }}>
            {KEYS.map((k, i) => k === null ? <span key={i} /> : k === "del" ? (
              <button key={i} onClick={() => press("del")} aria-label="Delete" style={{ background: "none", border: 0, color: "#fff", fontSize: 17, cursor: "pointer", fontFamily: "inherit", visibility: code ? "visible" : "hidden" }}>Delete</button>
            ) : (
              <button key={i} className="kp" onClick={() => press(k[0])} aria-label={k[0]}>
                <span style={{ fontSize: 34, fontWeight: 400, lineHeight: 1 }}>{k[0]}</span>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", height: 12, marginTop: 1 }}>{k[1]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,.55)" }}>The Tire Plug{demo ? " · demo numbers" : ""}</div>
              <h1 style={{ margin: "2px 0 0", fontSize: 26, fontWeight: 800 }}>Belen</h1>
            </div>
            {!demo && <button onClick={() => { try { sessionStorage.removeItem(SS); } catch { /* */ } setOk(false); setCode(""); }} style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", color: "#fff", borderRadius: 999, height: 34, padding: "0 14px", fontFamily: "inherit", cursor: "pointer" }}>Lock</button>}
          </div>
          <div role="tablist" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, padding: 4, borderRadius: 999, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)", marginBottom: 16 }}>
            {[["today", "Today"], ["know", "Good to know"], ["bonus", "My bonus"]].map(([id, lbl]) => (
              <button key={id} role="tab" aria-selected={view === id} onClick={() => { setView(id); if (!demo && id !== view) post({ code, action: "ping", event: "tab", detail: id }).catch(() => {}); }} style={{ height: 36, borderRadius: 999, border: 0, background: view === id ? "#fff" : "transparent", color: view === id ? "#0b0f15" : "#fff", fontWeight: 600, fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>{lbl}</button>
            ))}
          </div>
          {view === "know"
            ? (demo ? <div style={{ color: "rgba(255,255,255,.6)", textAlign: "center", padding: 24 }}>This list needs the real code.</div> : <TodoTab key="know" who="belen" name="Belen" call={todoCall} canEdit={false} list="know" />)
            : view === "today"
            ? (demo ? <div style={{ color: "rgba(255,255,255,.6)", textAlign: "center", padding: 24 }}>The to-do list needs the real code.</div> : <TodoTab key="todo" who="belen" name="Belen" call={todoCall} canEdit={false} />)
            : <BelenBonus call={call} canEdit={demo === "edit"} guide={demo ? null : <TodoTab key="plan" who="belen" name="Belen" call={todoCall} canEdit={false} list="plan" />} />}
        </div>
      )}
    </main>
  );
}
