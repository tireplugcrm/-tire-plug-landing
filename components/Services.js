import React from 'react';

// `quote` maps a service card to a chip in the Quote-by-text tool so clicking a
// card jumps to the quote with that service pre-selected. null = just scroll.
const SERVICES = [
  { name: 'New Tires', desc: 'Top brands, wholesale pricing, expert install.', price: 'Get quote', quote: 'New Tires' },
  { name: 'Used Tires', desc: 'Quality inspected tires at a fraction of new.', price: 'Budget', quote: 'Used Tires' },
  { name: 'Oil Change', desc: 'Full synthetic with a new filter, done fast.', price: 'From $75', quote: 'Oil Change' },
  { name: 'Wheel Alignment', desc: 'Straight driving, longer tire life.', price: '$75', quote: 'Alignment' },
  { name: 'TPMS Sensors', desc: 'Turn off that tire-pressure light for good.', price: '$199 / set', quote: 'TPMS Sensors' },
  { name: 'Brake Service', desc: 'Pads, rotors, and honest inspections.', price: 'Get quote', quote: 'Brakes' },
  { name: 'Rotation & Balance', desc: 'Extend tire life every 5,000 miles.', price: '$40', quote: null },
  { name: 'Free Air & Inspection', desc: 'Air check and safety look — on the house.', price: 'Free', quote: null },
];

export default function Services() {
  function pick(s) {
    if (s.quote && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tp-service', { detail: s.quote }));
    }
    document.getElementById('quote')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <section id="services" style={{ background: 'var(--bg-alt)', borderTop: '1px solid var(--line)', padding: 'clamp(3.5rem, 8vw, 5.5rem) 0' }}>
      <div className="tp-wrap">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span className="tp-eyebrow">Our Services</span>
          <h2 style={{ fontSize: 'clamp(1.9rem, 4vw, 2.6rem)', fontWeight: 700, letterSpacing: '-0.03em', margin: '0.5rem 0 0.4rem' }}>Everything your car needs</h2>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '1.02rem' }}>Honest pricing. Same-day service. Tap a service to get a quote.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {SERVICES.map((s) => (
            <button key={s.name} onClick={() => pick(s)} className="tp-svc" style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '1.4rem 1.35rem', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.35rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{s.name}</h3>
                <span style={{ color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.price}</span>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: '0 0 0.75rem', lineHeight: 1.5 }}>{s.desc}</p>
              <span style={{ color: 'var(--ink)', fontSize: '0.82rem', fontWeight: 600 }}>Get a quote →</span>
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        :global(.tp-svc) { transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease; }
        :global(.tp-svc:hover) { transform: translateY(-3px); box-shadow: var(--shadow); border-color: var(--ghost-line) !important; }
      `}</style>
    </section>
  );
}
