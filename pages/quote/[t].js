import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import SlotPicker from "../../components/SlotPicker";
import { PHONE } from "../../lib/shop";

// One tire option from an emailed quote: logo, photo, the full out-the-door breakdown, and Book.
// Server side: POST /api/quote (get / book). Booking runs the same intake as the website.
const api = (body) => fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  .then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));
const money = (n) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const AVAIL = { in_stock: "In stock today", next_day: "Ready the next day", special_order: "Special order, ready in about a day" };

export default function QuotePage() {
  const { query, isReady } = useRouter();
  const t = query.t;
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  const [slot, setSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  useEffect(() => {
    if (!isReady || !t) return;
    api({ action: "get", t }).then(({ status, data }) => (status === 200 ? setS(data) : setErr(data.error || "This quote link isn't valid.")));
  }, [isReady, t]);

  async function book() {
    if (!slot) return;
    setBusy(true); setErr("");
    const { status, data } = await api({ action: "book", t, at: slot.at });
    setBusy(false);
    if (status === 200) setDone(data.when);
    else { setErr(data.error || "Couldn't book that time."); if (data.days) setS({ ...s, days: data.days }); setSlot(null); }
  }

  const o = s?.option, b = s?.breakdown;
  const name = o ? `${o.brand} ${o.model}`.trim() : "Your tire quote";
  return (
    <>
      <Head>
        <title>{`${name} quote | The Tire Plug`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <Header />
      <main className="qp">
        <div className="card">
          {!s && !err && <p className="muted">Loading your quote…</p>}
          {!s && err && <><h1>Quote not found</h1><p className="muted">{err}</p><Contact /></>}
          {o && (
            <>
              <div className="top">
                {o.logo && <img className="logo" src={o.logo} alt={`${o.brand} logo`} />}
                <span className="tag">{AVAIL[o.availability] || "Available"}</span>
              </div>
              <div className="hero">{o.photo ? <img src={o.photo} alt={name} /> : <img className="logoBig" src={o.logo} alt={o.brand} />}</div>
              <h1>{name}</h1>
              <p className="sub">{s.quote.size}{s.quote.vehicle ? ` · ${s.quote.vehicle}` : ""} · set of {b.qty}{o.warranty ? ` · ${o.warranty}` : ""}</p>
              {o.note && <p className="note">{o.note}</p>}

              <dl>
                <dt>{b.qty} tires × {money(b.each)}</dt><dd>{money(b.tires)}</dd>
                <dt>Mount and balance ({b.qty} × {money(b.install / b.qty)})</dt><dd>{money(b.install)}</dd>
                <dt>Tire disposal ({b.qty} × {money(b.fee / b.qty)})</dt><dd>{money(b.fee)}</dd>
                <dt>Tax (10% on tires)</dt><dd>{money(b.tax)}</dd>
                <dt className="tot">Total out the door</dt><dd className="tot">{money(b.total)}</dd>
              </dl>
              <p className="small">TPMS light on? Let us know at the front desk when you come in and we'll check it.</p>

              {done ? (
                <div className="panel"><p className="ok">You&apos;re booked: {done}</p><p className="muted">We&apos;ll have your {name} ready. See you at 2331 E Olympic Blvd.</p></div>
              ) : s.booked ? (
                <div className="panel"><p className="ok">You&apos;re booked: {s.booked.when}</p><p className="muted">Need to change it? Call or text us.</p></div>
              ) : (
                <div className="panel">
                  <h2>Book your install</h2>
                  {s.days?.length ? <SlotPicker days={s.days} value={slot?.at} onChange={(x, d) => setSlot({ ...x, dayLabel: d.label })} /> : <p className="muted">Call or text us for a time.</p>}
                  {err && <p className="bad">{err}</p>}
                  <button type="button" className="btn" disabled={!slot || busy} onClick={book}>{busy ? "Booking…" : slot ? `Book ${slot.dayLabel}, ${slot.label}` : "Pick a time"}</button>
                </div>
              )}
              <Contact />
            </>
          )}
        </div>
      </main>
      <Footer />
      <style jsx>{`
        .qp { background: #f5f5f5; min-height: 70vh; padding: 140px 1rem 4rem; }
        .card { max-width: 560px; margin: 0 auto; background: #fff; border: 1px solid #e6e6e6; border-radius: 20px; padding: 1.75rem 1.5rem; box-shadow: 0 6px 18px rgba(0,0,0,0.05); color: #111; }
        .top { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .logo { height: 28px; max-width: 160px; object-fit: contain; }
        .tag { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.3rem 0.6rem; border-radius: 6px; background: #e8f6ec; color: #1b6b34; }
        .hero { display: flex; justify-content: center; align-items: center; height: 220px; margin: 1rem 0 0.5rem; }
        .hero img { max-height: 220px; max-width: 100%; object-fit: contain; }
        .hero .logoBig { max-height: 90px; max-width: 70%; }
        h1 { font-size: 1.45rem; font-weight: 900; margin: 0.4rem 0 0.2rem; letter-spacing: -0.02em; }
        h2 { font-size: 1.05rem; font-weight: 800; margin: 0 0 0.75rem; }
        .sub { color: #555; margin: 0 0 1rem; }
        .note { background: #fff7e6; color: #7a4b00; padding: 0.6rem 0.8rem; border-radius: 10px; font-size: 0.9rem; }
        dl { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem 1rem; margin: 1rem 0 0.5rem; font-size: 0.95rem; }
        dt { color: #555; } dd { margin: 0; font-weight: 700; text-align: right; }
        .tot { border-top: 1px solid #eee; padding-top: 0.6rem; font-size: 1.1rem; color: #111; font-weight: 900; }
        dd.tot { color: #E01B22; }
        .small { font-size: 0.82rem; color: #6b6b6b; }
        .panel { border-top: 1px solid #eee; padding-top: 1rem; margin-top: 1rem; }
        .btn { width: 100%; margin-top: 1rem; padding: 0.9rem 1rem; border-radius: 50px; border: none; background: #E01B22; color: #fff; font: inherit; font-weight: 800; font-size: 0.95rem; cursor: pointer; }
        .btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .ok { color: #1b6b34; font-weight: 800; font-size: 1.1rem; margin: 0 0 0.3rem; }
        .bad { color: #b91c1c; font-weight: 700; }
        .muted { color: #555; }
        @media (max-width: 768px) { .qp { padding-top: 120px; } }
      `}</style>
    </>
  );
}

function Contact() {
  return (
    <p style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #eee", fontSize: "0.88rem", color: "#555" }}>
      Questions? <a href={PHONE.tel} style={{ color: "#E01B22", fontWeight: 700 }}>Call</a> or{" "}
      <a href={PHONE.sms} style={{ color: "#E01B22", fontWeight: 700 }}>text</a> us at {PHONE.display}. The Tire Plug · 2331 E Olympic Blvd, Los Angeles.
    </p>
  );
}
