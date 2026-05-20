import React from 'react';

export default function Promos() {
  const promos = [
    {
      tag: 'Limited Time',
      title: 'Tire Rotation + Rebalance',
      price: '$40',
      original: '$60',
      desc: 'Extend tire life by 50%. Every 5,000 miles.',
      code: null,
      cta: null,
    },
    {
      tag: 'New Customer Bonus',
      title: 'Book Your Service',
      price: '$20 OFF',
      original: null,
      desc: 'First-time customers save instantly. Any service.',
      code: null,
      cta: 'book',
      featured: true,
    },
    {
      tag: 'Returning Customers',
      title: '10% OFF Oil Change',
      price: '10% OFF',
      original: null,
      desc: 'Maintenance made affordable.',
      code: 'LOYAL10',
      cta: null,
    },
  ];

  const scrollToBooking = () => {
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="promos" style={{ background: '#000', padding: '6rem 2rem', color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(255,31,31,0.05) 0%, transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <p style={{ color: '#FF3838', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>
            Current Promos
          </p>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, maxWidth: '600px', margin: '0 auto' }}>
            Real Deals. <span style={{ color: '#FF1F1F' }}>No Catch.</span>
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', maxWidth: '900px', margin: '0 auto' }}>
          {promos.map((promo, idx) => {
            const isClickable = promo.cta === 'book';

            if (isClickable) {
              return (
                <button
                  key={idx}
                  onClick={scrollToBooking}
                  className="promo-card featured clickable"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,31,31,0.12) 0%, rgba(255,31,31,0.04) 100%)',
                    border: '1px solid rgba(255,31,31,0.4)',
                    borderRadius: '20px',
                    padding: '2.25rem 1.75rem',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    width: '100%',
                    boxShadow: '0 0 40px rgba(255,31,31,0.15)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ position: 'absolute', top: '-30%', right: '-20%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(255,31,31,0.25) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

                  <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: 'rgba(255,31,31,0.15)', color: '#FF3838', padding: '0.3rem 0.7rem', borderRadius: '50px', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid rgba(255,31,31,0.3)', position: 'relative', zIndex: 2 }}>
                    {promo.tag}
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', lineHeight: 1.3, letterSpacing: '-0.01em', position: 'relative', zIndex: 2 }}>
                    {promo.title}
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', position: 'relative', zIndex: 2 }}>
                    <span style={{ fontSize: '3rem', fontWeight: 800, color: '#FF1F1F', letterSpacing: '-0.03em', lineHeight: 1, textShadow: '0 0 30px rgba(255,31,31,0.4)' }}>
                      {promo.price}
                    </span>
                  </div>

                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', lineHeight: 1.5, fontWeight: 400, position: 'relative', zIndex: 2 }}>
                    {promo.desc}
                  </p>

                  <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,31,31,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em', fontWeight: 600 }}>
                      Tap to book
                    </span>
                    <span style={{ color: '#FF3838', fontSize: '1.2rem', fontWeight: 700 }}>
                      →
                    </span>
                  </div>
                </button>
              );
            }

            return (
              <div key={idx} className="promo-card" style={{ background: 'linear-gradient(135deg, rgba(255,31,31,0.04) 0%, rgba(255,31,31,0.01) 100%)', border: '1px solid rgba(255,31,31,0.15)', borderRadius: '20px', padding: '2.25rem 1.75rem', transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: 'rgba(255,31,31,0.08)', color: 'rgba(255,31,31,0.8)', padding: '0.3rem 0.7rem', borderRadius: '50px', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid rgba(255,31,31,0.15)' }}>
                  {promo.tag}
                </div>

                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                  {promo.title}
                </h3>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
                  <span style={{ fontSize: '3rem', fontWeight: 800, color: '#FF1F1F', letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {promo.price}
                  </span>
                  {promo.original && (
                    <span style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through', fontWeight: 500 }}>
                      {promo.original}
                    </span>
                  )}
                </div>

                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', lineHeight: 1.5, fontWeight: 400 }}>
                  {promo.desc}
                </p>

                {promo.code && (
                  <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', fontWeight: 500 }}>
                      Use code
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#FF1F1F', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                      {promo.code}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <a href="tel:562-513-0217" className="claim-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #FF1F1F 0%, #B30000 100%)', color: '#fff', padding: '1.1rem 2.5rem', fontSize: '1rem', fontWeight: 800, borderRadius: '50px', transition: 'all 0.3s ease', boxShadow: '0 8px 24px rgba(255,31,31,0.25)', letterSpacing: '0.02em', textDecoration: 'none' }}>
            📞 Call to Claim · 562-513-0217
          </a>
          <p style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
            Or book online in 60 seconds
          </p>
        </div>
      </div>

      <style jsx>{`
        .promo-card:hover {
          border-color: rgba(255,31,31,0.4) !important;
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(255,31,31,0.08);
        }
        .promo-card.featured:hover {
          border-color: rgba(255,31,31,0.7) !important;
          box-shadow: 0 20px 60px rgba(255,31,31,0.25) !important;
          transform: translateY(-6px);
        }
        .promo-card.clickable {
          cursor: pointer;
        }
        .claim-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(255,31,31,0.4) !important;
        }
      `}</style>
    </section>
  );
}