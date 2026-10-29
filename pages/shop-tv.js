// Shop TV display: the live Shop Floor board for the TVs mounted around the shop.
// Open /shop-tv?key=... (the link comes from Admin → Shop Floor → TV display) in the TV's browser,
// full screen, and click it once so it can play sounds. It refreshes every 5 seconds, keeps the
// screen awake, and chimes when a car is checked in or completed. Techs can tap Complete on a car
// right at the TV (tap twice to confirm, Undo for a few minutes). /shop-tv?demo=1 shows sample cars.
import React, { useState, useEffect, useRef } from "react";
import Head from "next/head";
import {
  COLUMNS, JOB_TYPES, HOLD_REASONS, boardTimer, fmtMins, sortJobs, floorStats, bayLabel, tireLine, tireName,
  apptStatus, apptTime, tvBoard, TV_UNDO_MINS,
} from "../lib/shop-floor.js";
import { demoSeed, board as demoBoard } from "../lib/shop-floor-demo.js";
import { enableSound, soundReady, play, say } from "../lib/shop-sounds.js";
import { checkInLine, completeLine } from "../lib/shop-lines.js";

const C = {
  bg: "#0b1118", panel: "#121a24", card: "#1a2430", line: "#263241",
  text: "#f3f6fa", muted: "#94a3b8", faint: "#5b6b7f",
  ok: "#94a3b8", slow: "#f59e0b", late: "#ef4444", rush: "#ef4444", green: "#22c55e", blue: "#3b82f6", tire: "#fbbf24",
};
const POLL_MS = 5000;
const TYPE = Object.fromEntries(JOB_TYPES.map((j) => [j.k, j]));
const HOLD = Object.fromEntries(HOLD_REASONS.map((h) => [h.k, h.l]));
const COL_COLOR = { checked_in: C.blue, done: C.green };
const time = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function Icon({ name, size, color }) {
  return <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: size, lineHeight: 1, color }}>{name}</span>;
}

export default function ShopTv() {
  const [board, setBoard] = useState(null);
  const [error, setError] = useState("");
  const [lastOk, setLastOk] = useState(0);
  const [now, setNow] = useState(0); // set in the browser, so the server-rendered page has no clock to mismatch
  const [sound, setSound] = useState(false);
  const keyRef = useRef("");
  const seen = useRef(null); // id -> status from the last board, to hear what changed
  const [notice, setNotice] = useState(null); // { kind, title, text } shown big for a few seconds
  const queue = useRef(Promise.resolve());
  const voiceAuth = useRef({});
  const loadRef = useRef(null);
  const [live, setLive] = useState(false); // false on the still demo=1 picture: no buttons
  const [confirmId, setConfirmId] = useState(null); // the card waiting for its second tap
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // demo=1: a still sample shop. demo=live: the local /shop-demo sample shop, which the admin side changes.
    const demo = q.get("demo");
    if (demo && demo !== "live") { setBoard(tvBoard(demoBoard(demoSeed()))); setLastOk(Date.now()); return; }
    keyRef.current = q.get("key") || "";
    voiceAuth.current = demo ? { demo: true } : { key: keyRef.current };
    if (!demo && !keyRef.current) { setError("This TV link is missing its key. Open Admin → Shop Floor → TV display to get the link."); return; }
    setLive(true);
    let stop = false;
    async function load() {
      try {
        const r = demo ? await fetch("/api/shop-demo", { cache: "no-store" })
          : await fetch("/api/shop-tv", { headers: { "x-tv-key": keyRef.current }, cache: "no-store" });
        const j = await r.json();
        if (stop) return;
        if (!r.ok) { setError(j.error || "Could not load the board."); return; }
        setBoard(j); setError(""); setLastOk(Date.now());
      } catch { /* keep showing the last board; the offline banner appears after a minute */ }
    }
    loadRef.current = load;
    load();
    const t = setInterval(load, demo ? 1000 : POLL_MS);
    return () => { stop = true; clearInterval(t); };
  }, []);

  // A tech's tap on the TV. Complete needs a second tap within 4 seconds (no accidental pickups).
  useEffect(() => { if (!confirmId) return undefined; const t = setTimeout(() => setConfirmId(null), 4000); return () => clearTimeout(t); }, [confirmId]);
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(""), 5000); return () => clearTimeout(t); }, [toast]);
  async function tvAct(action, id) {
    setBusyId(id); setConfirmId(null);
    try {
      const demo = voiceAuth.current.demo;
      const r = await fetch(demo ? "/api/shop-demo" : "/api/shop-tv", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(demo ? {} : { "x-tv-key": keyRef.current }) },
        body: JSON.stringify({ action, id }),
      });
      if (!r.ok) setToast((await r.json().catch(() => ({}))).error || "That didn't go through. Try again.");
      await loadRef.current?.();
    } catch { setToast("No connection. Try again."); } finally { setBusyId(null); }
  }
  const tapComplete = (id) => (confirmId === id ? tvAct("complete", id) : setConfirmId(id));

  // Each new check-in and each newly completed job (not what was already there on load): a chime,
  // a big banner, and the TV says it. One at a time, so two at once don't talk over each other.
  useEffect(() => {
    if (!board) return;
    const prev = seen.current;
    seen.current = new Map(board.orders.map((o) => [o.id, o.status]));
    if (!prev) return;
    const events = [
      ...board.orders.filter((o) => o.status === "done" && prev.has(o.id) && prev.get(o.id) !== "done").map((o) => announceDone(o)),
      ...board.orders.filter((o) => !prev.has(o.id) && o.status !== "done").map((o) => announceCheckIn(o)),
    ];
    for (const e of events) {
      queue.current = queue.current.then(() => new Promise((done) => {
        play(e.kind);
        setNotice(e);
        setTimeout(() => say(e.text, voiceAuth.current), 900);
        setTimeout(() => { setNotice((n) => (n === e ? null : n)); done(); }, 8000);
      }));
    }
  }, [board]);

  // Sound needs one click on the TV (browser rule); any click or key turns it on.
  useEffect(() => {
    const on = async () => setSound(await enableSound());
    setSound(soundReady());
    on();
    window.addEventListener("pointerdown", on);
    window.addEventListener("keydown", on);
    return () => { window.removeEventListener("pointerdown", on); window.removeEventListener("keydown", on); };
  }, []);

  // Clock and timers.
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Keep the TV from sleeping (where the browser allows it).
  useEffect(() => {
    let lock;
    const get = async () => { try { lock = await navigator.wakeLock?.request("screen"); } catch {} };
    get();
    const onVis = () => document.visibilityState === "visible" && get();
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); try { lock?.release(); } catch {} };
  }, []);

  const stale = lastOk && now - lastOk > 60000;
  const orders = board?.orders || [];
  const appts = board?.appointments || [];
  const showAppts = board ? board.showAppointments !== false : true;
  const s = floorStats(orders, board?.todayDone, now);

  return (
    <>
      <Head>
        <title>Shop Floor · The Tire Plug</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0,0&display=block" />
      </Head>
      <div className="tv">
        <header className="tv-head">
          <img src="/images/logo.webp" alt="" className="tv-logo" />
          <div className="tv-title">The Tire Plug <span>Shop Floor</span></div>
          <div className="tv-stats">
            {showAppts && <Stat label="Appointments left" value={appts.length} />}
            <Stat label="Checked in" value={s.active} />
            <Stat label="Completed today" value={s.doneToday} />
            <Stat label="Behind" value={s.late} alert={s.late > 0} />
            <Stat label="Avg turnaround" value={s.avgTurn != null ? fmtMins(s.avgTurn) : "—"} />
          </div>
          <div className="tv-clock">{now ? new Date(now).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}</div>
        </header>

        {stale ? <div className="tv-banner">Not updating — last update {time(new Date(lastOk).toISOString())}. Check the TV's internet.</div> : null}
        {error && <div className="tv-message">{error}</div>}

        {!error && (
          <main className={`tv-cols${showAppts ? "" : " no-appts"}`}>
            {showAppts && <Appointments list={appts} now={now} loaded={!!board} />}
            {COLUMNS.map((col) => {
              const items = sortJobs(orders.filter((o) => col.statuses.includes(o.status)));
              const wide = col.k === "checked_in";
              // Checked in scrolls and shows every car, so a tech can always reach its Complete button.
              const cap = wide ? Infinity : 4;
              return (
                <section key={col.k} className="tv-col">
                  <div className="tv-col-head" style={{ borderColor: COL_COLOR[col.k] }}>
                    <Icon name={col.icon} size="1.9vw" color={COL_COLOR[col.k]} />
                    <span>{col.l}</span>
                    <b>{items.length}</b>
                  </div>
                  <div className={`tv-list${wide ? " two" : ""}`}>
                    {items.slice(0, cap).map((o) => <Card key={o.id} o={o} color={COL_COLOR[col.k]} now={now} live={live} confirming={confirmId === o.id} busy={busyId === o.id} onComplete={() => tapComplete(o.id)} onUndo={() => tvAct("undo", o.id)} />)}
                    {items.length > cap && <div className="tv-more">+{items.length - cap} more</div>}
                    {board && items.length === 0 && <div className="tv-empty">—</div>}
                  </div>
                </section>
              );
            })}
          </main>
        )}

        {!error && board && <TechStrip staff={board.staff || []} orders={orders} />}
        {notice && (
          <div className={`tv-notice ${notice.kind}`}>
            <Icon name={notice.kind === "complete" ? "check_circle" : "login"} size="4vw" />
            <div><b>{notice.title}</b><span>{notice.sub}</span></div>
          </div>
        )}
        {toast && <div className="tv-toast"><Icon name="error" size="1.3vw" />{toast}</div>}
        {!sound && board && <div className="tv-sound"><Icon name="volume_off" size="1.3vw" />Click the screen once to turn on sound</div>}
      </div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </>
  );
}

// What the TV shows and says. First name only (customers can hear and see the TVs).
const firstName = (o) => String(o.customer || "").split(/\s+/)[0];
function announceCheckIn(o) {
  const what = o.vehicle || firstName(o) || "a vehicle";
  return { kind: "checkin", title: "New check-in", sub: what, text: checkInLine(what.replace(/ · /g, ", ")) };
}
function announceDone(o) {
  const name = firstName(o);
  const car = o.vehicle ? o.vehicle.split(" · ")[0] : "vehicle";
  return { kind: "complete", title: `${name ? `${name} — ` : ""}${car} is complete`, sub: "Please come to the front desk to pick up your vehicle", text: completeLine(name, car) };
}

function Stat({ label, value, alert }) {
  return (
    <div className="tv-stat">
      <b style={{ color: alert ? C.late : C.text }}>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function TirePhoto({ src }) {
  return src ? <img className="tv-tire-img" src={src} alt="" /> : <span className="tv-tire-img none"><Icon name="tire_repair" size="2.4vw" color={C.faint} /></span>;
}

// Booked for today and not here yet, in time order. Checking one in moves it to "Checked in".
function Appointments({ list, now, loaded }) {
  const compact = list.length > 4;
  const cap = compact ? 7 : 4;
  return (
    <section className="tv-col">
      <div className="tv-col-head" style={{ borderColor: C.muted }}>
        <Icon name="event" size="1.9vw" color={C.muted} />
        <span>Appointments</span>
        <b>{list.length}</b>
      </div>
      <div className="tv-list">
        {list.slice(0, cap).map((a) => {
          const st = apptStatus(a.appointment_at, now);
          const color = st.level === "late" ? C.late : st.level === "slow" ? C.slow : C.muted;
          return (
            <div key={a.id} className={`tv-card appt${compact ? " compact" : ""}`} style={{ borderLeftColor: C.line }}>
              <div className="tv-card-top">
                <span className="tv-appt-time">{apptTime(a.appointment_at)}</span>
                <span className="tv-timer" style={{ color }}>{st.text}</span>
              </div>
              <div className="tv-vehicle">{a.vehicle || a.customer || "Customer"}</div>
              {a.tire_name && <div className="tv-tire-name">{a.tire_name}</div>}
              {tireLine(a) ? <div className="tv-tires">{tireLine(a)}</div> : a.service && <div className="tv-line">{a.service}</div>}
              {!compact && a.customer && <div className="tv-line tv-meta"><span>{a.customer}</span></div>}
            </div>
          );
        })}
        {list.length > cap && <div className="tv-more">+{list.length - cap} more</div>}
        {loaded && list.length === 0 && <div className="tv-empty">No more today</div>}
      </div>
    </section>
  );
}

function Card({ o, color, now, live, confirming, busy, onComplete, onUndo }) {
  const { mins, level } = boardTimer(o, now);
  const fresh = mins < 2;
  const types = (o.job_types || []).map((k) => TYPE[k]).filter(Boolean);
  const timerColor = level === "late" ? C.late : level === "slow" ? C.slow : C.ok;
  const name = tireName(o);
  const canUndo = live && o.status === "done" && o.done_at && now - new Date(o.done_at).getTime() < TV_UNDO_MINS * 60000;
  return (
    <div className={`tv-card${fresh ? " fresh" : ""}`} style={{ borderLeftColor: o.rush ? C.rush : color }}>
      <div className="tv-card-row">
        {(o.tire_img || name || o.tire_size) && <TirePhoto src={o.tire_img} />}
        <div className="tv-card-body">
          <div className="tv-card-top">
            {o.ticket_no != null && <span className="tv-ticket">#{o.ticket_no}</span>}
            {o.rush && <span className="tv-tag" style={{ background: C.rush }}>RUSH</span>}
            {o.waiter && <span className="tv-tag" style={{ background: C.blue }}><Icon name="chair" size="1vw" />WAITING</span>}
            {o.status === "in_bay" && <span className="tv-tag" style={{ background: "#334155" }}>IN BAY</span>}
            <span className="tv-timer" style={{ color: timerColor }}>{fmtMins(mins)}</span>
          </div>
          <div className="tv-vehicle">{o.vehicle || o.customer || "Vehicle"}</div>
          {name && <div className="tv-tire-name">{name}</div>}
          {tireLine(o) && <div className="tv-tires">{tireLine(o)}</div>}
        </div>
        {canUndo && (
          <button className="tv-undo-btn" disabled={busy} onClick={onUndo}><Icon name="undo" size="1.4vw" />Undo</button>
        )}
      </div>
      <div className="tv-line tv-meta">
        {types.map((t) => <span key={t.k} className="tv-type"><Icon name={t.icon} size="1.1vw" />{t.l}</span>)}
        {o.customer && o.vehicle && <span>{o.customer}</span>}
        <span style={{ color: o.tech ? C.text : C.slow }}><Icon name="person" size="1.1vw" />{o.tech || "No tech"}</span>
        {o.bay && <span><Icon name="garage" size="1.1vw" />{bayLabel(o.bay)}</span>}
        {o.promised_at && o.status !== "done" && <span style={{ color: level === "late" ? C.late : undefined }}><Icon name="alarm" size="1.1vw" />{time(o.promised_at)}</span>}
      </div>
      {o.status === "on_hold" && <div className="tv-hold">{HOLD[o.hold_reason] || "On hold"}</div>}
      {live && o.status !== "done" && (
        <button className={`tv-done-btn${confirming ? " confirm" : ""}`} disabled={busy} onClick={onComplete}>
          <Icon name={confirming ? "touch_app" : "check_circle"} size="1.6vw" />
          {busy ? "Saving…" : confirming ? "Tap again to confirm" : "Complete"}
        </button>
      )}
    </div>
  );
}

// Who is free and who is on what, so work goes to the next free tech.
function TechStrip({ staff, orders }) {
  if (!staff.length) return null;
  const mine = (id) => orders.filter((o) => o.assigned_staff_id === id && o.status !== "done");
  return (
    <footer className="tv-techs">
      {staff.map((t) => {
        const jobs = mine(t.id);
        return (
          <div key={t.id} className="tv-tech">
            <span className="dot" style={{ background: jobs.length ? C.blue : C.green }} />
            <b>{t.name.split(/\s+/)[0]}</b>
            <span>{jobs.length ? jobs.map((j) => `${j.vehicle || "job"}${j.bay ? ` (${bayLabel(j.bay)})` : ""}`).join(", ") : "Available"}</span>
          </div>
        );
      })}
    </footer>
  );
}

// Sized in vw/vh so the same page fills a 32" or a 75" TV.
const CSS = `
  html, body { margin: 0; background: ${C.bg}; }
  .tv { height: 100vh; overflow: hidden; display: flex; flex-direction: column; background: ${C.bg}; color: ${C.text};
        font-family: "Inter", system-ui, sans-serif; -webkit-font-smoothing: antialiased; position: relative; }
  .tv .material-symbols-outlined { display: inline-flex; vertical-align: middle; }
  .tv-head { display: flex; align-items: center; gap: 1.6vw; padding: 1.2vh 1.6vw; background: ${C.panel}; border-bottom: 1px solid ${C.line}; }
  .tv-logo { width: 3.6vw; height: 3.6vw; border-radius: 50%; object-fit: cover; background: #fff; }
  .tv-title { font-size: 1.9vw; font-weight: 700; white-space: nowrap; }
  .tv-title span { color: ${C.muted}; font-weight: 500; margin-left: .5vw; }
  .tv-stats { flex: 1; display: flex; justify-content: center; gap: 2.6vw; }
  .tv-stat { display: flex; flex-direction: column; align-items: center; }
  .tv-stat b { font-size: 2.2vw; font-weight: 700; line-height: 1.1; }
  .tv-stat span { font-size: .95vw; color: ${C.muted}; white-space: nowrap; }
  .tv-clock { font-size: 2.6vw; font-weight: 700; font-variant-numeric: tabular-nums; }
  .tv-banner { background: ${C.late}; color: #fff; text-align: center; font-size: 1.3vw; font-weight: 600; padding: .8vh; }
  .tv-message { margin: auto; max-width: 60vw; text-align: center; font-size: 2vw; color: ${C.muted}; }
  .tv-cols { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.55fr) minmax(0, 1fr); gap: .8vw; padding: 1.2vh 1vw; }
  .tv-cols.no-appts { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); }
  .tv-col { display: flex; flex-direction: column; min-height: 0; background: ${C.panel}; border-radius: .8vw; padding: .8vw; }
  .tv-col-head { display: flex; align-items: center; gap: .6vw; font-size: 1.6vw; font-weight: 700; white-space: nowrap; padding-bottom: 1vh; margin-bottom: 1vh; border-bottom: 3px solid; }
  .tv-col-head b { margin-left: auto; font-size: 2vw; }
  .tv-list { display: flex; flex-direction: column; gap: 1vh; min-height: 0; overflow: hidden; }
  .tv-list.two { display: grid; grid-template-columns: repeat(auto-fill, minmax(19vw, 1fr)); align-content: start; gap: 1vh .7vw;
                overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: ${C.line} transparent; padding-right: .3vw; }
  .tv-list.two .tv-more, .tv-list.two .tv-empty { grid-column: 1 / -1; }
  .tv-card { background: ${C.card}; border-radius: .6vw; border-left: .45vw solid; padding: 1.1vh .9vw; min-width: 0; }
  .tv-card.fresh { box-shadow: 0 0 0 2px ${C.text}55; animation: tvpulse 1.6s ease-in-out 3; }
  @keyframes tvpulse { 50% { box-shadow: 0 0 0 4px ${C.text}aa; } }
  .tv-card-row { display: flex; gap: .8vw; align-items: center; }
  .tv-card-body { flex: 1; min-width: 0; }
  .tv-tire-img { width: 5.6vw; height: 5.6vw; object-fit: contain; flex-shrink: 0; background: #fff; border-radius: .5vw; padding: .2vw; box-sizing: border-box; }
  .tv-tire-img.none { display: inline-flex; align-items: center; justify-content: center; background: ${C.panel}; }
  .tv-card-top { display: flex; align-items: center; flex-wrap: wrap; gap: .3vh .5vw; }
  .tv-ticket { font-size: 1.05vw; color: ${C.muted}; font-weight: 600; }
  .tv-vehicle { margin-top: .3vh; font-size: 1.45vw; font-weight: 700; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .tv-timer { margin-left: auto; font-size: 1.5vw; font-weight: 800; font-variant-numeric: tabular-nums; }
  .tv-appt-time { font-size: 1.35vw; font-weight: 800; font-variant-numeric: tabular-nums; }
  .tv-tire-name { margin-top: .3vh; font-size: 1.1vw; font-weight: 600; color: ${C.text}; opacity: .9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tv-tires { margin-top: .2vh; font-size: 1.3vw; font-weight: 700; color: ${C.tire}; font-variant-numeric: tabular-nums; letter-spacing: .02em; }
  .tv-line { display: flex; flex-wrap: wrap; align-items: center; gap: .4vh .8vw; margin-top: .7vh; font-size: 1vw; }
  .tv-tag { display: inline-flex; align-items: center; gap: .2vw; color: #fff; font-weight: 800; font-size: .85vw; padding: .25vh .45vw; border-radius: .3vw; letter-spacing: .04em; }
  .tv-type { display: inline-flex; align-items: center; gap: .25vw; color: ${C.text}; font-weight: 500; }
  .tv-meta { color: ${C.muted}; }
  .tv-meta span { display: inline-flex; align-items: center; gap: .25vw; }
  .tv-hold { margin-top: .8vh; font-size: 1.1vw; font-weight: 700; color: ${C.late}; }
  .tv-card.appt .tv-timer { font-size: 1.15vw; }
  .tv-card.compact { padding: .7vh .8vw; }
  .tv-card.compact .tv-vehicle { font-size: 1.15vw; -webkit-line-clamp: 1; }
  .tv-card.compact .tv-tire-name { font-size: .9vw; }
  .tv-card.compact .tv-tires { font-size: 1vw; }
  .tv-more, .tv-empty { text-align: center; color: ${C.faint}; font-size: 1.3vw; padding: 1vh; }
  .tv-techs { display: flex; gap: 1vw; padding: 1vh 1vw 1.4vh; overflow: hidden; }
  .tv-tech { flex: 1; min-width: 0; display: flex; align-items: center; gap: .6vw; background: ${C.panel}; border-radius: .6vw; padding: 1vh .9vw; font-size: 1.1vw; }
  .tv-tech b { font-size: 1.25vw; }
  .tv-tech span:last-child { color: ${C.muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tv-tech .dot { width: .8vw; height: .8vw; border-radius: 50%; flex-shrink: 0; }
  .tv-notice { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 2vw;
               padding: 3vh 3vw; border-radius: 1.2vw; color: #fff; box-shadow: 0 2vh 8vh #000a; animation: tvnotice .35s ease-out; max-width: 80vw; z-index: 10; }
  .tv-notice.checkin { background: ${C.blue}; }
  .tv-notice.complete { background: #15803d; }
  .tv-notice b { display: block; font-size: 3.2vw; line-height: 1.15; }
  .tv-notice span { display: block; font-size: 1.8vw; margin-top: .6vh; opacity: .95; }
  @keyframes tvnotice { from { opacity: 0; transform: translate(-50%, -46%) scale(.96); } }
  .tv-done-btn { width: 100%; margin-top: 1vh; height: 5.2vh; display: flex; align-items: center; justify-content: center; gap: .5vw;
                 border: 0; border-radius: .5vw; background: ${C.green}; color: #04130a; font: 800 1.15vw "Inter", sans-serif; cursor: pointer;
                 touch-action: manipulation; transition: transform .08s, background .15s; }
  .tv-done-btn:active { transform: scale(.96); }
  .tv-done-btn.confirm { background: ${C.slow}; animation: tvconfirm .8s ease-in-out infinite; }
  @keyframes tvconfirm { 50% { filter: brightness(1.2); } }
  .tv-done-btn:disabled { opacity: .6; }
  .tv-undo-btn { flex-shrink: 0; display: flex; align-items: center; gap: .3vw; border: 1px solid ${C.line}; border-radius: .5vw; background: transparent;
                 color: ${C.text}; font: 600 1vw "Inter", sans-serif; padding: 1vh .8vw; cursor: pointer; }
  .tv-toast { position: absolute; left: 50%; bottom: 8vh; transform: translateX(-50%); display: flex; align-items: center; gap: .5vw; background: ${C.late};
              color: #fff; font-size: 1.2vw; font-weight: 600; padding: 1vh 1.4vw; border-radius: 2vw; z-index: 11; }
  .tv-sound { position: absolute; right: 1vw; bottom: 7vh; display: flex; align-items: center; gap: .5vw; background: #000c; color: ${C.text}; font-size: 1.1vw; padding: .8vh 1vw; border-radius: 2vw; border: 1px solid ${C.line}; }
`;
