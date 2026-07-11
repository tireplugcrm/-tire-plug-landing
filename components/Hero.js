import React from 'react';
import Wheel from './Wheel';

export default function Hero() {
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section id="top" style={{ background: 'var(--bg)', padding: 'clamp(2.5rem, 7vw, 5rem) 0 3rem' }}>
      <div className="tp-wrap fade-in" style={{ textAlign: 'center' }}>
        <span className="tp-eyebrow">The Tire Plug · Los Angeles</span>
        <h1 style={{ fontSize: 'clamp(2.4rem, 8vw, 4.4rem)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.02, margin: '0.9rem 0 0.8rem', textWrap: 'balance' }}>
          The right tires.<br />Installed today.
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.4vw, 1.2rem)', color: 'var(--muted)', maxWidth: '34rem', margin: '0 auto 2rem' }}>
          Premium tires and honest service in Downtown LA. Order online — we install same-day.
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
