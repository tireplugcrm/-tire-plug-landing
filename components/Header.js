import React, { useState, useEffect } from 'react';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <>
      <div className="trust-bar" style={{ background: '#000', borderBottom: '1px solid rgba(255,31,31,0.15)', padding: '0.5rem 2rem', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1001, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2.5rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)', flexWrap: 'wrap', letterSpacing: '0.05em' }}>
        <a href="https://www.instagram.com/tireplugcali" target="_blank" rel="noopener noreferrer" className="ig-link" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit', transition: 'all 0.2s ease', cursor: 'pointer' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" fill="#FF3838"/>
          </svg>
          <span style={{ color: '#FF3838', fontWeight: 700 }}>130K</span>
          <span>Followers</span>
        </a>
        <a href="https://www.instagram.com/reel/DI7h0yKTxX5/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==" target="_blank" rel="noopener noreferrer" className="ig-link" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit', transition: 'all 0.2s ease', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <path d="M8 5v14l11-7z" fill="#FF3838"/>
          </svg>
          <span>Watch our</span>
          <span style={{ color: '#FF3838', fontWeight: 700 }}>3.4M view</span>
          <span>video</span>
        </a>
        <button onClick={() => setReviewsOpen(true)} className="ig-link" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit', letterSpacing: 'inherit', padding: 0, transition: 'all 0.2s ease' }}>
          <span style={{ color: '#FFB800', fontSize: '0.85rem', flexShrink: 0 }}>★★★★★</span>
          <span style={{ color: '#FF3838', fontWeight: 700 }}>10,000+</span>
          <span>Vehicles Serviced</span>
        </button>
      </div>

      <nav style={{ background: scrolled ? 'rgba(0,0,0,0.95)' : 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', padding: scrolled ? '0.7rem 2rem' : '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'fixed', top: '38px', left: 0, right: 0, zIndex: 1000, transition: 'all 0.3s ease', borderBottom: scrolled ? '1px solid rgba(255,31,31,0.15)' : 'none' }}>
        <div onClick={() => scrollToSection('hero')} className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', transition: 'all 0.3s ease' }}>
          <div className="logo-circle" style={{ width: scrolled ? '50px' : '58px', height: scrolled ? '50px' : '58px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 0 0 2px rgba(255,31,31,0.3), 0 0 20px rgba(255,31,31,0.2)', transition: 'all 0.3s ease', position: 'relative' }}>
            <img src="/images/logo.webp" alt="The Tire Plug" style={{ width: '130%', height: '130%', objectFit: 'cover', objectPosition: 'center' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{ color: '#fff', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.3em', textTransform: 'uppercase', opacity: 0.7, marginBottom: '0.2rem' }}>The</span>
            <span style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Tire <span style={{ color: '#FF1F1F' }}>Plug</span></span>
          </div>
        </div>

        <div className="desktop-nav" style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
          <button onClick={() => scrollToSection('services')} style={navLinkStyle} className="nav-link">Services</button>
          <button onClick={() => scrollToSection('promos')} style={navLinkStyle} className="nav-link">Promos</button>
          <button onClick={() => scrollToSection('booking')} style={navLinkStyle} className="nav-link">Book</button>
          <button onClick={() => scrollToSection('locations')} style={navLinkStyle} className="nav-link">Locations</button>
          <a href="tel:562-513-0217" className="call-cta" style={{ position: 'relative', background: 'linear-gradient(180deg, #FF2A2A 0%, #C20000 50%, #8B0000 100%)', color: '#fff', fontSize: '0.78rem', fontWeight: 800, padding: '0.85rem 1.75rem', borderRadius: '6px', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', display: 'inline-flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', letterSpacing: '0.2em', textTransform: 'uppercase', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,80,80,0.3), 0 4px 12px rgba(139,0,0,0.5), 0 0 30px rgba(255,42,42,0.25)', textShadow: '0 1px 2px rgba(0,0,0,0.5)', overflow: 'hidden' }}><span style={{ position: 'relative', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>Click to Call</span></a>
        </div>

        <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ display: 'none', background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>{mobileMenuOpen ? '✕' : '☰'}</button>

        {mobileMenuOpen && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'rgba(0,0,0,0.98)', backdropFilter: 'blur(20px)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', borderTop: '1px solid rgba(255,31,31,0.15)' }}>
            <button onClick={() => scrollToSection('services')} style={mobileNavStyle}>Services</button>
            <button onClick={() => scrollToSection('promos')} style={mobileNavStyle}>Promos</button>
            <button onClick={() => scrollToSection('booking')} style={mobileNavStyle}>Book Now</button>
            <button onClick={() => scrollToSection('locations')} style={mobileNavStyle}>Locations</button>
            <a href="tel:562-513-0217" style={{ background: 'linear-gradient(135deg, #FF1F1F 0%, #B30000 100%)', color: '#fff', padding: '1rem', borderRadius: '4px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', textDecoration: 'none' }}>📞 Click to Call</a>
          </div>
        )}
      </nav>

      <style jsx>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
          .trust-bar { font-size: 0.65rem !important; gap: 0.8rem !important; padding: 0.4rem 1rem !important; }
        }
        .logo-container:hover .logo-circle {
          box-shadow: 0 0 0 2px rgba(255,31,31,0.6), 0 0 30px rgba(255,31,31,0.4) !important;
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

  const reviews = [
    { name: 'Marcus T.', rating: 5, date: '2 weeks ago', text: 'One of the best service experiences I\'ve had. In and out in 15 minutes for an oil change. The team is professional and pricing is honest.' },
    { name: 'Sarah K.', rating: 5, date: '1 month ago', text: 'Came in for new tires and they gave me three options at different price points. No pressure, no upsell. Refreshing experience.' },
    { name: 'David L.', rating: 5, date: '3 weeks ago', text: 'Best tire shop in LA hands down. Got 4 new tires plus alignment and they had me back on the road in under an hour. Great prices too.' },
    { name: 'Maria R.', rating: 5, date: '1 week ago', text: 'I follow them on Instagram and finally came in. They lived up to the hype. Honest, fast, and the shop is clean. New regular customer.' },
    { name: 'Carlos M.', rating: 5, date: '2 months ago', text: 'My TPMS light was on for months. Other shops quoted me $400+. The Tire Plug fixed it for $199 and explained everything. Real ones.' },
    { name: 'Jessica P.', rating: 5, date: '5 days ago', text: 'Got my alignment done here after dealership tried charging me $250. They did it for $75 and it drives perfect now. Highly recommend.' },
  ];

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
  const review = reviews[currentReview];

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(15px)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #000 100%)', border: '1px solid rgba(255,31,31,0.3)', borderRadius: '24px', maxWidth: '600px', width: '100%', padding: '3rem 2.5rem', position: 'relative', boxShadow: '0 30px 80px rgba(255,31,31,0.2)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', fontSize: '1rem', cursor: 'pointer' }}>✕</button>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,31,31,0.1)', border: '1px solid rgba(255,31,31,0.3)', padding: '0.4rem 1rem', borderRadius: '50px', marginBottom: '1.25rem' }}>
            <span style={{ color: '#FFB800' }}>★★★★★</span>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>4.9</span>
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