import React, { useEffect, useRef, useState } from 'react';
import { REVIEWS_FALLBACK } from '../lib/reviews-fallback';

export default function Reviews() {
  const [isVisible, setIsVisible] = useState(false);
  const [reviews, setReviews] = useState(REVIEWS_FALLBACK);
  const sectionRef = useRef(null);

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
      id="reviews"
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
        top: '10%',
        left: '-15%',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(255,31,31,0.1) 0%, transparent 60%)',
        filter: 'blur(100px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '5%',
        right: '-10%',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(255,31,31,0.08) 0%, transparent 60%)',
        filter: 'blur(100px)',
        pointerEvents: 'none',
      }} />

      <div
        style={{
          maxWidth: '1300px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 2,
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr',
          gap: '5rem',
          alignItems: 'center',
        }}
        className="reviews-grid"
      >
        {/* ============ LEFT: SOCIAL PROOF WALL ============ */}
        <div
          className="proof-side"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateX(0)' : 'translateX(-30px)',
            transition: 'opacity 1s ease, transform 1s ease',
          }}
        >
          {/* Tag */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
            <div style={{ width: '20px', height: '1px', background: '#FF1F1F' }} />
            <span style={{ color: '#FF3838', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
              Social Proof
            </span>
          </div>

          {/* Headline */}
          <h2 style={{
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            fontWeight: 900,
            lineHeight: 0.95,
            letterSpacing: '-0.04em',
            textTransform: 'uppercase',
            marginBottom: '2rem',
          }}>
            <span style={{ display: 'block', background: 'linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.85) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Trusted By
            </span>
            <span style={{ display: 'block', background: 'linear-gradient(180deg, #FF3838 0%, #B30000 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', filter: 'drop-shadow(0 0 25px rgba(255,31,31,0.4))' }}>
              LA Drivers.
            </span>
          </h2>

          {/* Subline */}
          <p style={{
            fontSize: '1.05rem',
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.6,
            marginBottom: '2.5rem',
            maxWidth: '420px',
          }}>
            Real reviews. Real drivers. Real results across thousands of vehicles serviced in 2025.
          </p>

          {/* Red divider */}
          <div style={{
            width: '60px',
            height: '2px',
            background: 'linear-gradient(90deg, #FF1F1F, transparent)',
            marginBottom: '2.5rem',
          }} />

          {/* Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.5rem',
            maxWidth: '420px',
          }}>
            <StatBlock value="5.0" label="Google Rating" icon="★" iconColor="#FFB800" />
            <StatBlock value="10K+" label="Vehicles Serviced" red />
            <StatBlock value="130K" label="Instagram Followers" />
            <StatBlock value="5M+" label="Total Views" red />
          </div>
        </div>

        {/* ============ RIGHT: REVIEW CARDS ============ */}
        <div
          className="cards-side"
          style={{
            position: 'relative',
            height: '600px',
            overflow: 'hidden',
            maskImage: 'linear-gradient(180deg, transparent 0%, #000 10%, #000 90%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 10%, #000 90%, transparent 100%)',
          }}
        >
          <div className="scroll-track" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            animation: 'scrollReviews 40s linear infinite',
          }}>
            {[...reviews, ...reviews].map((review, idx) => (
              <ReviewCard key={idx} review={review} />
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scrollReviews {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .scroll-track:hover {
          animation-play-state: paused;
        }
        @media (max-width: 968px) {
          .reviews-grid {
            grid-template-columns: 1fr !important;
            gap: 3rem !important;
          }
          .cards-side {
            height: 500px !important;
          }
        }
      `}</style>
    </section>
  );
}

// ============ STAT BLOCK ============
function StatBlock({ value, label, red, icon, iconColor }) {
  return (
    <div style={{
      padding: '1.25rem 0',
      borderTop: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '0.5rem',
        marginBottom: '0.35rem',
      }}>
        {icon && (
          <span style={{ color: iconColor, fontSize: '1.3rem', lineHeight: 1 }}>
            {icon}
          </span>
        )}
        <span style={{
          fontSize: '2rem',
          fontWeight: 800,
          color: red ? '#FF3838' : '#fff',
          letterSpacing: '-0.03em',
          textShadow: red ? '0 0 20px rgba(255,31,31,0.3)' : 'none',
          lineHeight: 1,
        }}>
          {value}
        </span>
      </div>
      <span style={{
        fontSize: '0.7rem',
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        fontWeight: 500,
      }}>
        {label}
      </span>
    </div>
  );
}

// ============ REVIEW CARD ============
function ReviewCard({ review }) {
  return (
    <div
      className="review-card"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,31,31,0.02) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,31,31,0.12)',
        borderRadius: '14px',
        padding: '1.5rem',
        transition: 'all 0.4s ease',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle red glow on hover (controlled by CSS) */}
      <div className="card-glow" style={{
        position: 'absolute',
        top: '-50%',
        right: '-30%',
        width: '200px',
        height: '200px',
        background: 'radial-gradient(circle, rgba(255,31,31,0.15) 0%, transparent 70%)',
        filter: 'blur(40px)',
        opacity: 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: 'none',
      }} />

      {/* Header: Avatar + Name + Date */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.85rem',
        position: 'relative',
        zIndex: 2,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #FF1F1F 0%, #8B0000 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: '0.95rem',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 0 15px rgba(255,31,31,0.3)',
          }}>
            {review.initial}
          </div>
          <div>
            <div style={{
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 700,
              marginBottom: '0.15rem',
            }}>
              {review.name}
            </div>
            <div style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.7rem',
              letterSpacing: '0.05em',
            }}>
              {review.date}
            </div>
          </div>
        </div>

        {/* Google icon */}
        <div style={{
          width: '20px',
          height: '20px',
          opacity: 0.6,
        }}>
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        </div>
      </div>

      {/* Stars + Highlight Tag */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.85rem',
        position: 'relative',
        zIndex: 2,
      }}>
        <div style={{
          color: '#FFB800',
          fontSize: '0.85rem',
          letterSpacing: '0.1em',
        }}>
          {'★'.repeat(review.rating)}
        </div>
        {review.highlight && (
          <div style={{
            background: 'rgba(255,31,31,0.1)',
            border: '1px solid rgba(255,31,31,0.25)',
            color: '#FF3838',
            padding: '0.2rem 0.65rem',
            borderRadius: '50px',
            fontSize: '0.6rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            {review.highlight}
          </div>
        )}
      </div>

      {/* Review Text */}
      <p style={{
        color: 'rgba(255,255,255,0.85)',
        fontSize: '0.9rem',
        lineHeight: 1.5,
        position: 'relative',
        zIndex: 2,
        fontStyle: 'italic',
      }}>
        "{review.text}"
      </p>

      <style jsx>{`
        .review-card:hover {
          border-color: rgba(255,31,31,0.35) !important;
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(255,31,31,0.15);
        }
        .review-card:hover .card-glow {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}