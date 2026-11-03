import React, { useEffect, useState } from "react";
import Head from "next/head";

/* AI video waitlist: The Tire Plug x The AI Plug. Linked from the shop's Instagram story.
   One question per screen: business? -> what is it -> main goal -> name + email. Graded in /api/ai-waitlist. */

const GOLD = "#FFC400";
const SEND_AT = Date.parse("2026-11-09T08:00:00Z"); // Sunday 11/8 midnight, LA time
const GOALS = [
  { id: "customers", label: "Bring in more customers" },
  { id: "story", label: "Just document my story" },
  { id: "teach", label: "Learn AI so I can teach other people" },
];

function useCountdown() {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, SEND_AT - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return left;
}

function Countdown() {
  const left = useCountdown();
  if (left === 0) return <p className="sent">The PDF went out Sunday night. Join anyway and we'll send it to you.</p>;
  const s = Math.floor((left || 0) / 1000);
  const parts = [["Days", Math.floor(s / 86400)], ["Hrs", Math.floor(s / 3600) % 24], ["Min", Math.floor(s / 60) % 60], ["Sec", s % 60]];
  return (
    <div className="count" aria-label="Time until the PDF is sent">
      {parts.map(([l, v]) => (
        <div key={l}><b>{left === null ? "--" : String(v).padStart(2, "0")}</b><span>{l}</span></div>
      ))}
    </div>
  );
}

export default function AiWaitlist() {
  const [step, setStep] = useState("start"); // start | business | what | goal | contact | done | nope
  const [f, setF] = useState({ has_business: "", business: "", goal: "", first_name: "", email: "", instagram: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/ai-waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
      setStep("done");
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  const n = { business: 1, what: 2, goal: 3, contact: 4 }[step];

  return (
    <>
      <Head>
        <title>AI Videos for Your Business | Waitlist</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Join the waitlist. Get the tools I use to make AI videos for my business, emailed as a PDF Sunday night." />
        <meta property="og:title" content="Want to learn how to make AI videos for your business?" />
        <meta property="og:description" content="Join the waitlist. The PDF goes out Sunday 11/8 before midnight." />
        <meta property="og:image" content="/images/ai-plug/robot-ring.jpg" />
        <meta name="robots" content="noindex" />
        <meta name="theme-color" content="#0b0b0b" />
      </Head>

      <main className="page">
        <div className="collab">
          <img src="/images/logo.webp" alt="The Tire Plug" />
          <span>×</span>
          <img src="/images/ai-plug/robot-ring.jpg" alt="The AI Plug" />
        </div>
        <p className="by">THE TIRE PLUG × THE AI PLUG</p>

        {step === "start" && (
          <section>
            <h1>Want to learn how to make <em>AI videos</em> for your business?</h1>
            <p className="lead">Join the waitlist. I'll send you the tools I use to make the videos that bring customers into my tire shop.</p>
            <p className="kicker">PDF goes out Sunday 11/8 before midnight</p>
            <Countdown />
            <button className="cta" onClick={() => setStep("business")}>Join the waitlist</button>
            <p className="fine">4 quick questions · free</p>
          </section>
        )}

        {n && <div className="bar"><i style={{ width: `${n * 25}%` }} /></div>}

        {step === "business" && (
          <section>
            <p className="q-n">Question 1 of 4</p>
            <h2>Do you have a business?</h2>
            <div className="opts">
              <button onClick={() => { setF({ ...f, has_business: "yes" }); setStep("what"); }}>Yes</button>
              <button onClick={() => { setF({ ...f, has_business: "no" }); setStep("nope"); }}>No</button>
            </div>
          </section>
        )}

        {step === "what" && (
          <section>
            <p className="q-n">Question 2 of 4</p>
            <h2>What's your business?</h2>
            <form onSubmit={(e) => { e.preventDefault(); if (f.business.trim()) setStep("goal"); }}>
              <input autoFocus value={f.business} onChange={set("business")} placeholder="e.g. taco truck, barbershop, auto shop" maxLength={120} />
              <button className="cta" disabled={!f.business.trim()}>Next</button>
            </form>
            <button className="back" onClick={() => setStep("business")}>← Back</button>
          </section>
        )}

        {step === "goal" && (
          <section>
            <p className="q-n">Question 3 of 4</p>
            <h2>What's your main goal?</h2>
            <p className="fine">Pick one.</p>
            <div className="opts">
              {GOALS.map((g) => (
                <button key={g.id} className={f.goal === g.id ? "on" : ""} onClick={() => { setF({ ...f, goal: g.id }); setStep("contact"); }}>{g.label}</button>
              ))}
            </div>
            <button className="back" onClick={() => setStep("what")}>← Back</button>
          </section>
        )}

        {step === "contact" && (
          <section>
            <p className="q-n">Question 4 of 4</p>
            <h2>Where should we send the PDF?</h2>
            <form onSubmit={submit}>
              <input type="text" name="website" value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999 }} />
              <input value={f.first_name} onChange={set("first_name")} placeholder="First name" autoComplete="given-name" maxLength={80} required />
              <input type="email" value={f.email} onChange={set("email")} placeholder="Email" autoComplete="email" required />
              <input value={f.instagram} onChange={set("instagram")} placeholder="Instagram @ (optional)" maxLength={60} />
              {err && <p className="err">{err}</p>}
              <button className="cta" disabled={busy}>{busy ? "Saving…" : "Join the waitlist"}</button>
            </form>
            <p className="fine">We'll only email you about this. Unsubscribe anytime.</p>
            <button className="back" onClick={() => setStep("goal")}>← Back</button>
          </section>
        )}

        {step === "done" && (
          <section>
            <h1>You're <em>in</em>.</h1>
            <p className="lead">Look for the PDF in your email Sunday 11/8 before midnight. Check your spam folder if you don't see it.</p>
            <Countdown />
            <a className="cta" href="https://instagram.com/theartificialinteligenceplug">Follow @theartificialinteligenceplug</a>
          </section>
        )}

        {step === "nope" && (
          <section>
            <h2>This one's for business owners.</h2>
            <p className="lead">The PDF is built for people promoting a business. Follow along on Instagram, and when you start one, come back and join.</p>
            <a className="cta" href="https://instagram.com/theartificialinteligenceplug">Follow @theartificialinteligenceplug</a>
            <button className="back" onClick={() => setStep("business")}>← I do have a business</button>
          </section>
        )}

        <footer>Videos are made with AI tools. No income promises. · <a href="/privacy">Privacy</a></footer>
      </main>

      <style jsx global>{`
        html, body { background: #0b0b0b; margin: 0; }
        .count { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 0 0 24px; }
        .count div { background: #161616; border: 1px solid #262626; border-radius: 14px; padding: 12px 0 10px; text-align: center; }
        .count b { display: block; font-family: "Arial Black", Arial, sans-serif; font-size: 30px; color: #fff; font-variant-numeric: tabular-nums; }
        .count span { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #8a8a8a; }
        .sent { color: ${GOLD}; margin: 0 0 22px; }
      `}</style>
      <style jsx>{`
        .page { min-height: 100vh; max-width: 520px; margin: 0 auto; padding: 32px 20px 24px; color: #f2f2f2; font-family: "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif; display: flex; flex-direction: column; box-sizing: border-box; }
        .collab { display: flex; align-items: center; justify-content: center; gap: 14px; }
        .collab img { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; box-shadow: 0 0 0 2px #222; }
        .collab span { color: ${GOLD}; font-size: 22px; font-weight: 700; }
        .by { text-align: center; font-size: 11px; letter-spacing: .22em; color: #8a8a8a; margin: 10px 0 28px; }
        section { flex: 1; }
        h1, h2 { font-family: "Arial Black", "Arial Bold", Arial, sans-serif; line-height: 1.05; letter-spacing: -.01em; margin: 0 0 14px; }
        h1 { font-size: 38px; }
        h2 { font-size: 30px; }
        em { font-style: normal; color: ${GOLD}; }
        .lead { font-size: 18px; line-height: 1.5; color: #d6d6d6; margin: 0 0 22px; }
        .kicker { font-family: "Arial Black", Arial, sans-serif; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: ${GOLD}; margin: 0 0 10px; }
        .cta { display: block; width: 100%; box-sizing: border-box; text-align: center; text-decoration: none; background: ${GOLD}; color: #111; border: 0; border-radius: 14px; padding: 17px 20px; font-family: "Arial Black", Arial, sans-serif; font-size: 17px; cursor: pointer; margin-top: 6px; }
        .cta:disabled { opacity: .5; cursor: default; }
        .fine { font-size: 13px; color: #8a8a8a; text-align: center; margin: 12px 0 0; }
        .bar { height: 4px; background: #1f1f1f; border-radius: 4px; margin: 0 0 22px; overflow: hidden; }
        .bar i { display: block; height: 100%; background: ${GOLD}; transition: width .25s; }
        .q-n { font-size: 13px; color: #8a8a8a; margin: 0 0 8px; }
        .opts { display: grid; gap: 10px; margin-top: 18px; }
        .opts button { text-align: left; background: #161616; color: #f2f2f2; border: 1.5px solid #2a2a2a; border-radius: 14px; padding: 18px; font-size: 17px; font-weight: 600; cursor: pointer; }
        .opts button:hover, .opts button.on { border-color: ${GOLD}; }
        form { display: grid; gap: 10px; margin-top: 18px; }
        input { background: #161616; color: #fff; border: 1.5px solid #2a2a2a; border-radius: 12px; padding: 16px; font-size: 17px; outline: none; }
        input:focus { border-color: ${GOLD}; }
        .err { color: #ff6b6b; margin: 0; font-size: 14px; }
        .back { background: none; border: 0; color: #8a8a8a; font-size: 14px; margin-top: 18px; cursor: pointer; padding: 0; }
        footer { font-size: 12px; color: #666; text-align: center; margin-top: 36px; }
        footer a { color: #888; }
      `}</style>
    </>
  );
}
