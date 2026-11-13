// Belen's appointment tracker: the bookings she made this month (website bookings from her
// "Book a customer" link, or Front Desk bookings with her name), whether each customer showed, and
// the commission once the RO with that name is matched. Used by /belen and the admin Belen tab.
// Data: /api/belen-pay action "bookings".
import React, { useEffect, useState } from "react";
import { T, Icon, ui } from "./admin/ui.js";

const TZ = "America/Los_Angeles";
const $ = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthName = (m) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const shiftMonth = (m, n) => { const d = new Date(`${m}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
const when = (iso) => (iso ? new Date(iso).toLocaleString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "No time set");
const OUT = {
  showed: { label: "Showed up", color: T.green },
  upcoming: { label: "Coming up", color: T.blue },
  unknown: { label: "Not checked in", color: T.amber },
  canceled: { label: "Canceled", color: T.red },
  no_show: { label: "No-show", color: T.red },
};

export default function BelenBookings({ call, bookLink = "/?by=belen" }) {
  const [month, setMonth] = useState("");
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { call({ action: "bookings", month }).then((d) => { setS(d); setErr(""); }).catch((e) => setErr(e.message)); /* eslint-disable-next-line */ }, [month]);

  return (
    <div style={{ color: T.text }}>
      <a href={bookLink} target="_blank" rel="noopener noreferrer" style={{ ...ui.primary, width: "100%", height: 46, fontSize: 16, boxSizing: "border-box", marginBottom: 6 }}>
        <Icon name="event_available" size={20} />Book a customer
      </a>
      <div style={{ color: T.textMuted, fontSize: 12.5, textAlign: "center", marginBottom: 14 }}>Opens the website with your name on it. Every booking you finish there counts as yours.</div>

      {!s ? <div style={{ color: T.textMuted, padding: 24, textAlign: "center" }}>{err || "Loading…"}</div> : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
            <button aria-label="Previous month" style={{ ...ui.btn, width: 40, padding: 0 }} onClick={() => setMonth(shiftMonth(s.month, -1))}><Icon name="chevron_left" /></button>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{monthName(s.month)}</div>
            <button aria-label="Next month" style={{ ...ui.btn, width: 40, padding: 0 }} onClick={() => setMonth(shiftMonth(s.month, 1))}><Icon name="chevron_right" /></button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            <Tile k="Booked" v={s.totals.booked} />
            <Tile k="Showed" v={s.totals.showed} c={T.green} />
            <Tile k="Coming up" v={s.totals.upcoming} c={T.blue} />
            <Tile k="Commission" v={$(s.totals.commission)} c={T.green} small />
          </div>

          <div style={{ marginTop: 12 }}>
            {s.bookings.length === 0 && <div style={{ ...ui.card, color: T.textMuted, fontSize: 13.5 }}>No bookings with your name this month yet. Use <b>Book a customer</b> every time you book someone.</div>}
            {s.bookings.map((x) => {
              const o = OUT[x.outcome] || OUT.unknown;
              return (
                <div key={x.id} style={{ ...ui.card, marginBottom: 8, padding: "0.75rem 1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 14.5, minWidth: 0 }}>{x.name || "Customer"}</div>
                    <span style={ui.pill(o.color)}>{o.label}</span>
                  </div>
                  <div style={{ color: T.textMuted, fontSize: 12.5, marginTop: 2 }}>{when(x.at)}{x.service ? ` · ${x.service}` : ""}</div>
                  {x.ro && (
                    <div style={{ fontSize: 12.5, marginTop: 4, color: x.ro.commission ? T.green : T.textMuted }}>
                      RO #{x.ro.ro_number} · {x.ro.commission ? `commission ${$(x.ro.commission)}` : "waiting for the shop to match it"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ color: T.textFaint, fontSize: 12, marginTop: 6 }}>Commission shows here once you log the RO in My pay with the same name as the booking.</div>
        </>
      )}
    </div>
  );
}

function Tile({ k, v, c, small }) {
  return (
    <div style={{ ...ui.card, padding: "0.6rem 0.7rem" }}>
      <div style={{ color: T.textMuted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k}</div>
      <div style={{ fontSize: small ? 15 : 22, fontWeight: 800, color: c || T.text, marginTop: 2 }}>{v}</div>
    </div>
  );
}
