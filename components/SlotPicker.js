import React, { useState, useEffect } from 'react';

// Day + time picker for appointments. `days` comes from GET /api/booking/slots:
// [{ date: "2026-10-17", label: "Tomorrow, Oct 17", slots: [{ at, label }] }].
// onChange(slot, day) fires with the picked slot; `value` is the picked slot's `at`.
export default function SlotPicker({ days, value, onChange }) {
  const open = days.filter((d) => d.slots && d.slots.length);
  const dayOf = (at) => open.find((d) => d.slots.some((s) => s.at === at));
  const [date, setDate] = useState((value && dayOf(value)?.date) || open[0]?.date);

  // Fresh days (e.g. after a slot was taken) may no longer include the shown day.
  useEffect(() => {
    if (!open.some((d) => d.date === date)) setDate(open[0]?.date);
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const day = open.find((d) => d.date === date);
  if (!open.length) return null;

  return (
    <div className="sp">
      <div className="sp-days" role="tablist" aria-label="Day">
        {open.map((d) => {
          const [top, bottom] = splitLabel(d.label);
          return (
            <button key={d.date} type="button" role="tab" aria-selected={d.date === date}
              className={`sp-day${d.date === date ? ' on' : ''}`} onClick={() => setDate(d.date)}>
              <b>{top}</b><span>{bottom}</span>
            </button>
          );
        })}
      </div>

      {day && PARTS.map(([part, test]) => {
        const slots = day.slots.filter((s) => test(hourOf(s.label)));
        if (!slots.length) return null;
        return (
          <div key={part} className="sp-part">
            <div className="sp-part-h">{part}</div>
            <div className="sp-slots">
              {slots.map((s) => (
                <button key={s.at} type="button" className={`sp-slot${s.at === value ? ' on' : ''}`}
                  aria-pressed={s.at === value} onClick={() => onChange(s, day)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <style jsx>{`
        .sp-days { display: flex; gap: 0.5rem; overflow-x: auto; padding: 2px 2px 0.6rem; margin: 0 -2px; scrollbar-width: thin; }
        .sp-day { flex: 0 0 auto; min-width: 84px; display: flex; flex-direction: column; align-items: center; gap: 0.1rem;
          background: #fff; border: 1px solid #dcdcdc; border-radius: 12px; padding: 0.55rem 0.7rem; cursor: pointer; font: inherit; color: #111; }
        .sp-day b { font-size: 0.85rem; font-weight: 800; }
        .sp-day span { font-size: 0.72rem; color: #6b6b6b; }
        .sp-day.on { border-color: #E01B22; background: rgba(224,27,34,0.08); }
        .sp-day.on b { color: #E01B22; }
        .sp-part { margin-top: 0.9rem; }
        .sp-part-h { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #6b6b6b; margin-bottom: 0.45rem; }
        .sp-slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 0.5rem; }
        .sp-slot { background: #fff; border: 1px solid #dcdcdc; border-radius: 10px; padding: 0.65rem 0.4rem; font: inherit;
          font-size: 0.88rem; font-weight: 700; color: #111; cursor: pointer; }
        .sp-slot:hover, .sp-day:hover { border-color: #E01B22; }
        .sp-slot.on { background: #E01B22; border-color: #E01B22; color: #fff; }
      `}</style>
    </div>
  );
}

// "9:30 AM" -> 9, "1:00 PM" -> 13
function hourOf(label = '') {
  const m = label.match(/(\d+):\d+\s*(AM|PM)/i);
  if (!m) return 12;
  const h = Number(m[1]) % 12;
  return /pm/i.test(m[2]) ? h + 12 : h;
}
const PARTS = [
  ['Morning', (h) => h < 12],
  ['Afternoon', (h) => h >= 12 && h < 17],
  ['Evening', (h) => h >= 17],
];

// "Tomorrow, Oct 17" -> ["Tomorrow", "Oct 17"]; "Sat, Oct 18" -> ["Sat", "Oct 18"].
function splitLabel(label = '') {
  const i = label.indexOf(', ');
  return i === -1 ? [label, ''] : [label.slice(0, i), label.slice(i + 2)];
}

// The lead's timing bucket from the picked day (feeds serviceTiming / lead priority).
export function timingForDay(day) {
  if (/^today/i.test(day.label) || isToday(day.date)) return 'ASAP';
  if (/^tomorrow/i.test(day.label)) return 'Tomorrow';
  const dow = new Date(`${day.date}T12:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6 ? 'This Weekend' : 'This Week';
}

function isToday(date) {
  const la = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
  return la === date;
}
