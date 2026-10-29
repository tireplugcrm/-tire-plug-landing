import React, { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { MARKETING_CONSENT_TEXT } from "../lib/consent-text";
import { PHONE, TEXT_LINE, CTA } from "../lib/shop";

// Deals sign-up: /deals (?src=counter for the QR sign at the counter, ?src=invoice, ?src=text).
// The box must be ticked to sign up; the exact wording is logged with each sign-up (lib/consent.js).
export default function Deals() {
  const { query } = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", email: "", website: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const ready = consent && form.phone.replace(/\D/g, "").length >= 10;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/deals-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, consent, src: query.src || "web" }),
      });
      const d = await r.json();
      if (r.ok) {
        setDone(true);
        if (window.gtag) window.gtag("event", "sign_up", { method: "deals" });
        if (window.fbq) window.fbq("track", "CompleteRegistration");
      } else setError(d.error || "Something went wrong. Please call (562) 500-4625.");
    } catch (_) {
      setError("Something went wrong. Please call (562) 500-4625.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head>
        <title>Tire Deals by Text | The Tire Plug</title>
        <meta name="description" content="Get The Tire Plug's tire deals and service reminders by text. Los Angeles, 2331 E Olympic Blvd." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />

      <main className="dp">
        <div className="card">
          {done ? (
            <div className="done">
              <div className="ok" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </div>
              <h1>You're in</h1>
              <p className="es">¡Listo! Ya está inscrito.</p>
              <p className="muted">Watch for a text from our texting line, {TEXT_LINE.display}. Need tires now? <a href="/tires">{CTA.shopTires}</a> or call <a href={PHONE.tel}>{PHONE.display}</a>.</p>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <h1>Get our tire deals by text</h1>
              <p className="es">Reciba nuestras ofertas de llantas por mensaje de texto</p>
              <p className="muted">New deals when tires come in, plus a reminder when yours are due. No spam, stop anytime.</p>

              <label className="fld"><span>Name <i>Nombre</i></span><input name="name" value={form.name} onChange={set} autoComplete="name" /></label>
              <label className="fld"><span>Mobile phone <i>Celular</i></span><input name="phone" type="tel" inputMode="tel" value={form.phone} onChange={set} autoComplete="tel" /></label>
              <label className="fld"><span>Email <i>optional · opcional</i></span><input name="email" type="email" value={form.email} onChange={set} autoComplete="email" /></label>
              <input className="hp" name="website" value={form.website} onChange={set} tabIndex={-1} autoComplete="off" aria-hidden="true" />

              <label className="consent">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  <b>{MARKETING_CONSENT_TEXT.split(". ")[0]}.</b>{" "}{MARKETING_CONSENT_TEXT.split(". ").slice(1).join(". ")}{" "}
                  See our <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> &amp;{" "}
                  <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>.
                </span>
              </label>
              {error && <p className="warn">{error}</p>}
              <button type="submit" disabled={!ready || busy}>{busy ? "Signing up…" : "Sign me up · Inscribirme"}</button>
            </form>
          )}
        </div>
      </main>

      <Footer />

      <style jsx>{`
        .dp { background: #f5f5f5; padding: 140px 1rem 3rem; color: #111; min-height: 70vh; }
        .card { max-width: 480px; margin: 0 auto; background: #fff; border: 1px solid #e6e6e6; border-radius: 16px; box-shadow: 0 6px 18px rgba(0,0,0,0.05); padding: 1.75rem 1.5rem; }
        h1 { font-size: 1.7rem; font-weight: 900; letter-spacing: -0.02em; margin: 0; line-height: 1.15; }
        .es { color: #E01B22; font-weight: 700; margin: 0.35rem 0 0.75rem; }
        .muted { color: #555; line-height: 1.5; margin: 0 0 0.5rem; }
        .muted a { color: #111; font-weight: 700; }
        .warn { color: #b3141a; font-weight: 700; font-size: 0.9rem; }
        .fld { display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.9rem; }
        .fld > span { font-size: 0.85rem; font-weight: 700; }
        .fld i { font-style: normal; font-weight: 500; color: #8a8a8a; font-size: 0.78rem; margin-left: 0.25rem; }
        .fld input { width: 100%; box-sizing: border-box; border: 1px solid #cfcfcf; border-radius: 8px; padding: 0.8rem 0.85rem; font: inherit; font-size: 1rem; color: #111; background: #fff; outline: none; }
        .fld input:focus { border-color: #111; box-shadow: 0 0 0 3px rgba(0,0,0,0.08); }
        .hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
        .consent { display: flex; gap: 0.6rem; align-items: flex-start; margin-top: 1.1rem; font-size: 0.74rem; line-height: 1.5; color: #555; cursor: pointer; }
        .consent input { margin-top: 2px; width: 20px; height: 20px; accent-color: #E01B22; flex-shrink: 0; }
        .consent b { color: #111; font-size: 0.85rem; }
        .consent a { color: #111; }
        button { width: 100%; margin-top: 1.1rem; background: #E01B22; color: #fff; border: none; border-radius: 10px; padding: 1rem; font: inherit; font-weight: 800; font-size: 1.05rem; cursor: pointer; }
        button:disabled { background: #f0a3a6; cursor: not-allowed; }
        .done { text-align: center; }
        .ok { width: 56px; height: 56px; border-radius: 50%; background: #1b6b34; display: grid; place-items: center; margin: 0.25rem auto 0.75rem; }
        @media (max-width: 600px) { .dp { padding: 116px 0.6rem 2rem; } .card { padding: 1.4rem 1.1rem; } }
      `}</style>
    </>
  );
}
