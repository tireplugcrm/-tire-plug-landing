import React, { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import SlotPicker from "../../components/SlotPicker";

// Customer's own appointment, from the link in their confirmation / reminder:
// see it, reschedule it, or cancel it. Server side is POST /api/booking/manage.
const manage = (body) =>
  fetch("/api/booking/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));

const CANCELED = "canceled";

export default function AppointmentPage() {
  const { query, isReady } = useRouter();
  const token = query.token;
  const [appt, setAppt] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | missing | error
  const [mode, setMode] = useState("view"); // view | reschedule | cancel
  const [days, setDays] = useState(null);
  const [slot, setSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isReady || !token) return;
    manage({ token, action: "get" })
      .then(({ status, data }) => {
        if (status === 404) return setState("missing");
        if (status !== 200 || !data.at) return setState("error");
        setAppt(data);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [isReady, token]);

  const startReschedule = () => {
    setMode("reschedule");
    setSlot(null);
    setNotice("");
    setDays(null);
    fetch("/api/booking/slots")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDays((d?.days || []).filter((x) => x.slots && x.slots.length)))
      .catch(() => setDays([]));
  };

  const confirmReschedule = async () => {
    setBusy(true);
    const { status, data } = await manage({ token, action: "reschedule", at: slot.at }).catch(() => ({ status: 0, data: {} }));
    setBusy(false);
    if (status === 409 || data.code === "slot_taken") {
      setDays((data.days || []).filter((x) => x.slots && x.slots.length));
      setSlot(null);
      setNotice("Sorry, that time was just taken. Please pick another.");
    } else if (data.ok) {
      setAppt({ ...appt, at: data.at, when: data.when, status: "confirmed" });
      setMode("view");
      setNotice("Done! You're rescheduled.");
    } else {
      setNotice(data.error || "Something went wrong. Please call (562) 500-4625.");
    }
  };

  const confirmCancel = async () => {
    setBusy(true);
    const { data } = await manage({ token, action: "cancel" }).catch(() => ({ data: {} }));
    setBusy(false);
    if (data.ok) {
      setAppt({ ...appt, status: CANCELED });
      setMode("view");
      setNotice("Your appointment is canceled.");
    } else {
      setNotice(data.error || "Something went wrong. Please call (562) 500-4625.");
    }
  };

  const canceled = appt?.status === CANCELED;

  return (
    <>
      <Head>
        <title>Your Appointment | The Tire Plug</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Header />

      <main className="ap">
        <div className="card">
          {state === "loading" && <p className="muted">Loading your appointment…</p>}

          {(state === "missing" || state === "error") && (
            <>
              <h1>{state === "missing" ? "This link has expired" : "We couldn't load your appointment"}</h1>
              <p className="muted">Call or text us and we'll sort it out.</p>
              <Contact />
            </>
          )}

          {state === "ready" && appt && (
            <>
              <span className={`tag ${canceled ? "off" : "on"}`}>{canceled ? "Canceled" : "Confirmed"}</span>
              <h1>{appt.name ? `${appt.name.split(" ")[0]}, ` : ""}{canceled ? "your appointment was" : "you're booked for"}</h1>
              <p className={`when${canceled ? " struck" : ""}`}>{appt.when}</p>
              <dl>
                {appt.service && <><dt>Service</dt><dd>{appt.service}</dd></>}
                {appt.vehicle && <><dt>Vehicle</dt><dd>{appt.vehicle}</dd></>}
                <dt>Where</dt><dd><a href="https://maps.google.com/?q=2331+E+Olympic+Blvd+Los+Angeles+CA">2331 E Olympic Blvd, Los Angeles</a></dd>
              </dl>
              {notice && <p className="notice">{notice}</p>}

              {mode === "view" && !canceled && (
                <div className="actions">
                  <button type="button" className="btn red" onClick={startReschedule}>Reschedule</button>
                  <button type="button" className="btn ghost" onClick={() => { setMode("cancel"); setNotice(""); }}>Cancel appointment</button>
                </div>
              )}
              {mode === "view" && canceled && (
                <div className="actions">
                  <a className="btn red" href="/book">Book a new time</a>
                </div>
              )}

              {mode === "cancel" && (
                <div className="panel">
                  <p><b>Cancel your appointment for {appt.when}?</b></p>
                  <div className="actions">
                    <button type="button" className="btn red" disabled={busy} onClick={confirmCancel}>{busy ? "Canceling…" : "Yes, cancel it"}</button>
                    <button type="button" className="btn ghost" onClick={() => setMode("view")}>Keep it</button>
                  </div>
                </div>
              )}

              {mode === "reschedule" && (
                <div className="panel">
                  <p><b>Pick a new time</b></p>
                  {days === null && <p className="muted">Loading open times…</p>}
                  {days && days.length === 0 && <p className="muted">We couldn't load open times. Call or text us to reschedule.</p>}
                  {days && days.length > 0 && <SlotPicker days={days} value={slot?.at} onChange={(s, d) => setSlot({ ...s, dayLabel: d.label })} />}
                  <div className="actions">
                    <button type="button" className="btn red" disabled={!slot || busy} onClick={confirmReschedule}>
                      {busy ? "Saving…" : slot ? `Move to ${slot.dayLabel}, ${slot.label}` : "Pick a time"}
                    </button>
                    <button type="button" className="btn ghost" onClick={() => setMode("view")}>Never mind</button>
                  </div>
                </div>
              )}

              <Contact />
            </>
          )}
        </div>
      </main>

      <Footer />

      <style jsx>{`
        .ap { background: #f5f5f5; min-height: 70vh; padding: 140px 1rem 4rem; }
        .card { max-width: 560px; margin: 0 auto; background: #fff; border: 1px solid #e6e6e6; border-radius: 20px; padding: 2rem 1.5rem; box-shadow: 0 6px 18px rgba(0,0,0,0.05); color: #111; }
        h1 { font-size: 1.35rem; font-weight: 800; margin: 0.6rem 0 0.25rem; }
        .when { font-size: 1.7rem; font-weight: 900; color: #E01B22; margin: 0 0 1.25rem; letter-spacing: -0.02em; }
        .when.struck { color: #8a8a8a; text-decoration: line-through; }
        .tag { display: inline-block; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.3rem 0.6rem; border-radius: 6px; }
        .tag.on { background: #e8f6ec; color: #1b6b34; }
        .tag.off { background: #f0f0f0; color: #555; }
        dl { display: grid; grid-template-columns: auto 1fr; gap: 0.45rem 1rem; margin: 0 0 1.25rem; font-size: 0.92rem; }
        dt { color: #6b6b6b; }
        dd { margin: 0; font-weight: 700; }
        dd a { color: #111; }
        .muted { color: #555; }
        .notice { color: #1b6b34; font-weight: 700; margin: 0 0 1rem; }
        .panel { border-top: 1px solid #eee; padding-top: 1rem; margin-top: 0.5rem; }
        .actions { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 1rem 0 0.5rem; }
        .btn { flex: 1 1 160px; text-align: center; text-decoration: none; padding: 0.85rem 1rem; border-radius: 50px; font: inherit; font-weight: 800; font-size: 0.92rem; cursor: pointer; }
        .btn.red { background: #E01B22; color: #fff; border: none; }
        .btn.red:disabled { opacity: 0.45; cursor: not-allowed; }
        .btn.ghost { background: #fff; color: #111; border: 1px solid #dcdcdc; }
        @media (max-width: 768px) { .ap { padding-top: 120px; } }
      `}</style>
    </>
  );
}

function Contact() {
  return (
    <p style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #eee", fontSize: "0.88rem", color: "#555" }}>
      Questions? <a href="tel:562-500-4625" style={{ color: "#E01B22", fontWeight: 700 }}>Call</a> or{" "}
      <a href="sms:+15625004625" style={{ color: "#E01B22", fontWeight: 700 }}>text</a> (562) 500-4625.
    </p>
  );
}
