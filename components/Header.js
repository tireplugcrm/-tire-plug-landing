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
      <div style={{ background: 'var(--bg-alt)', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: '0.76rem', fontWeight: 500 }}>
        <div className="tp-wrap" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.25rem', height: '34px', flexWrap: 'wrap', overflow: 'hidden' }}>
          <button onClick={() => setReviewsOpen(true)} style={{ background: 'none', border: 'none', color: 'inherit', fontSize: 'inherit', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ color: '#f5a623' }}>★</span> 5.0 Google
          </button>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>10,000+ vehicles serviced</span>
          <span style={{ opacity: 0.4 }} className="tp-hide-sm">·</span>
          <a href="https://www.instagram.com/tireplugcali" target="_blank" rel="noopener noreferrer" className="tp-hide-sm" style={{ color: 'inherit', fontWeight: 600 }}>130K on Instagram</a>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.82)', backdropFilter: 'saturate(180%) blur(14px)', WebkitBackdropFilter: 'saturate(180%) blur(14px)', borderBottom: '1px solid var(--line)' }}>
        <div className="tp-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '62px' }}>
          {/* Logo */}
          <button onClick={() => go('top')} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'none', border: 'none', padding: 0 }}>
            <img src="/images/logo.webp" alt="The Tire Plug" style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }} />
            <span style={{ fontWeight: 800, fontSize: '1.02rem', letterSpacing: '-0.02em', color: 'var(--ink)' }}>The Tire Plug</span>
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
