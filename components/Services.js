import React from 'react';

const SERVICES = [
  { name: 'New Tires', desc: 'Top brands, wholesale pricing, expert install.', price: 'Get quote' },
  { name: 'Used Tires', desc: 'Quality inspected tires at a fraction of new.', price: 'Budget' },
  { name: 'Oil Change', desc: 'Full synthetic with a new filter, done fast.', price: 'From $75' },
  { name: 'Wheel Alignment', desc: 'Straight driving, longer tire life.', price: '$75' },
  { name: 'TPMS Sensors', desc: 'Turn off that tire-pressure light for good.', price: '$199 / set' },
  { name: 'Brake Service', desc: 'Pads, rotors, and honest inspections.', price: 'Get quote' },
  { name: 'Rotation & Balance', desc: 'Extend tire life every 5,000 miles.', price: '$40' },
  { name: 'Free Air & Inspection', desc: 'Air check and safety look — on the house.', price: 'Free' },
];

export default function Services() {
  return (
    <section id="services" style={{ background: 'var(--bg-alt)', borderTop: '1px solid var(--line)', padding: 'clamp(3.5rem, 8vw, 5.5rem) 0' }}>
      <div className="tp-wrap">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span className="tp-eyebrow">Our Services</span>
          <h2 style={{ fontSize: 'clamp(1.9rem, 4vw, 2.6rem)', fontWeight: 700, letterSpacing: '-0.03em', margin: '0.5rem 0 0.4rem' }}>Everything your car needs</h2>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '1.02rem' }}>Honest pricing. Same-day service. Done right.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {SERVICES.map((s) => (
            <div key={s.name} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '1.4rem 1.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.35rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.01em' }}>{s.name}</h3>
                <span style={{ color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.price}</span>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
