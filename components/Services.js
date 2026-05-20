import React, { useEffect, useRef, useState } from 'react';

// =====================================================
// MASTER LAYOUT CONSTANTS (single source of truth)
// =====================================================
const LAYOUT = {
  panelHeight: '85vh',
  panelMinHeight: '700px',
  // Asymmetric split — content gets more space, image anchors right
  gridColumns: '1.15fr 0.85fr',
  contentPadding: '5rem 4rem',
  contentMaxWidth: '520px',
  headlineSize: 'clamp(2.5rem, 5vw, 4.25rem)',
  taglineSize: 'clamp(1rem, 1.3vw, 1.1rem)',
  priceSize: 'clamp(1.8rem, 2.8vw, 2.5rem)',
  ctaSize: '0.82rem',
  ctaPadding: '1.1rem 2.5rem',
  imageFilter: 'brightness(0.8) contrast(1.05)',
  imageBlendWidth: '55%',  // Stronger fade-to-black on content side
  redDividerWidth: '60px',
  panelGap: '0',
};

export default function Services() {
  const services = [
    {
      id: 'oil',
      image: '/images/oil-campaign.webp',
      tag: 'Full Synthetic',
      title: 'Oil Change.',
      titleAccent: 'Done Right.',
      tagline: 'Premium oil. Max performance. Fast service.',
      price: 'From $75',
      cta: 'Book Oil Change',
      imageSide: 'right',
      imagePosition: '80% center',
      imageZoom: 1.1,
      imageBrightness: 0.75,
      atmosphere: 'none',
    },
    {
      id: 'tires',
      image: '/images/tires-campaign.webp',
      tag: 'Performance Tires',
      title: 'New Tires.',
      titleAccent: 'Done Right.',
      tagline: 'Top brands. Wholesale pricing. Expert install.',
      price: 'Get Quote',
      cta: 'Shop Tires',
      imageSide: 'left',
      imagePosition: '20% center',
      imageZoom: 1.1,
      imageBrightness: 0.75,
      atmosphere: 'cinematic',
    },
    {
      id: 'alignment',
      image: '/images/alignment-campaign.webp',
      tag: 'Precision Alignment',
      title: 'Alignment.',
      titleAccent: 'Done Right.',
      tagline: 'Straight driving. Longer tire life. Better mileage.',
      price: '$75',
      cta: 'Book Alignment',
      imageSide: 'right',
      imagePosition: '85% center',
      imageZoom: 1.1,
      imageBrightness: 0.78,
      atmosphere: 'none',
    },
    {
      id: 'tpms',
      image: '/images/tpms-campaign.webp',
      tag: 'TPMS Service',
      title: 'That Light?',
      titleAccent: 'Gone.',
      tagline: 'We diagnose. We fix. We turn it off.',
      price: '$199',
      cta: 'Fix My TPMS',
      imageSide: 'left',
      imagePosition: '15% center',
      imageZoom: 0.95,
      imageBrightness: 0.7,
      atmosphere: 'none',
    },
  ];

  const scrollToBooking = () => {
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="services" style={{ background: '#000', position: 'relative', overflow: 'hidden' }}>
      {/* Section intro */}
      <div style={{ padding: '6rem 2rem 3rem', textAlign: 'center', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ width: '30px', height: '1px', background: 'linear-gradient(90deg, transparent, #FF1F1F)' }} />
          <span style={{ color: '#FF3838', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
            Our Services
          </span>
          <div style={{ width: '30px', height: '1px', background: 'linear-gradient(90deg, #FF1F1F, transparent)' }} />
        </div>
        <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.05, maxWidth: '800px', margin: '0 auto', textTransform: 'uppercase' }}>
          Performance Service.<br />
          <span style={{ background: 'linear-gradient(180deg, #FF3838 0%, #B30000 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', filter: 'drop-shadow(0 0 20px rgba(255,31,31,0.3))' }}>
            Honest Pricing.
          </span>
        </h2>
      </div>

      {/* Campaign Panels */}
      {services.map((service) => (
        <ServicePanel key={service.id} service={service} onCTA={scrollToBooking} />
      ))}
    </section>
  );
}

// =====================================================
// MASTER SERVICE PANEL (reusable, fully standardized)
// =====================================================
function ServicePanel({ service, onCTA }) {
  const [isVisible, setIsVisible] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.15 }
    );
    if (panelRef.current) observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, []);

  const isImageLeft = service.imageSide === 'left';

  return (
    <div
      ref={panelRef}
      className="service-panel"
      style={{
        position: 'relative',
        height: LAYOUT.panelHeight,
        minHeight: LAYOUT.panelMinHeight,
        display: 'grid',
        gridTemplateColumns: LAYOUT.gridColumns,
        gap: LAYOUT.panelGap,
        background: '#000',
        overflow: 'hidden',
        borderTop: '1px solid rgba(255,31,31,0.08)',
      }}
    >
      {/* Ambient red glow (consistent position) */}
      <div style={{
        position: 'absolute',
        top: '50%',
        [isImageLeft ? 'right' : 'left']: '-8%',
        transform: 'translateY(-50%)',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(255,31,31,0.1) 0%, transparent 60%)',
        filter: 'blur(80px)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* ============ IMAGE SIDE ============ */}
      <div
        className="panel-image"
        style={{
          position: 'relative',
          height: '100%',
          overflow: 'hidden',
          order: isImageLeft ? 1 : 2,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateX(0)' : `translateX(${isImageLeft ? '-30px' : '30px'})`,
          transition: 'opacity 1.2s ease, transform 1.2s ease',
        }}
      >
        <div
          className="image-wrapper"
          style={{
            width: '100%',
            height: '100%',
            backgroundImage: `url(${service.image})`,
            backgroundSize: `${service.imageZoom * 100}%`,
            backgroundPosition: service.imagePosition,
            backgroundRepeat: 'no-repeat',
            filter: `brightness(${service.imageBrightness}) contrast(1.05)`,
            transition: 'transform 8s ease-out',
          }}
        />

        {/* Cinematic atmosphere layers (only for panels that need it) */}
        {service.atmosphere === 'cinematic' && (
          <>
            {/* Floor reflection gradient */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '40%',
              background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.8) 100%)',
              pointerEvents: 'none',
              zIndex: 2,
            }} />

            {/* Red rim lighting glow */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '70%',
              height: '70%',
              background: 'radial-gradient(ellipse, rgba(255,31,31,0.15) 0%, transparent 70%)',
              filter: 'blur(60px)',
              pointerEvents: 'none',
              zIndex: 2,
              animation: 'rimPulse 6s ease-in-out infinite',
            }} />

            {/* Smoke/fog overlay - bottom */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '50%',
              background: 'radial-gradient(ellipse at center bottom, rgba(40,20,20,0.4) 0%, transparent 70%)',
              pointerEvents: 'none',
              zIndex: 2,
              animation: 'smokeMove 12s ease-in-out infinite alternate',
            }} />

            {/* Dust/particle haze */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(ellipse at 30% 70%, rgba(255,31,31,0.05) 0%, transparent 50%)',
              pointerEvents: 'none',
              zIndex: 2,
            }} />

            {/* Subtle vignette */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)',
              pointerEvents: 'none',
              zIndex: 2,
            }} />
          </>
        )}
        {/* Edge blend gradient (multi-stop cinematic fade) */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: isImageLeft
            ? 'linear-gradient(90deg, transparent 0%, transparent 25%, rgba(0,0,0,0.4) 55%, rgba(0,0,0,0.85) 80%, #000 100%)'
            : 'linear-gradient(90deg, #000 0%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.4) 45%, transparent 75%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 3,
        }} />
      </div>

      {/* ============ CONTENT SIDE ============ */}
      <div
        className="panel-content"
        style={{
          padding: LAYOUT.contentPadding,
          position: 'relative',
          zIndex: 3,
          order: isImageLeft ? 2 : 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateX(0)' : `translateX(${isImageLeft ? '30px' : '-30px'})`,
          transition: 'opacity 1.2s ease 0.2s, transform 1.2s ease 0.2s',
        }}
      >
        <div style={{ maxWidth: LAYOUT.contentMaxWidth }}>
          {/* Tag */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
            <div style={{ width: '20px', height: '1px', background: '#FF1F1F' }} />
            <span style={{ color: '#FF3838', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
              {service.tag}
            </span>
          </div>

          {/* Headline */}
          <h3 style={{
            fontSize: LAYOUT.headlineSize,
            fontWeight: 900,
            lineHeight: 0.95,
            letterSpacing: '-0.04em',
            textTransform: 'uppercase',
            marginBottom: '1.5rem',
          }}>
            <span style={{ display: 'block', background: 'linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.85) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {service.title}
            </span>
            <span style={{ display: 'block', background: 'linear-gradient(180deg, #FF3838 0%, #B30000 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', filter: 'drop-shadow(0 0 25px rgba(255,31,31,0.4))' }}>
              {service.titleAccent}
            </span>
          </h3>

          {/* Tagline */}
          <p style={{
            fontSize: LAYOUT.taglineSize,
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.5,
            marginBottom: '2.25rem',
            fontWeight: 400,
          }}>
            {service.tagline}
          </p>

          {/* Red divider */}
          <div style={{
            width: LAYOUT.redDividerWidth,
            height: '2px',
            background: 'linear-gradient(90deg, #FF1F1F, transparent)',
            marginBottom: '1.5rem',
          }} />

          {/* Price */}
          <div style={{ marginBottom: '2.25rem' }}>
            <p style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.65rem',
              fontWeight: 600,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              marginBottom: '0.4rem',
            }}>
              Starting At
            </p>
            <p style={{
              fontSize: LAYOUT.priceSize,
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}>
              {service.price}
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={onCTA}
            className="service-cta"
            style={{
              position: 'relative',
              background: 'linear-gradient(180deg, #FF2A2A 0%, #C20000 50%, #8B0000 100%)',
              color: '#fff',
              fontSize: LAYOUT.ctaSize,
              fontWeight: 800,
              padding: LAYOUT.ctaPadding,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,80,80,0.3), 0 8px 24px rgba(139,0,0,0.5), 0 0 40px rgba(255,42,42,0.2)',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              fontFamily: 'inherit',
              alignSelf: 'flex-start',
            }}
          >
            {service.cta}
            <span style={{ fontSize: '1.1rem' }}>→</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        .service-panel:hover .image-wrapper {
          transform: scale(1.04);
        }
        .service-cta {
          position: relative;
          overflow: hidden;
        }
        .service-cta::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%);
          transition: left 0.7s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: none;
          z-index: 1;
        }
        .service-cta:hover::before {
          left: 100%;
        }
        .service-cta:hover {
          transform: translateY(-3px) scale(1.02);
          background: linear-gradient(180deg, #FF3838 0%, #D10000 50%, #9B0000 100%) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,100,100,0.6), 0 16px 40px rgba(139,0,0,0.7), 0 0 80px rgba(255,42,42,0.6) !important;
          letter-spacing: 0.22em !important;
        }
        .service-cta:active {
          transform: translateY(-1px) scale(1);
          transition: all 0.1s ease;
        }
        .service-cta > * {
          position: relative;
          z-index: 2;
        }
        @keyframes rimPulse {
          0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
        }
        @keyframes smokeMove {
          0% { transform: translateX(-3%); opacity: 0.7; }
          100% { transform: translateX(3%); opacity: 1; }
        }
        @media (max-width: 968px) {
          .service-panel {
            grid-template-columns: 1fr !important;
            height: auto !important;
            min-height: auto !important;
          }
          .panel-image {
            min-height: 50vh !important;
            order: 1 !important;
          }
          .panel-content {
            order: 2 !important;
            padding: 3rem 2rem !important;
          }
        }
      `}</style>
    </div>
  );
}