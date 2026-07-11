import React from 'react';

export default function Locations() {
  return (
    <section id="locations" style={{ background: 'var(--bg-alt)', borderTop: '1px solid var(--line)', padding: 'clamp(3.5rem, 8vw, 5.5rem) 0' }}>
      <div className="tp-wrap" style={{ maxWidth: '760px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span className="tp-eyebrow">Visit Us</span>
          <h2 style={{ fontSize: 'clamp(1.9rem, 4vw, 2.6rem)', fontWeight: 700, letterSpacing: '-0.03em', margin: '0.5rem 0 0' }}>Downtown Los Angeles</h2>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 'clamp(1.5rem, 4vw, 2.25rem)', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>
            <div>
              <div style={{ color: 'var(--muted)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Address</div>
              <p style={{ fontWeight: 600, fontSize: '1rem', margin: 0 }}>2331 E Olympic Blvd</p>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>Los Angeles, CA 90021</p>
            </div>
            <div>
              <div style={{ color: 'var(--muted)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Hours</div>
              <p style={{ fontWeight: 600, fontSize: '1rem', margin: 0 }}>Open 7 days</p>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>Mon–Fri 9–7 · Sat 9–6 · Sun 10–4</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a href="https://www.google.com/maps/dir/?api=1&destination=2331+E+Olympic+Blvd+Los+Angeles+CA+90021" target="_blank" rel="noopener noreferrer" className="tp-btn tp-btn-primary" style={{ flex: '1 1 180px' }}>Get directions</a>
            <a href="tel:562-500-4625" className="tp-btn tp-btn-ghost" style={{ flex: '1 1 180px' }}>Call (562) 500-4625</a>
          </div>
        </div>
      </div>
    </section>
  );
}
