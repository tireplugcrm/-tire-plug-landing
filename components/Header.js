import React, { useState, useEffect } from 'react';
import { REVIEWS_FALLBACK } from '../lib/reviews-fallback';

// Shop hours (24h). Keep in sync with pages/olympic.js and components/Locations.js.
const HOURS = { 0: [10, 16], 1: [9, 19], 2: [9, 19], 3: [9, 19], 4: [9, 19], 5: [9, 19], 6: [9, 18] };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmt = (h) => `${h % 12 || 12}${h < 12 ? 'AM' : 'PM'}`;

function shopStatus(now) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const day = DAYS.indexOf(get('weekday'));
  const hour = (Number(get('hour')) % 24) + Number(get('minute')) / 60;
  const [o, c] = HOURS[day];
  if (hour >= o && hour < c) return { open: true, text: `Open now · until ${fmt(c)}` };
  if (hour < o) return { open: false, text: `Closed · opens ${fmt(o)} today` };
  const next = (day + 1) % 7;
  return { open: false, text: `Closed · opens ${DAYS[next]} ${fmt(HOURS[next][0])}` };
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Today's hours + open/closed, in shop time (LA). Computed after load so the
  // server-rendered HTML never disagrees with the visitor's clock.
  const [status, setStatus] = useState({ open: true, text: 'Open 7 days' });
  useEffect(() => {
    const update = () => setStatus(shopStatus(new Date()));
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, []);

  // "My tire size": jump to the size finder (homepage) or the homepage finder from other pages.
  const goToFinder = () => {
    const el = document.getElementById('finder');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => el.querySelector('select, input')?.focus({ preventScroll: true }), 500);
    } else {
      window.location.href = '/#finder';
    }
  };

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <>
      <div className="info-bar">
        <a className="ib-loc" href="/olympic">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#E01B22" aria-hidden="true"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>
          <span className="ib-text">
            <span className="ib-label">My location</span>
            <span className="ib-strong">Downtown LA · Olympic Blvd</span>
            <span className={`ib-hours ${status.open ? 'open' : 'closed'}`}><i />{status.text}</span>
          </span>
        </a>
        <button type="button" className="ib-size" onClick={goToFinder}>
          <svg width="40" height="20" viewBox="0 0 40 20" aria-hidden="true"><path d="M3 14l3-6c1-2 3-3 5-3h12c2 0 4 1 6 3l4 3c2 0 4 1 4 3v2H3z" fill="#111"/><circle cx="11" cy="16" r="3" fill="#111" stroke="#fff" strokeWidth="1.5"/><circle cx="30" cy="16" r="3" fill="#111" stroke="#fff" strokeWidth="1.5"/></svg>
          <span className="ib-text">
            <span className="ib-label">My tire size</span>
            <span className="ib-strong">Select your size ✎</span>
          </span>
        </button>
        <button type="button" className="ib-reviews" onClick={() => setReviewsOpen(true)}>
          <span className="stars">★★★★★</span> 10,000+ vehicles serviced
        </button>
        <a className="ib-call" href="tel:562-500-4625">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#E01B22" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 013 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>
          <span className="ib-num">(562) 500-4625</span>
          <span className="ib-callm">Call</span>
        </a>
      </div>

      <nav className="tp-nav" style={{ background: '#0a0a0a', padding: scrolled ? '0.7rem 2rem' : '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'fixed', left: 0, right: 0, zIndex: 1000, transition: 'all 0.3s ease', borderBottom: '1px solid #222' }}>
        <a href="/" aria-label="The Tire Plug home" className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', transition: 'all 0.3s ease' }}>
          <div className="logo-circle" style={{ width: scrolled ? '50px' : '58px', height: scrolled ? '50px' : '58px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', transition: 'all 0.3s ease', position: 'relative' }}>
            <img src="/images/logo.webp" alt="The Tire Plug" style={{ width: '130%', height: '130%', objectFit: 'cover', objectPosition: 'center' }} />
          </div>
        </a>

        <div className="desktop-nav" style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
          <button onClick={() => scrollToSection('hero')} style={navLinkStyle} className="nav-link">Promos</button>
          <button onClick={() => scrollToSection('booking')} style={navLinkStyle} className="nav-link">Book</button>
          <button onClick={() => scrollToSection('locations')} style={navLinkStyle} className="nav-link">Locations</button>
          <a href="/careers" style={{ ...navLinkStyle, textDecoration: 'none', color: '#FF3838' }} className="nav-link">Careers</a>
          <a href="tel:562-500-4625" className="call-cta" style={{ position: 'relative', background: 'linear-gradient(180deg, #FF2A2A 0%, #C20000 50%, #8B0000 100%)', color: '#fff', fontSize: '0.78rem', fontWeight: 800, padding: '0.85rem 1.75rem', borderRadius: '6px', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', display: 'inline-flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', letterSpacing: '0.2em', textTransform: 'uppercase', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,80,80,0.3), 0 4px 12px rgba(139,0,0,0.5), 0 0 30px rgba(255,42,42,0.25)', textShadow: '0 1px 2px rgba(0,0,0,0.5)', overflow: 'hidden' }}><span style={{ position: 'relative', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>Click to Call</span></a>
        </div>

        <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ display: 'none', background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>{mobileMenuOpen ? '✕' : '☰'}</button>

        {mobileMenuOpen && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'rgba(0,0,0,0.98)', backdropFilter: 'blur(20px)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', borderTop: '1px solid rgba(255,31,31,0.15)' }}>
            <button onClick={() => scrollToSection('hero')} style={mobileNavStyle}>Promos</button>
            <button onClick={() => scrollToSection('booking')} style={mobileNavStyle}>Book Now</button>
            <button onClick={() => scrollToSection('locations')} style={mobileNavStyle}>Locations</button>
            <a href="/careers" style={{ ...mobileNavStyle, textDecoration: 'none', color: '#FF3838' }}>Careers — We're Hiring</a>
            <a href="tel:562-500-4625" style={{ background: 'linear-gradient(135deg, #FF1F1F 0%, #B30000 100%)', color: '#fff', padding: '1rem', borderRadius: '4px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', textDecoration: 'none' }}>📞 Click to Call</a>
          </div>
        )}
      </nav>

      <style jsx>{`
        .info-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 1001; height: 56px; box-sizing: border-box;
          background: #fff; color: #111; border-bottom: 1px solid #e5e5e5; display: flex; align-items: center; justify-content: space-between;
          gap: 1.5rem; padding: 0 2rem; font-family: inherit; }
        .info-bar a, .info-bar button { display: flex; align-items: center; gap: 0.6rem; color: inherit; text-decoration: none; background: none; border: none; padding: 0; font: inherit; cursor: pointer; text-align: left; }
        .ib-text { display: flex; flex-direction: column; line-height: 1.15; }
        .ib-label { font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; color: #6b6b6b; }
        .ib-strong { font-size: 0.9rem; font-weight: 700; color: #111; }
        .ib-hours { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; font-weight: 700; margin-top: 1px; }
        .ib-hours i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
        .ib-hours.open { color: #1a8f3c; }
        .ib-hours.closed { color: #E01B22; }
        .ib-reviews { font-size: 0.78rem; color: #333 !important; }
        .ib-reviews .stars { color: #FFB800; letter-spacing: 1px; }
        .ib-call { font-weight: 800; font-size: 0.95rem; }
        .ib-callm { display: none; }
        .ib-size:hover .ib-strong, .ib-loc:hover .ib-strong, .ib-call:hover .ib-num { color: #E01B22; }
        .tp-nav { top: 56px; }
        @media (max-width: 1100px) { .ib-reviews { display: none !important; } }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
          .info-bar { height: 48px; padding: 0 0.75rem; gap: 0.5rem; }
          .tp-nav { top: 48px; padding: 0.5rem 1rem !important; }
          .tp-nav .logo-circle { width: 44px !important; height: 44px !important; }
          .ib-size, .ib-label { display: none !important; }
          .ib-loc svg { display: none; }
          .ib-loc .ib-text { flex-direction: column-reverse; }
          .ib-strong { font-size: 0.72rem; font-weight: 600; color: #555; }
          .ib-hours { font-size: 0.8rem; margin: 0 0 1px; }
          .ib-num { display: none; }
          .ib-callm { display: inline; }
          .info-bar .ib-call { background: #E01B22; color: #fff !important; border-radius: 50px; padding: 0.5rem 1rem; font-size: 0.85rem; flex-shrink: 0; }
          .ib-call svg { fill: #fff; }
        }
        .logo-container:hover .logo-circle {
                    transform: scale(1.05);
        }
        .ig-link:hover { transform: scale(1.05); }
        .ig-link:hover span { color: #fff !important; }
        .call-cta::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%);
          border-radius: 6px;
          pointer-events: none;
          z-index: 1;
        }
        .call-cta:hover {
          transform: translateY(-1px);
          background: linear-gradient(180deg, #FF3838 0%, #D10000 50%, #9B0000 100%) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,100,100,0.5), 0 6px 20px rgba(139,0,0,0.6), 0 0 50px rgba(255,42,42,0.5) !important;
        }
        .call-cta:active {
          transform: translateY(0);
          background: linear-gradient(180deg, #C20000 0%, #8B0000 50%, #5B0000 100%) !important;
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,80,80,0.3), 0 2px 8px rgba(139,0,0,0.4) !important;
        }
      `}</style>

      <ReviewsModal isOpen={reviewsOpen} onClose={() => setReviewsOpen(false)} />
    </>
  );
}

const navLinkStyle = { background: 'transparent', border: 'none', color: '#fff', fontSize: '0.8rem', fontWeight: 600, transition: 'color 0.3s ease', cursor: 'pointer', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'inherit' };
const mobileNavStyle = { background: 'transparent', border: 'none', color: '#fff', fontSize: '1.1rem', fontWeight: 600, textAlign: 'left', padding: '0.5rem 0', cursor: 'pointer', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'inherit' };

function ReviewsModal({ isOpen, onClose }) {
  const [currentReview, setCurrentReview] = useState(0);
  const [reviews, setReviews] = useState(REVIEWS_FALLBACK);

  // Pull the latest live Google reviews; keep the real fallback if unavailable.
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
    const interval = setInterval(() => setCurrentReview(prev => (prev + 1) % reviews.length), 4500);
    return () => clearInterval(interval);
  }, [isOpen, reviews.length]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const review = reviews[currentReview] || reviews[0];
  if (!review) return null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(15px)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #000 100%)', border: '1px solid rgba(255,31,31,0.3)', borderRadius: '24px', maxWidth: '600px', width: '100%', padding: '3rem 2.5rem', position: 'relative', boxShadow: '0 30px 80px rgba(255,31,31,0.2)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', fontSize: '1rem', cursor: 'pointer' }}>✕</button>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,31,31,0.1)', border: '1px solid rgba(255,31,31,0.3)', padding: '0.4rem 1rem', borderRadius: '50px', marginBottom: '1.25rem' }}>
            <span style={{ color: '#FFB800' }}>★★★★★</span>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>5.0</span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>· Google Verified</span>
          </div>
          <h2 style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>What LA Drivers Say</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>10,000+ vehicles serviced. Real reviews from real customers.</p>
        </div>

        <div key={currentReview} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,31,31,0.15)', borderRadius: '16px', padding: '2rem', marginBottom: '1.5rem', minHeight: '220px', animation: 'slideIn 0.5s ease' }}>
          <div style={{ color: '#FFB800', fontSize: '1.1rem', marginBottom: '1rem', letterSpacing: '0.1em' }}>{'★'.repeat(review.rating)}</div>
          <p style={{ color: '#fff', fontSize: '1rem', lineHeight: 1.6, marginBottom: '1.5rem', fontStyle: 'italic' }}>"{review.text}"</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ color: '#FF3838', fontWeight: 700, fontSize: '0.95rem' }}>{review.name}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>{review.date}</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {reviews.map((_, idx) => (
            <button key={idx} onClick={() => setCurrentReview(idx)} style={{ width: idx === currentReview ? '32px' : '8px', height: '4px', borderRadius: '2px', background: idx === currentReview ? '#FF1F1F' : 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', transition: 'all 0.4s ease', padding: 0 }} />
          ))}
        </div>

        <a href="https://share.google/TtmW5AELc7UPOYkIP" target="_blank" rel="noopener noreferrer" style={{ display: 'block', background: 'linear-gradient(135deg, #FF1F1F 0%, #B30000 100%)', color: '#fff', padding: '1rem', borderRadius: '50px', textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'all 0.3s ease', boxShadow: '0 8px 24px rgba(255,31,31,0.3)' }}>Leave Your Review on Google →</a>
      </div>

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}