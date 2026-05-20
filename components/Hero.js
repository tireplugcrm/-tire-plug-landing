import React, { useEffect, useState } from 'react';

export default function Hero() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBooking = () => {
    const el = document.getElementById('booking');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      id="hero"
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        color: '#fff',
        padding: '8rem 2rem 4rem',
        overflow: 'hidden',
      }}
    >
      {/* CINEMATIC BACKGROUND LAYERS */}
      
      {/* Layer 1: Cinematic Video Background */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          overflow: 'hidden',
          transform: `translateY(${scrollY * 0.3}px) scale(1.1)`,
          transition: 'transform 0.1s ease-out',
        }}
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          poster="/images/shop-exterior.webp"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'grayscale(0.2) contrast(1.1) brightness(0.75) saturate(0.95)',
          }}
        >
          <source src="/videos/hero-bg.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Layer 2: Deep cinematic gradient */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.75) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Layer 3: Red ambient glow (top right) */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: '800px',
          height: '800px',
          background: 'radial-gradient(circle, rgba(255,31,31,0.25) 0%, transparent 60%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
          animation: 'pulse 8s ease-in-out infinite',
        }}
      />

      {/* Layer 4: Red ambient glow (bottom left) */}
      <div
        style={{
          position: 'absolute',
          bottom: '-30%',
          left: '-10%',
          width: '700px',
          height: '700px',
          background: 'radial-gradient(circle, rgba(255,31,31,0.18) 0%, transparent 60%)',
          filter: 'blur(100px)',
          pointerEvents: 'none',
          animation: 'pulse 10s ease-in-out infinite 1s',
        }}
      />

      {/* Layer 5: Subtle scanlines for cinematic feel */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 3px)',
          pointerEvents: 'none',
          mixBlendMode: 'overlay',
        }}
      />

      {/* Layer 6: Vignette */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Animated light streak */}
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: '-100%',
          width: '200%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,31,31,0.6) 50%, transparent 100%)',
          animation: 'streak 6s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* MAIN CONTENT */}
      <div
        style={{
          position: 'relative',
          maxWidth: '1200px',
          width: '100%',
          textAlign: 'center',
          zIndex: 5,
        }}
      >
        {/* Small uppercase tag */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '2rem',
            opacity: 0,
            animation: 'fadeInUp 0.8s ease 0.2s forwards',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '1px',
              background: 'linear-gradient(90deg, transparent, #FF1F1F)',
            }}
          />
          <span
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
            }}
          >
            Los Angeles Automotive Service
          </span>
          <div
            style={{
              width: '40px',
              height: '1px',
              background: 'linear-gradient(90deg, #FF1F1F, transparent)',
            }}
          />
        </div>

        {/* HERO HEADLINE */}
        <h1
          style={{
            fontSize: 'clamp(4rem, 14vw, 11rem)',
            fontWeight: 900,
            lineHeight: 0.95,
            letterSpacing: '-0.05em',
            marginBottom: '2rem',
            opacity: 0,
            animation: 'fadeInUp 1s ease 0.4s forwards',
            textTransform: 'uppercase',
          }}
        >
          <span
            style={{
              display: 'block',
              background: 'linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.85) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 0 60px rgba(255,255,255,0.1)',
            }}
          >
            Done
          </span>
          <span
            style={{
              display: 'block',
              background: 'linear-gradient(180deg, #FF3838 0%, #B30000 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 30px rgba(255,31,31,0.4))',
            }}
          >
            Right.
          </span>
        </h1>

        {/* Supporting line */}
        <p
          style={{
            fontSize: 'clamp(1rem, 1.8vw, 1.25rem)',
            color: 'rgba(255,255,255,0.7)',
            maxWidth: '600px',
            margin: '0 auto 3rem',
            lineHeight: 1.5,
            fontWeight: 400,
            letterSpacing: '0.01em',
            opacity: 0,
            animation: 'fadeInUp 1s ease 0.6s forwards',
          }}
        >
          Tires. Oil. Alignments.<br />
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>
            Fast service without dealership pricing.
          </span>
        </p>

        {/* CTAs */}
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '5rem',
            opacity: 0,
            animation: 'fadeInUp 1s ease 0.8s forwards',
          }}
        >
          <button
            onClick={scrollToBooking}
            className="hero-cta-primary"
            style={{
              background: 'linear-gradient(135deg, #FF1F1F 0%, #B30000 100%)',
              color: '#fff',
              padding: '1.25rem 2.75rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              boxShadow: '0 0 0 1px rgba(255,31,31,0.3), 0 20px 40px rgba(255,31,31,0.25)',
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            Book Service
          </button>

          
            <a href="tel:562-513-0217"
            className="hero-cta-secondary"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              padding: '1.25rem 2.75rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              borderRadius: '4px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              display: 'inline-block',
              textDecoration: 'none',
              transition: 'all 0.3s ease',
            }}
          >
            Call Now
          </a>
        </div>

        {/* Trust strip - performance style */}
        <div
          style={{
            display: 'flex',
            gap: '4rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            paddingTop: '3rem',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            opacity: 0,
            animation: 'fadeInUp 1s ease 1s forwards',
          }}
          className="trust-strip"
        >
          <TrustMetric value="4.9" label="Google Rated" />
          <TrustMetric value="10K+" label="Vehicles Serviced" red />
          <TrustMetric value="2" label="LA Locations" />
          <TrustMetric value="15 Min" label="Oil Change" red />
        </div>
      </div>

      {/* Bottom scroll indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
          opacity: 0,
          animation: 'fadeIn 1s ease 1.5s forwards',
          zIndex: 5,
        }}
      >
        <span
          style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: '0.65rem',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
          }}
        >
          Scroll
        </span>
        <div
          style={{
            width: '1px',
            height: '40px',
            background: 'linear-gradient(180deg, rgba(255,31,31,0.6), transparent)',
            animation: 'scrollLine 2s ease-in-out infinite',
          }}
        />
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes streak {
          0% { left: -100%; opacity: 0; }
          50% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
        @keyframes scrollLine {
          0%, 100% { transform: scaleY(1); opacity: 1; }
          50% { transform: scaleY(0.3); opacity: 0.3; }
        }
        .hero-cta-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 0 1px rgba(255,31,31,0.5), 0 25px 50px rgba(255,31,31,0.4) !important;
        }
        .hero-cta-secondary:hover {
          background: rgba(255,31,31,0.08) !important;
          border-color: rgba(255,31,31,0.4) !important;
        }
        @media (max-width: 768px) {
          .trust-strip { gap: 2rem !important; }
        }
      `}</style>
    </section>
  );
}

function TrustMetric({ value, label, red }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: '1.75rem',
          fontWeight: 800,
          color: red ? '#FF3838' : '#fff',
          letterSpacing: '-0.02em',
          marginBottom: '0.35rem',
          textShadow: red ? '0 0 20px rgba(255,31,31,0.4)' : 'none',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: '0.7rem',
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          fontWeight: 500,
        }}
      >
        {label}
      </div>
    </div>
  );
}