import React from 'react';

export default function WhyUs() {
  const reasons = [
    { number: '01', title: 'Fast, Stress-Free Service', desc: 'We get that car problems are stressful. That is why we focus on making the process quick, smooth, and comfortable from the moment you walk in. Customers consistently mention how fast, friendly, and trustworthy our team is.' },
    { number: '02', title: 'Complete Service Done Right', desc: 'Tires, balancing, alignment, oil changes, TPMS - we handle everything in one place. Get brand-new tires installed, balanced, and aligned the same day without running around to different shops.' },
    { number: '03', title: 'Honest Pricing, Real Options', desc: 'We are not here to pressure anyone into a sale. We give multiple options and quotes so you can choose what fits your budget. Transparency, fast turnaround, and genuine help over selling.' },
  ];

  return (
    <section style={{ background: '#F5F5F7', padding: '6rem 2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <p style={{ color: '#86868B', fontSize: '0.95rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            Why The Tire:Plug
          </p>
          <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, color: '#1d1d1f', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Different from the other shops.
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
          {reasons.map((reason, idx) => (
            <div key={idx} style={{ background: '#fff', borderRadius: '20px', padding: '2.5rem', border: '1px solid #E5E5E7' }}>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: '#B2FF00', lineHeight: 1, marginBottom: '1.5rem' }}>
                {reason.number}
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1d1d1f', marginBottom: '1rem', lineHeight: 1.3 }}>
                {reason.title}
              </h3>
              <p style={{ color: '#86868B', fontSize: '0.95rem', lineHeight: 1.6 }}>
                {reason.desc}
              </p>
            </div>
          ))}
        </div>

        <div style={{ background: '#000', borderRadius: '20px', padding: '4rem 2rem', textAlign: 'center', color: '#fff' }}>
          <h3 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, marginBottom: '1rem', letterSpacing: '-0.02em' }}>
            Ready to experience the difference?
          </h3>
          <p style={{ fontSize: '1.1rem', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem' }}>
            Book online or give us a call. Same day appointments available.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#booking" style={{ background: '#B2FF00', color: '#000', padding: '1.1rem 2.5rem', fontSize: '1rem', fontWeight: 700, borderRadius: '50px', display: 'inline-block' }}>
              Book Online
            </a>
            <a href="tel:562-513-0217" style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', padding: '1.1rem 2.5rem', fontSize: '1rem', fontWeight: 600, borderRadius: '50px', display: 'inline-block' }}>
              Call 562-513-0217
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}