import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PHONE, ADDRESS, HOURS_LINES } from '../lib/shop';

export default function Locations() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  const locations = [
    {
      id: 'downtown-la',
      label: 'Downtown LA',
      tag: 'Flagship Location',
      address: ADDRESS.street,
      city: `${ADDRESS.city}, ${ADDRESS.region} ${ADDRESS.zip}`,
      hours: HOURS_LINES[0],
      sundayHours: HOURS_LINES.slice(1).join(' · '),
      photos: [
        { src: '/images/shop/street-front.webp', alt: 'The Tire Plug storefront on E Olympic Blvd', pos: '50% 50%' },
        { src: '/images/shop/entrance-sign.webp', alt: 'The Tire Plug pole sign and yellow entrance', pos: '50% 35%' },
        { src: '/images/shop/street-wide.webp', alt: 'The Tire Plug from down the block on Olympic Blvd', pos: '50% 45%' },
      ],
      directionsUrl: ADDRESS.directions,
      phone: PHONE.plain,
      highlights: ['Full Service', 'Oil Changes', 'Brake Service'],
    },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="locations"
      style={{
        background: '#f5f5f5',
        color: '#111',
        padding: '6rem 2rem',
        position: 'relative',
        overflow: 'hidden',
        borderTop: '1px solid #e6e6e6',
      }}
    >
      {/* Ambient red glows */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '900px',
        height: '600px',
        background: 'radial-gradient(ellipse, rgba(224,27,34,0.04) 0%, transparent 60%)',
        filter: 'blur(120px)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '1300px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ width: '30px', height: '1px', background: 'linear-gradient(90deg, transparent, #E01B22)' }} />
            <span style={{ color: '#E01B22', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
              Our Locations
            </span>
            <div style={{ width: '30px', height: '1px', background: 'linear-gradient(90deg, #E01B22, transparent)' }} />
          </div>
          <h2 style={{
            fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            textTransform: 'uppercase',
            maxWidth: '800px',
            margin: '0 auto',
          }}>
            <span style={{ color: '#111' }}>
              One Location.
            </span>{' '}
            <span style={{ color: '#E01B22' }}>
              One Standard.
            </span>
          </h2>
        </div>

        {/* Location Cards */}
        <div className="locations-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '2rem',
          maxWidth: '880px',
          margin: '0 auto',
        }}>
          {locations.map((loc, idx) => (
            <LocationCard
              key={loc.id}
              location={loc}
              delay={idx * 0.2}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 968px) {
          .locations-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}

// ============ LOCATION CARD ============
function LocationCard({ location, delay, isVisible }) {
  return (
    <div
      className="location-card"
      style={{
        position: 'relative',
        background: '#fff',
        borderRadius: '20px',
        overflow: 'hidden',
        border: '1px solid #e6e6e6',
        boxShadow: '0 6px 18px rgba(0,0,0,0.05)',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 1s ease ${delay}s, transform 1s ease ${delay}s, border-color 0.4s ease, box-shadow 0.4s ease`,
        cursor: 'default',
      }}
    >
      {/* IMAGE SECTION */}
      <div className="loc-photos" style={{
        position: 'relative',
        height: 'clamp(280px, 48vw, 460px)',
        overflow: 'hidden',
      }}>
        <PhotoSlides photos={location.photos} />

        {/* Image gradient overlay */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.7) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Tag badge */}
        <div style={{
          position: 'absolute',
          top: '1.5rem',
          left: '1.5rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(15px)',
          padding: '0.45rem 1rem',
          borderRadius: '50px',
          border: '1px solid rgba(224,27,34,0.5)',
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#E01B22',
            animation: 'livePulse 2s ease-in-out infinite',
          }} />
          <span style={{
            color: '#fff',
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}>
            {location.tag}
          </span>
        </div>

        {/* Location label */}
        <div style={{
          position: 'absolute',
          bottom: '1.5rem',
          left: '1.75rem',
          right: '1.75rem',
        }}>
          <p style={{
            color: '#FF3B42',
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            marginBottom: '0.4rem',
          }}>
            The Tire Plug
          </p>
          <h3 style={{
            fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            textTransform: 'uppercase',
            color: '#fff',
          }}>
            {location.label}
          </h3>
        </div>
      </div>

      {/* CONTENT SECTION */}
      <div style={{
        padding: '2rem 1.75rem',
        position: 'relative',
      }}>
        {/* Address */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(224,27,34,0.08)',
              border: '1px solid rgba(224,27,34,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#E01B22"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{
                color: '#111',
                fontSize: '1rem',
                fontWeight: 700,
                marginBottom: '0.2rem',
                lineHeight: 1.3,
              }}>
                {location.address}
              </p>
              <p style={{
                color: '#6b6b6b',
                fontSize: '0.85rem',
                lineHeight: 1.3,
              }}>
                {location.city}
              </p>
            </div>
          </div>
        </div>

        {/* Hours */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(224,27,34,0.08)',
              border: '1px solid rgba(224,27,34,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.2 14.2L11 13V7h1.5v5.25l4.5 2.67-.8 1.28z" fill="#E01B22"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{
                color: '#111',
                fontSize: '0.9rem',
                fontWeight: 600,
                marginBottom: '0.25rem',
              }}>
                {location.hours}
              </p>
              <p style={{
                color: '#6b6b6b',
                fontSize: '0.8rem',
              }}>
                {location.sundayHours}
              </p>
            </div>
          </div>
        </div>

        {/* Highlights */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '2rem',
          paddingBottom: '1.5rem',
          borderBottom: '1px solid #e6e6e6',
        }}>
          {location.highlights.map((highlight, idx) => (
            <span key={idx} style={{
              background: 'rgba(224,27,34,0.08)',
              border: '1px solid rgba(224,27,34,0.3)',
              color: '#111',
              padding: '0.35rem 0.8rem',
              borderRadius: '50px',
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}>
              ✓ {highlight}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          
            <a href={location.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="loc-cta-primary"
            style={{
              flex: 1,
              position: 'relative',
              background: 'linear-gradient(135deg, #FF1F1F 0%, #B30000 100%)',
              color: '#fff',
              fontSize: '0.78rem',
              fontWeight: 800,
              padding: '0.95rem 1rem',
              border: 'none',
              borderRadius: '6px',
              textDecoration: 'none',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 8px 20px rgba(224,27,34,0.2)',
              overflow: 'hidden',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
              <path d="M21.71 11.29l-9-9c-.39-.39-1.02-.39-1.41 0l-9 9c-.39.39-.39 1.02 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9c.39-.38.39-1.01 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z"/>
            </svg>
            Directions
          </a>
          
            <a href={`tel:${location.phone}`}
            className="loc-cta-secondary"
            style={{
              flex: 1,
              background: '#fff',
              border: '1px solid #dcdcdc',
              color: '#111',
              fontSize: '0.78rem',
              fontWeight: 700,
              padding: '0.95rem 1rem',
              borderRadius: '6px',
              textDecoration: 'none',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.3s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#111">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
            </svg>
            Call Shop
          </a>
        </div>
      </div>

      <style jsx>{`
        .location-card:hover {
          border-color: #E01B22 !important;
          box-shadow: 0 12px 28px rgba(0,0,0,0.08) !important;
        }
        .location-card:hover .card-image {
          transform: scale(1.08);
          filter: brightness(0.9) contrast(1.05) !important;
        }
        .loc-cta-primary:hover {
          transform: translateY(-2px);
          background: linear-gradient(135deg, #FF3B42 0%, #C20000 100%) !important;
          box-shadow: 0 10px 24px rgba(224,27,34,0.25) !important;
        }
        .loc-cta-secondary:hover {
          background: #fff !important;
          border-color: #E01B22 !important;
          transform: translateY(-2px);
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
// ============ PHOTO CAROUSEL ============
// Crossfades through the shop photos; arrows, dots and swipe. Pauses on hover.
function PhotoSlides({ photos }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef(null);
  const go = useCallback((n) => setI((n + photos.length) % photos.length), [photos.length]);

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setTimeout(() => go(i + 1), 4500);
    return () => clearTimeout(t);
  }, [i, paused, go]);

  return (
    <div
      className="ls"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
        touch.current = null;
      }}
      aria-roledescription="carousel"
      aria-label="Photos of the shop"
    >
      {photos.map((p, n) => (
        <img key={p.src} src={p.src} alt={p.alt} className={n === i ? 'on' : ''} style={{ objectPosition: p.pos }}
          loading={n === 0 ? 'eager' : 'lazy'} aria-hidden={n === i ? undefined : 'true'} />
      ))}
      <button type="button" className="ls-arrow l" onClick={() => go(i - 1)} aria-label="Previous photo">‹</button>
      <button type="button" className="ls-arrow r" onClick={() => go(i + 1)} aria-label="Next photo">›</button>
      <div className="ls-dots">
        {photos.map((p, n) => (
          <button key={p.src} type="button" className={n === i ? 'on' : ''} onClick={() => go(n)} aria-label={`Photo ${n + 1} of ${photos.length}`} aria-current={n === i} />
        ))}
      </div>
      <style jsx>{`
        .ls { position: absolute; inset: 0; }
        .ls img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transform: scale(1.04);
          transition: opacity 0.9s ease, transform 6s ease; }
        .ls img.on { opacity: 1; transform: scale(1); }
        .ls-arrow { position: absolute; top: 50%; z-index: 3; transform: translateY(-50%); width: 38px; height: 38px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.35); background: rgba(0,0,0,0.45); color: #fff; font-size: 1.4rem; line-height: 1; cursor: pointer;
          opacity: 0; transition: opacity 0.2s ease, border-color 0.2s ease; }
        .ls-arrow.l { left: 12px; }
        .ls-arrow.r { right: 12px; }
        .ls:hover .ls-arrow, .ls-arrow:focus-visible { opacity: 1; }
        .ls-arrow:hover { border-color: #E01B22; }
        .ls-dots { position: absolute; z-index: 3; right: 1.25rem; bottom: 1.6rem; display: flex; gap: 6px; }
        .ls-dots button { width: 8px; height: 8px; padding: 0; border: none; border-radius: 50px; background: rgba(255,255,255,0.45); cursor: pointer; transition: all 0.3s ease; }
        .ls-dots button.on { width: 22px; background: #E01B22; }
        @media (hover: none) { .ls-arrow { opacity: 1; width: 32px; height: 32px; } }
        @media (max-width: 640px) { .ls-dots { bottom: auto; top: 1.6rem; } }
      `}</style>
    </div>
  );
}
