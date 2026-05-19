import React from 'react';

export default function Promos() {
  const promos = [
    { tag: 'LIMITED TIME', title: 'Tire Rotation + Rebalance', price: '$40', original: '$60', desc: 'Extend tire life by 50%. Every 5,000 miles.', code: null },
    { tag: 'POPULAR', title: '4 Brand New Tires', price: '$50 OFF', original: null, desc: 'Top brands. Installed, balanced, and aligned.', code: 'TIRES50' },
    { tag: 'FIX THAT LIGHT', title: 'TPMS Service', price: '$199', original: null, desc: 'We know that light is on. We help turn it off.', code: null },
    { tag: 'LOYAL CUSTOMER', title: '10% OFF Next Oil Change', price: '10% OFF', original: null, desc: 'For our returning customers.', code: 'LOYAL10' },
  ];

  return (
    <section id="promos" style={{ background: '#000', padding: '6rem 2rem', color: '#fff' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <p style={{ color: '#B2FF00', fontSize: '0.95rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            Current Promos
          </p>
          <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Real Deals. <span style={{ color: '#B2FF00' }}>No Catch.</span>
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {promos.map((promo, idx) => (
            <div key={idx} style={{ background: 'rgba(178, 255, 0, 0.05)', border: '1px solid rgba(178, 255, 0, 0.2)', borderRadius: '20px', padding: '2rem' }}>
              <div style={{ display: 'inline-block', background: 'rgba(178, 255, 0, 0.15)', color: '#B2FF00', padding: '0.3rem 0.8rem', borderRadius: '50px', fontSize: '0.7rem', fontWeight: 700, marginBottom: '1.5rem' }}>
                {promo.tag}
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1rem' }}>
                {promo.title}
              </h3>
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#B2FF00' }}>
                  {promo.price}
                </span>
                {promo.original && (
                  <span style={{ fontSize: '1.2rem', color: '#86868B', textDecoration: 'line-through', marginLeft: '0.75rem' }}>
                    {promo.original}
                  </span>
                )}
              </div>
              <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: promo.code ? '1.5rem' : '0' }}>
                {promo.desc}
              </p>
              {promo.code && (
                <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px dashed rgba(178, 255, 0, 0.4)', borderRadius: '10px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', color: '#86868B' }}>CODE</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#B2FF00', fontSize: '1rem' }}>
                    {promo.code}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <a href="tel:562-513-0217" style={{ display: 'inline-block', background: '#B2FF00', color: '#000', padding: '1.1rem 2.5rem', fontSize: '1.05rem', fontWeight: 700, borderRadius: '50px' }}>
            Call to Claim - 562-513-0217
          </a>
        </div>
      </div>
    </section>
  );
}