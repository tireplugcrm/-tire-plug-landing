import React from 'react';
import Wheel from './Wheel';

// Starter catalog teaser. Prices/specs are placeholders until real numbers are in.
// For now "Order" scrolls to the quote; it becomes real checkout in the store phase.
const TIRES = [
  { brand: 'Lexani', name: 'LX-Twenty', desc: 'Ultra-high-performance all-season. Bold looks, quiet ride, serious grip.', price: '149', tag: '40k mi' },
  { brand: 'Lexani', name: 'Quattro Tempo', desc: 'All-season touring. Smooth, long-wearing, and a great everyday value.', price: '119', tag: '55k mi' },
  { brand: 'RBP', name: 'Repulsor A/T', desc: 'All-terrain toughness for trucks & SUVs. Aggressive tread, built to work.', price: '189', tag: 'Off-road' },
];

export default function ShopTires() {
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section id="shop" style={{ background: 'var(--bg)', padding: 'clamp(3.5rem, 8vw, 5.5rem) 0' }}>
      <div className="tp-wrap">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span className="tp-eyebrow">Shop Tires</span>
          <h2 style={{ fontSize: 'clamp(1.9rem, 4vw, 2.6rem)', fontWeight: 700, letterSpacing: '-0.03em', margin: '0.5rem 0 0.4rem' }}>Start with the best sellers</h2>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '1.02rem' }}>Buy online, install at our shop. No shipping, no waiting on a box.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
          {TIRES.map((t) => (
            <article key={t.name} className="tp-card" style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '1.75rem 1.5rem 1.5rem', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column' }}>
              <Wheel style={{ width: '150px', height: '150px', margin: '0 auto 0.4rem' }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t.brand}</span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.02em', margin: '0.15rem 0 0.35rem' }}>{t.name}</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 1.1rem', flex: 1, lineHeight: 1.5 }}>{t.desc}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em' }}>${t.price}<span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--muted)' }}> / tire*</span></span>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--muted)', border: '1px solid var(--line)', padding: '0.2rem 0.5rem', borderRadius: '50px' }}>{t.tag}</span>
              </div>
              <button onClick={() => go('quote')} className="tp-btn tp-btn-primary" style={{ width: '100%' }}>Order &amp; book install</button>
            </article>
          ))}
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: '1rem' }}>* Sample pricing — real prices &amp; sizes coming soon.</p>
      </div>

      <style jsx>{`
        :global(.tp-card) { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        :global(.tp-card:hover) { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
      `}</style>
    </section>
  );
}
