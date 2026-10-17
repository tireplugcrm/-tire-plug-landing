import React, { useState, useEffect } from "react";
import Head from "next/head";
import Header from "../components/Header";
import Footer from "../components/Footer";
import SlotPicker, { timingForDay } from "../components/SlotPicker";
import TireSizeSearch from "../components/TireSizeSearch";
import { INSTALL_FROM, sizeToSlug, slugToKey, tiresForSize } from "../lib/tire-catalog";
import { stockForSize, nextDayForSize } from "../lib/inventory";

// Book a tire install: /book?size=225/65R17&tire=Evoluxx+Capricorn+4X4+HP
// One page: the tire (switchable to any other tire in that size), how many, a time, contact.
// Without a size, it asks for the size first, with "book a service" as the second option
// (/book?service=oil-change, or /book?service=1 for no preselection).

const SERVICES = [
  { id: "oil-change", label: "Oil Change" },
  { id: "alignment", label: "Wheel Alignment" },
  { id: "rotation", label: "Rotation + Rebalance" },
  { id: "brakes", label: "Brakes" },
  { id: "flat-repair", label: "Flat Repair" },
  { id: "tpms", label: "TPMS Sensors" },
  { id: "battery", label: "Battery" },
  { id: "suspension", label: "Suspension Check" },
  { id: "inspection", label: "Tire Inspection" },
];

const SIZE_RE = /^(\d{3}\/\d{2}Z?R\d{2}(\.\d)?|\d{2}X\d{1,2}(\.\d{1,2})?R\d{2})$/;
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export async function getServerSideProps({ query }) {
  const raw = String(query.size || "").trim();
  const key = raw ? slugToKey(sizeToSlug(raw)) : null;
  const service = query.service ? String(query.service) : null;
  if (!key || !SIZE_RE.test(key)) return { props: { sizeKey: null, options: [], picked: null, service } };

  const seen = new Set();
  const options = [];
  const add = (t, group, avail, nextDay) => {
    const name = [t.brand, t.model].filter(Boolean).join(" ");
    const id = `${norm(t.brand)}|${norm(t.model)}|${t.lt ? "lt" : ""}`;
    if (seen.has(id)) return;
    seen.add(id);
    options.push({
      id, name, group, avail, nextDay,
      brand: t.brand || "", model: t.model || "",
      price: t.price != null ? Number(t.price) : null,
      img: (!t.imgGeneric && t.img) || null, logo: t.logo || null, special: t.special || null,
    });
  };
  for (const t of await stockForSize(key)) add(t, "In stock today", "In stock · install today", false);
  for (const t of await nextDayForSize(key)) add(t, "Next-day delivery", "Next-day · install tomorrow", true);
  for (const t of tiresForSize(key)) add(t, "We can order", "Ordered in for you", true);

  const want = norm(query.tire);
  const picked = (want && options.find((o) => norm(o.name) === want)?.id) || options[0]?.id || null;
  return { props: { sizeKey: key, options, picked, service: null } };
}

const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;
const QTY = [1, 2, 4];

export default function BookPage({ sizeKey, options, picked, service }) {
  const display = sizeKey ? sizeKey.replace("X", "x") : "";
  const [tireId, setTireId] = useState(picked);
  const [qty, setQty] = useState(4);
  const tire = options.find((o) => o.id === tireId) || null;

  const [days, setDays] = useState(null);
  const [slot, setSlot] = useState(null);
  const [slotNotice, setSlotNotice] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [smsConsent, setSmsConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState(null);

  // Service booking (no tires): on when the URL asks for it or they pick "book a service".
  const [serviceMode, setServiceMode] = useState(!sizeKey && !!service);
  const [picks, setPicks] = useState(SERVICES.some((x) => x.id === service) ? [service] : []);
  const [vehicle, setVehicle] = useState("");
  const togglePick = (id) => setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const booking = !!sizeKey || serviceMode;

  useEffect(() => {
    if (sizeKey) { try { localStorage.setItem("tp_tire_size", display); } catch (_) {} }
    if (!booking || days !== null) return;
    fetch("/api/booking/slots")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDays((d?.days || []).filter((x) => x.slots && x.slots.length)))
      .catch(() => setDays([]));
  }, [booking]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tires that aren't on the shelf can't go on today.
  const pickDays = days && tire?.nextDay ? days.filter((d) => timingForDay(d) !== "ASAP") : days;
  useEffect(() => {
    if (slot && pickDays && !pickDays.some((d) => d.slots.some((s) => s.at === slot.at))) setSlot(null);
  }, [tireId]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasSlots = Array.isArray(pickDays) && pickDays.length > 0;
  const what = sizeKey ? !!tire : picks.length > 0;
  const ready = what && form.name.trim() && form.phone.trim() && (slot || (days && !hasSlots));
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    const timing = slot ? slot.timing : "This Week";
    try {
      const r = await fetch("/api/submit-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(), phone: form.phone, email: form.email,
          ...(sizeKey
            ? { vehicle: "N/A", tireSize: display, tireType: tire.name, service: `New Tires: ${tire.name} ${display} x${qty}`, quantity: qty, price: tire.price }
            : { vehicle: vehicle.trim() || "N/A", tireSize: "N/A", tireType: "N/A", service: picks.map((id) => SERVICES.find((x) => x.id === id).label).join(", ") }),
          serviceTiming: timing,
          appointmentAt: slot ? slot.at : undefined,
          leadPriority: timing === "ASAP" || timing === "Tomorrow" ? "HOT" : "WARM",
          smsConsent, source: "book-page",
        }),
      });
      const data = await r.json();
      if (data.code === "slot_taken") {
        setDays((data.days || []).filter((x) => x.slots && x.slots.length));
        setSlot(null);
        setSlotNotice("Sorry, that time was just taken. Please pick another.");
        document.getElementById("bk-time")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (data.success) {
        setBooked(data.appointment || { when: null });
        window.scrollTo({ top: 0, behavior: "smooth" });
        if (window.gtag) window.gtag("event", "generate_lead", { currency: "USD", value: 1 });
        if (window.fbq) window.fbq("track", "Lead");
      } else {
        setError(data.error || "Something went wrong. Please call (562) 500-4625.");
      }
    } catch (_) {
      setError("Something went wrong. Please call (562) 500-4625.");
    } finally {
      setBusy(false);
    }
  };

  const groups = [...new Set(options.map((o) => o.group))];

  return (
    <>
      <Head>
        <title>{sizeKey ? `Book ${display} Tire Install | The Tire Plug` : serviceMode ? "Book a Service | The Tire Plug" : "Book a Tire Install | The Tire Plug"}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, follow" />
      </Head>
      <Header />

      <main className="bp">
        <div className="wrap">
          {!booking ? (
            <div className="card pad">
              <h1>Book a tire install</h1>
              <TireSizeSearch />
              <div className="alt">
                <span>Not buying tires?</span>
                <button type="button" onClick={() => setServiceMode(true)}>Book a service: oil change, alignment, brakes…</button>
              </div>
            </div>
          ) : booked ? (
            <div className="card pad done">
              <div className="ok" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </div>
              <h1>{booked.when ? "You're booked" : "Request received"}</h1>
              {booked.when && <p className="when">{booked.when}</p>}
              <p className="muted">{sizeKey ? `${qty} × ${tire.name} · ${display}` : picks.map((id) => SERVICES.find((x) => x.id === id).label).join(", ")}</p>
              <p className="muted">
                {booked.when ? (form.email || smsConsent ? "Your confirmation is on its way." : "We'll call or text you to confirm.") : "We'll call you shortly to set a time."}{" "}
                2331 E Olympic Blvd, Los Angeles.
              </p>
              {booked.manageUrl && <a className="link" href={booked.manageUrl}>Reschedule or cancel</a>}
            </div>
          ) : (
            <form className="card" onSubmit={submit} noValidate>
              {!sizeKey ? (
                <div className="pad">
                  <a className="crumb" href="/book" onClick={(e) => { if (!service) { e.preventDefault(); setServiceMode(false); } }}>← Shopping for tires?</a>
                  <h1>Book a service</h1>
                  <div className="chips">
                    {SERVICES.map((x) => (
                      <button key={x.id} type="button" className={picks.includes(x.id) ? "on" : ""} aria-pressed={picks.includes(x.id)} onClick={() => togglePick(x.id)}>{x.label}</button>
                    ))}
                  </div>
                  <label className="fld"><span>Vehicle <i>optional</i></span><input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="2019 Toyota Camry" /></label>
                </div>
              ) : (
              <div className="pad">
                <a className="crumb" href={`/tires/${sizeToSlug(sizeKey)}`}>← All {display} tires</a>
                <h1>Book your install</h1>

                {tire ? (
                  <div className="tire">
                    <div className="ph">{tire.img ? <img src={tire.img} alt="" /> : tire.logo ? <img className="lg" src={tire.logo} alt="" /> : <b>{tire.brand}</b>}</div>
                    <div className="tb">
                      <div className="tn">{tire.name}</div>
                      <div className="ts">{display}</div>
                      <div className={`ta${tire.nextDay ? " nd" : ""}`}>{tire.avail}</div>
                      {tire.special && <div className="sp">★ {tire.special}</div>}
                    </div>
                    {tire.price != null && <div className="tp"><b>{money(tire.price)}</b><span>per tire</span></div>}
                  </div>
                ) : (
                  <p className="muted">We don't list tires in {display} online yet. Pick a time and we'll find you options.</p>
                )}

                {options.length > 1 && (
                  <label className="fld">
                    <span>Change tire</span>
                    <select value={tireId || ""} onChange={(e) => setTireId(e.target.value)}>
                      {groups.map((g) => (
                        <optgroup key={g} label={g}>
                          {options.filter((o) => o.group === g).map((o) => (
                            <option key={o.id} value={o.id}>{o.name}{o.price != null ? ` · ${money(o.price)}` : ""}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                )}

                {tire && (
                  <div className="qty">
                    <span>How many?</span>
                    <div className="seg">
                      {QTY.map((n) => <button key={n} type="button" className={qty === n ? "on" : ""} onClick={() => setQty(n)}>{n}</button>)}
                    </div>
                    {tire.price != null && <div className="tot">{money(tire.price * qty)}<span>+ install from ${INSTALL_FROM}/wheel</span></div>}
                  </div>
                )}
              </div>
              )}

              <div className="pad sec" id="bk-time">
                <h2>Pick a time</h2>
                {slotNotice && <p className="warn">{slotNotice}</p>}
                {days === null ? (
                  <p className="muted">Loading open times…</p>
                ) : hasSlots ? (
                  <>
                    <SlotPicker days={pickDays} value={slot?.at} onChange={(s, d) => { setSlot({ ...s, dayLabel: d.label, timing: timingForDay(d) }); setSlotNotice(""); }} />
                    {slot && <p className="picked">✓ {slot.dayLabel} at {slot.label}</p>}
                  </>
                ) : (
                  <p className="muted">We'll call you to set a time.</p>
                )}
              </div>

              <div className="pad sec">
                <h2>Your info</h2>
                <label className="fld"><span>Full name</span><input name="name" value={form.name} onChange={set} autoComplete="name" /></label>
                <div className="two">
                  <label className="fld"><span>Mobile phone</span><input name="phone" type="tel" inputMode="tel" value={form.phone} onChange={set} autoComplete="tel" /></label>
                  <label className="fld"><span>Email <i>for your confirmation</i></span><input name="email" type="email" value={form.email} onChange={set} autoComplete="email" /></label>
                </div>
                {/* SMS consent (OPTIONAL) — A2P 10DLC compliant; not required to book */}
                <label className="consent">
                  <input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} />
                  <span>
                    <b>Text me about my appointment.</b>{" "}(Optional) I agree to receive text messages from The Tire Plug
                    about my quote, appointment, and service updates. Msg frequency varies. Msg &amp; data
                    rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of
                    purchase. See our <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> &amp;{" "}
                    <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>.
                  </span>
                </label>
                {error && <p className="warn">{error}</p>}
              </div>

              <div className="bar">
                <div className="bar-sum">
                  {slot ? <b>{slot.dayLabel}, {slot.label}</b> : <span>Pick a time</span>}
                  {sizeKey ? tire && <span>{qty} × {tire.name}</span> : picks.length > 0 && <span>{picks.map((id) => SERVICES.find((x) => x.id === id).label).join(", ")}</span>}
                </div>
                <button type="submit" disabled={!ready || busy}>{busy ? "Booking…" : "Book"}</button>
              </div>
            </form>
          )}
        </div>
      </main>

      <Footer />

      <style jsx>{`
        .bp { background: #f5f5f5; padding: 140px 1rem 3rem; color: #111; min-height: 70vh; }
        .wrap { max-width: 640px; margin: 0 auto; }
        .card { display: block; background: #fff; border: 1px solid #e6e6e6; border-radius: 16px; box-shadow: 0 6px 18px rgba(0,0,0,0.05); }
        .pad { padding: 1.5rem; }
        .sec { border-top: 1px solid #eee; }
        h1 { font-size: 1.6rem; font-weight: 900; letter-spacing: -0.02em; margin: 0.3rem 0 1.1rem; }
        h2 { font-size: 1.1rem; font-weight: 800; margin: 0 0 0.9rem; }
        .crumb { color: #E01B22; font-weight: 700; font-size: 0.85rem; text-decoration: none; }
        .muted { color: #555; }
        .warn { color: #b3141a; font-weight: 700; font-size: 0.9rem; }

        .tire { display: flex; align-items: center; gap: 1rem; border: 1px solid #e6e6e6; border-radius: 12px; padding: 0.85rem; }
        .ph { flex: 0 0 76px; height: 76px; display: grid; place-items: center; background: #fafafa; border-radius: 8px; overflow: hidden; }
        .ph img { max-width: 100%; max-height: 100%; object-fit: contain; mix-blend-mode: multiply; }
        .ph img.lg { max-width: 85%; }
        .ph b { font-size: 0.8rem; text-transform: uppercase; text-align: center; }
        .tb { flex: 1; min-width: 0; }
        .tn { font-weight: 800; font-size: 1.05rem; line-height: 1.2; }
        .ts { color: #6b6b6b; font-size: 0.85rem; }
        .ta { color: #1b6b34; font-weight: 700; font-size: 0.82rem; margin-top: 0.15rem; }
        .ta.nd { color: #1a4fb5; }
        .sp { color: #E01B22; font-size: 0.8rem; font-weight: 700; }
        .tp { text-align: right; }
        .tp b { display: block; font-size: 1.35rem; font-weight: 900; }
        .tp span { color: #6b6b6b; font-size: 0.72rem; }

        .fld { display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.9rem; min-width: 0; }
        .fld > span { font-size: 0.85rem; font-weight: 700; }
        .fld i { font-style: normal; font-weight: 500; color: #8a8a8a; font-size: 0.78rem; margin-left: 0.25rem; }
        .fld input, .fld select { width: 100%; box-sizing: border-box; border: 1px solid #cfcfcf; border-radius: 8px; padding: 0.75rem 0.85rem; font: inherit; font-size: 1rem; color: #111; background: #fff; outline: none; }
        .fld input:focus, .fld select:focus { border-color: #111; box-shadow: 0 0 0 3px rgba(0,0,0,0.08); }
        .two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 0.75rem; }

        .qty { display: flex; align-items: center; gap: 0.75rem; margin-top: 1rem; flex-wrap: wrap; }
        .qty > span { font-size: 0.85rem; font-weight: 700; }
        .seg { display: inline-flex; border: 1px solid #cfcfcf; border-radius: 8px; overflow: hidden; }
        .seg button { background: #fff; border: none; border-left: 1px solid #cfcfcf; width: 46px; padding: 0.55rem 0; font: inherit; font-weight: 800; cursor: pointer; color: #111; }
        .seg button:first-child { border-left: none; }
        .seg button.on { background: #111; color: #fff; }
        .tot { margin-left: auto; text-align: right; font-weight: 900; font-size: 1.1rem; }
        .tot span { display: block; font-weight: 500; font-size: 0.72rem; color: #6b6b6b; }

        .alt { margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid #eee; display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.6rem; font-size: 0.9rem; color: #555; }
        .alt button { background: none; border: none; padding: 0; font: inherit; font-weight: 700; color: #111; text-decoration: underline; cursor: pointer; text-align: left; }
        .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .chips button { background: #fff; border: 1px solid #cfcfcf; border-radius: 50px; padding: 0.6rem 1rem; font: inherit; font-weight: 700; font-size: 0.9rem; color: #111; cursor: pointer; }
        .chips button.on { background: #111; border-color: #111; color: #fff; }
        .picked { color: #1b6b34; font-weight: 700; margin: 0.9rem 0 0; }
        .consent { display: flex; gap: 0.6rem; align-items: flex-start; margin-top: 1rem; font-size: 0.74rem; line-height: 1.5; color: #555; cursor: pointer; }
        .consent input { margin-top: 2px; width: 18px; height: 18px; accent-color: #E01B22; flex-shrink: 0; }
        .consent b { color: #111; }
        .consent a { color: #111; }

        .bar { position: sticky; bottom: 0; display: flex; align-items: center; gap: 1rem; padding: 0.9rem 1.5rem; background: #fff; border-top: 1px solid #eee; border-radius: 0 0 16px 16px; }
        .bar-sum { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 0.82rem; color: #555; }
        .bar-sum b { color: #111; font-size: 0.95rem; }
        .bar-sum span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bar button { background: #E01B22; color: #fff; border: none; border-radius: 10px; padding: 0.9rem 2.2rem; font: inherit; font-weight: 800; font-size: 1rem; cursor: pointer; }
        .bar button:disabled { background: #f0a3a6; cursor: not-allowed; }

        .done { text-align: center; }
        .ok { width: 56px; height: 56px; border-radius: 50%; background: #1b6b34; display: grid; place-items: center; margin: 0.5rem auto 0.75rem; }
        .when { font-size: 1.5rem; font-weight: 900; color: #E01B22; margin: -0.5rem 0 0.75rem; }
        .link { color: #111; font-weight: 700; }

        @media (max-width: 600px) {
          .bp { padding: 116px 0.6rem 2rem; }
          .pad { padding: 1.1rem 1rem; }
          .two { grid-template-columns: 1fr; }
          .bar { padding: 0.75rem 1rem; }
          .tire { flex-wrap: wrap; }
          .tp { width: 100%; text-align: left; display: flex; align-items: baseline; gap: 0.4rem; }
          .tp b { display: inline; }
        }
      `}</style>
    </>
  );
}
