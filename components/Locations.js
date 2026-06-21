import React, { useEffect, useRef, useState } from 'react';

export default function Locations() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  const locations = [
    {
      id: 'downtown-la',
      label: 'Downtown LA',
      tag: 'Flagship Location',
      address: '2331 E Olympic Blvd',
      city: 'Los Angeles, CA 90021',
      hours: 'Mon - Fri · 9AM - 7PM',
      sundayHours: 'Sat 9AM - 6PM · Sun 9AM - 4PM',
      image: '/images/shop-exterior.webp',
      directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=2331+E+Olympic+Blvd+Los+Angeles+CA+90021',
      phone: '562-513-0217',
      highlights: ['Full Service', 'Oil Changes', 'Brake Service'],
    },
    {
      id: 'south-la',
      label: 'South LA',
      tag: 'Express Location',
      address: '2220 E Manchester Ave',
      city: 'Los Angeles, CA 90001',
      hours: 'Mon - Sat · 9AM - 6PM',
      sundayHours: 'Sun · 10AM - 4PM',
      image: '/images/shop-south-la.webp',
      directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=2220+E+Manchester+Ave+Los+Angeles+CA+90001',
      phone: '562-513-0217',
      highlights: ['Walk-Ins Welcome', 'Quick Service', '7 Days a Week'],
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
        background: '#000',
        padding: '6rem 2rem',
        position: 'relative',
        overflow: 'hidden',
        borderTop: '1px solid rgba(255,31,31,0.08)',
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
        background: 'radial-gradient(ellipse, rgba(255,31,31,0.08) 0%, transparent 60%)',
        filter: 'blur(120px)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '1300px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ width: '30px', height: '1px', background: 'linear-gradient(90deg, transparent, #FF1F1F)' }} />
            <span style={{ color: '#FF3838', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
              Our Locations
            </span>
            <div style={{ width: '30px', height: '1px', background: 'linear-gradient(90deg, #FF1F1F, transparent)' }} />
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
            <span style={{ background: 'linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.85) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Two Locations.
            </span>{' '}
            <span style={{ background: 'linear-gradient(180deg, #FF3838 0%, #B30000 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', filter: 'drop-shadow(0 0 25px rgba(255,31,31,0.4))' }}>
              One Standard.
            </span>
          </h2>
        </div>

        {/* Location Cards */}
        <div className="locations-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '2rem',
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
        background: '#0a0a0a',
        borderRadius: '20px',
        overflow: 'hidden',
        border: '1px solid rgba(255,31,31,0.15)',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 1s ease ${delay}s, transform 1s ease ${delay}s, border-color 0.4s ease, box-shadow 0.4s ease`,
        cursor: 'default',
      }}
    >
      {/* IMAGE SECTION */}
      <div style={{
        position: 'relative',
        height: '280px',
        overflow: 'hidden',
      }}>
        <div
          className="card-image"
          style={{
            width: '100%',
            height: '100%',
            backgroundImage: `url(${location.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.6) contrast(1.1) saturate(0.9)',
            transition: 'transform 6s ease, filter 0.6s ease',
          }}
        />

        {/* Image gradient overlay */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.5) 60%, #0a0a0a 100%)',
          pointerEvents: 'none',
        }} />

        {/* Red ambient corner glow */}
        <div style={{
          position: 'absolute',
          top: '-30%',
          right: '-20%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(255,31,31,0.25) 0%, transparent 60%)',
          filter: 'blur(60px)',
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
          border: '1px solid rgba(255,31,31,0.4)',
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#FF1F1F',
            boxShadow: '0 0 8px #FF1F1F',
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
            color: '#FF3838',
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
            textShadow: '0 4px 20px rgba(0,0,0,0.6)',
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
              background: 'rgba(255,31,31,0.08)',
              border: '1px solid rgba(255,31,31,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#FF3838"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 700,
                marginBottom: '0.2rem',
                lineHeight: 1.3,
              }}>
                {location.address}
              </p>
              <p style={{
                color: 'rgba(255,255,255,0.5)',
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
              background: 'rgba(255,31,31,0.08)',
              border: '1px solid rgba(255,31,31,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.2 14.2L11 13V7h1.5v5.25l4.5 2.67-.8 1.28z" fill="#FF3838"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: 600,
                marginBottom: '0.25rem',
              }}>
                {location.hours}
              </p>
              <p style={{
                color: 'rgba(255,255,255,0.5)',
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
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {location.highlights.map((highlight, idx) => (
            <span key={idx} style={{
              background: 'rgba(255,31,31,0.06)',
              border: '1px solid rgba(255,31,31,0.15)',
              color: 'rgba(255,255,255,0.75)',
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
              background: 'linear-gradient(180deg, #FF2A2A 0%, #C20000 50%, #8B0000 100%)',
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
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,80,80,0.3), 0 6px 16px rgba(139,0,0,0.4), 0 0 30px rgba(255,42,42,0.2)',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
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
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
            </svg>
            Call Shop
          </a>
        </div>
      </div>

      <style jsx>{`
        .location-card:hover {
          border-color: rgba(255,31,31,0.4) !important;
          box-shadow: 0 30px 60px rgba(0,0,0,0.5), 0 0 80px rgba(255,31,31,0.15);
        }
        .location-card:hover .card-image {
          transform: scale(1.08);
          filter: brightness(0.7) contrast(1.15) saturate(1) !important;
        }
        .loc-cta-primary:hover {
          transform: translateY(-2px);
          background: linear-gradient(180deg, #FF3838 0%, #D10000 50%, #9B0000 100%) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,100,100,0.5), 0 10px 24px rgba(139,0,0,0.5), 0 0 50px rgba(255,42,42,0.4) !important;
        }
        .loc-cta-secondary:hover {
          background: rgba(255,31,31,0.08) !important;
          border-color: rgba(255,31,31,0.4) !important;
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