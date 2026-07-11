import React from 'react';
import Wheel from './Wheel';

export default function Hero() {
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section id="top" style={{ background: 'var(--bg)', padding: 'clamp(2.5rem, 7vw, 5rem) 0 3rem' }}>
      <div className="tp-wrap fade-in" style={{ textAlign: 'center' }}>
        <span className="tp-eyebrow">The Tire Plug · Los Angeles</span>
        <h1 style={{ fontSize: 'clamp(2.2rem, 7vw, 4.2rem)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.03, margin: '0.9rem 0 0.85rem', textWrap: 'balance' }}>
          The best way to buy tires<br />in Los Angeles.
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.4vw, 1.2rem)', color: 'var(--muted)', maxWidth: '35rem', margin: '0 auto 2rem' }}>
          Order online and get them installed same-day at the city's most-trusted shop. Honest pricing, done right.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => go('quote')} className="tp-btn tp-btn-primary">Get a Quote</button>
          <button onClick={() => go('services')} className="tp-btn tp-btn-ghost">Our Services</button>
        </div>
        <Wheel style={{ width: 'min(320px, 68vw)', height: 'auto', margin: '2.75rem auto 0', filter: 'drop-shadow(0 26px 36px rgba(20,22,26,0.16))' }} />
      </div>
    </section>
  );
}
