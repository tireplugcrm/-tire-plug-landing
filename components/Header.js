import React, { useState, useEffect } from 'react';
import { REVIEWS_FALLBACK } from '../lib/reviews-fallback';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);

  const go = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  const links = [
    { label: 'Tires', id: 'quote' },
    { label: 'Services', id: 'services' },
    { label: 'Locations', id: 'locations' },
  ];

  return (
    <>
      {/* Slim proof strip */}
      <div style={{ background: 'var(--bg-alt)', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: '0.78rem', fontWeight: 500 }}>
        <div className="tp-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', height: '38px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
            <button onClick={() => setReviewsOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--ink)', fontSize: 'inherit', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <GoogleG /> 5.0 <span className="tp-hide-sm">Google</span>
            </button>
            <span className="tp-hide-sm" style={{ opacity: 0.4 }}>·</span>
            <span className="tp-hide-sm">10,000+ vehicles serviced</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flexShrink: 0 }}>
            <a href="https://www.instagram.com/tireplugcali" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="tp-social"><IgIcon /></a>
            <a href="https://www.facebook.com/tireplugla" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="tp-social"><FbIcon /></a>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.82)', backdropFilter: 'saturate(180%) blur(14px)', WebkitBackdropFilter: 'saturate(180%) blur(14px)', borderBottom: '1px solid var(--line)' }}>
        <div className="tp-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '62px' }}>
          {/* Logo */}
          <button onClick={() => go('top')} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', background: 'none', border: 'none', padding: 0 }}>
            <img src="/images/logo.webp" alt="The Tire Plug" style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover' }} />
            <span style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', color: 'var(--ink)' }}>The Tire Plug</span>
          </button>

          {/* Desktop links */}
          <div className="tp-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            {links.map((l) => (
              <button key={l.id} onClick={() => go(l.id)} style={navLink}>{l.label}</button>
            ))}
            <button onClick={() => setReviewsOpen(true)} style={navLink}>Reviews</button>
            <button onClick={() => go('quote')} className="tp-btn tp-btn-primary" style={{ padding: '0.7rem 1.3rem', fontSize: '0.88rem' }}>Get a Quote</button>
          </div>

          {/* Mobile hamburger */}
          <button className="tp-menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu" style={{ display: 'none', background: 'none', border: 'none', width: '40px', height: '40px', flexDirection: 'column', justifyContent: 'center', gap: '5px', alignItems: 'center' }}>
            <span style={{ ...bar, transform: menuOpen ? 'translateY(7px) rotate(45deg)' : 'none' }} />
            <span style={{ ...bar, opacity: menuOpen ? 0 : 1 }} />
            <span style={{ ...bar, transform: menuOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="tp-mobile-menu" style={{ borderTop: '1px solid var(--line)', background: 'var(--bg)', padding: '0.5rem 0 1.25rem' }}>
            <div className="tp-wrap" style={{ display: 'flex', flexDirection: 'column' }}>
              {links.map((l) => (
                <button key={l.id} onClick={() => go(l.id)} style={mobileLink}>{l.label}</button>
              ))}
              <button onClick={() => { setReviewsOpen(true); setMenuOpen(false); }} style={mobileLink}>Reviews</button>
              <button onClick={() => go('quote')} className="tp-btn tp-btn-primary" style={{ marginTop: '0.75rem', width: '100%' }}>Get a Quote</button>
            </div>
          </div>
        )}
      </nav>

      <style jsx>{`
        :global(.tp-social) { color: var(--muted); display: inline-flex; transition: color 0.2s ease; }
        :global(.tp-social:hover) { color: var(--ink); }
        @media (max-width: 820px) {
          :global(.tp-nav-links) { display: none !important; }
          :global(.tp-menu-btn) { display: flex !important; }
        }
        @media (max-width: 520px) {
          :global(.tp-hide-sm) { display: none !important; }
        }
      `}</style>

      <ReviewsModal isOpen={reviewsOpen} onClose={() => setReviewsOpen(false)} />
    </>
  );
}

const navLink = { background: 'none', border: 'none', color: 'var(--ink-soft)', fontSize: '0.92rem', fontWeight: 500, letterSpacing: '-0.01em' };
const mobileLink = { background: 'none', border: 'none', color: 'var(--ink)', fontSize: '1.05rem', fontWeight: 500, textAlign: 'left', padding: '0.85rem 0', borderBottom: '1px solid var(--line)' };
const bar = { display: 'block', width: '22px', height: '2px', background: 'var(--ink)', borderRadius: '2px', transition: 'all 0.25s ease' };

function GoogleG() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
function IgIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zm0 3.68A6.16 6.16 0 1018.16 12 6.16 6.16 0 0012 5.84zm0 10.16A4 4 0 1116 12a4 4 0 01-4 4zm6.41-11.85a1.44 1.44 0 101.44 1.44 1.44 1.44 0 00-1.44-1.44z" />
    </svg>
  );
}
function FbIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 10-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0022 12z" />
    </svg>
  );
}

/* ---------------- Reviews modal (live Google reviews, light theme) ---------------- */
function ReviewsModal({ isOpen, onClose }) {
  const [current, setCurrent] = useState(0);
  const [reviews, setReviews] = useState(REVIEWS_FALLBACK);

  useEffect(() => {
    let on = true;
    fetch('/api/reviews')
      .then((r) => r.json())
      .then((d) => { if (on && d && Array.isArray(d.reviews) && d.reviews.length) setReviews(d.reviews); })
      .catch(() => {});
    return () => { on = false; };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => setCurrent((p) => (p + 1) % reviews.length), 4500);
    return () => clearInterval(t);
  }, [isOpen, reviews.length]);

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const r = reviews[current] || reviews[0];
  if (!r) return null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,22,26,0.45)', backdropFilter: 'blur(4px)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', maxWidth: '520px', width: '100%', padding: '2.25rem 2rem', boxShadow: 'var(--shadow-lg)', position: 'relative' }}>
        <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'var(--bg-alt)', border: '1px solid var(--line)', color: 'var(--muted)', width: '32px', height: '32px', borderRadius: '50%', fontSize: '0.9rem' }}>✕</button>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ color: '#f5a623', fontSize: '1rem', letterSpacing: '0.1em' }}>★★★★★</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', margin: '0.4rem 0 0.2rem' }}>5.0 on Google</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Real reviews from Los Angeles drivers</p>
        </div>
        <div key={current} style={{ background: 'var(--bg-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '1.5rem', minHeight: '150px' }}>
          <div style={{ color: '#f5a623', marginBottom: '0.6rem' }}>{'★'.repeat(r.rating)}</div>
          <p style={{ fontSize: '0.98rem', lineHeight: 1.6, color: 'var(--ink-soft)', marginBottom: '1rem' }}>&ldquo;{r.text}&rdquo;</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.name}</span>
            <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{r.date}</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', margin: '1.25rem 0' }}>
          {reviews.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} aria-label={`Review ${i + 1}`} style={{ width: i === current ? '26px' : '7px', height: '7px', borderRadius: '4px', background: i === current ? 'var(--ink)' : 'var(--line)', border: 'none', transition: 'all 0.3s ease', padding: 0 }} />
          ))}
        </div>
        <a href="https://share.google/TtmW5AELc7UPOYkIP" target="_blank" rel="noopener noreferrer" className="tp-btn tp-btn-primary" style={{ width: '100%' }}>Leave a review on Google</a>
      </div>
    </div>
  );
}
