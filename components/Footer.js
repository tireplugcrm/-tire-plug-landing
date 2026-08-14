import React from 'react';

export default function Footer() {
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const year = 2026;

  return (
    <footer style={{ background: 'var(--bg)', borderTop: '1px solid var(--line)', padding: '3rem 0 2rem' }}>
      <div className="tp-wrap">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.75rem' }}>
              <img src="/images/logo.webp" alt="The Tire Plug" style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
              <span style={{ fontWeight: 800, letterSpacing: '-0.02em' }}>The Tire Plug</span>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>
              Premium tires & honest auto service in Downtown Los Angeles. Done right.
            </p>
          </div>

          {/* Shop */}
          <div>
            <div style={footHead}>Shop</div>
            <button onClick={() => go('quote')} style={footLink}>Get a quote</button>
            <button onClick={() => go('shop')} style={footLink}>Shop tires</button>
            <button onClick={() => go('services')} style={footLink}>Services</button>
            <a href="/warranty" style={footLink}>Road Hazard Protection</a>
          </div>

          {/* Visit */}
          <div>
            <div style={footHead}>Visit</div>
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: '0 0 0.35rem', lineHeight: 1.5 }}>2331 E Olympic Blvd<br />Los Angeles, CA 90021</p>
            <a href="tel:562-500-4625" style={{ ...footLink, display: 'inline-block' }}>(562) 500-4625</a>
          </div>

          {/* Connect */}
          <div>
            <div style={footHead}>Connect</div>
            <a href="https://www.instagram.com/tireplugcali" target="_blank" rel="noopener noreferrer" style={footLink}>Instagram</a>
            <a href="/careers" style={footLink}>Careers</a>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>© {year} The Tire Plug · Los Angeles</span>
          <span style={{ display: 'flex', gap: '1.25rem' }}>
            <a href="/privacy" style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Privacy</a>
            <a href="/terms" style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Terms</a>
          </span>
        </div>
      </div>
    </footer>
  );
}

const footHead = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink)', marginBottom: '0.75rem' };
const footLink = { display: 'block', background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.88rem', padding: '0.25rem 0', textAlign: 'left', textDecoration: 'none' };
