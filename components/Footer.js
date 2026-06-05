import React from 'react';

export default function Footer() {
  const scrollToBooking = () => {
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      {/* ===================== FINAL CTA BANNER ===================== */}
      <section style={{
        background: '#000',
        padding: '6rem 2rem',
        position: 'relative',
        overflow: 'hidden',
        borderTop: '1px solid rgba(255,31,31,0.15)',
      }}>
        {/* Cinematic background atmosphere */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: 'url(/images/shop-exterior.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(0.2) contrast(1.2) saturate(0.6) blur(6px)',
          opacity: 0.4,
          pointerEvents: 'none',
        }} />

        {/* Dark gradient overlay */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0.95) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Red ambient glows */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '900px',
          height: '500px',
          background: 'radial-gradient(ellipse, rgba(255,31,31,0.15) 0%, transparent 60%)',
          filter: 'blur(120px)',
          pointerEvents: 'none',
        }} />

        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          textAlign: 'center',
          position: 'relative',
          zIndex: 2,
        }}>
          {/* Cinematic tag */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ width: '40px', height: '1px', background: 'linear-gradient(90deg, transparent, #FF1F1F)' }} />
            <span style={{ color: '#FF3838', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.35em', textTransform: 'uppercase' }}>
              Final Call
            </span>
            <div style={{ width: '40px', height: '1px', background: 'linear-gradient(90deg, #FF1F1F, transparent)' }} />
          </div>

          {/* Massive headline */}
          <h2 style={{
            fontSize: 'clamp(3rem, 7vw, 6rem)',
            fontWeight: 900,
            lineHeight: 0.95,
            letterSpacing: '-0.04em',
            textTransform: 'uppercase',
            marginBottom: '1.5rem',
          }}>
            <span style={{
              display: 'block',
              background: 'linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.85) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Ready to
            </span>
            <span style={{
              display: 'block',
              background: 'linear-gradient(180deg, #FF3838 0%, #B30000 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 35px rgba(255,31,31,0.5))',
            }}>
              Drive?
            </span>
          </h2>

          <p style={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: 'clamp(1rem, 1.5vw, 1.2rem)',
            marginBottom: '3rem',
            maxWidth: '500px',
            margin: '0 auto 3rem',
            letterSpacing: '0.02em',
          }}>
            Call now or book online today.
          </p>

          {/* Dual CTAs */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            
              <a href="tel:562-513-0217"
              className="cta-primary"
              style={{
                position: 'relative',
                background: 'linear-gradient(180deg, #FF2A2A 0%, #C20000 50%, #8B0000 100%)',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 800,
                padding: '1.25rem 2.75rem',
                border: 'none',
                borderRadius: '6px',
                textDecoration: 'none',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,80,80,0.3), 0 12px 32px rgba(139,0,0,0.5), 0 0 60px rgba(255,42,42,0.3)',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                overflow: 'hidden',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
                <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
              </svg>
              Call Shop
            </a>
            <button
              onClick={scrollToBooking}
              className="cta-secondary"
              style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 700,
                padding: '1.25rem 2.75rem',
                borderRadius: '6px',
                cursor: 'pointer',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                transition: 'all 0.3s ease',
                fontFamily: 'inherit',
              }}
            >
              Book Service
              <span style={{ fontSize: '1.1rem' }}>→</span>
            </button>
          </div>
          <p style={{ marginTop: '2rem', color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', letterSpacing: '0.05em' }}>
            Our Los Angeles tire shops:{' '}
            <a href="/olympic" style={{ color: '#FF6666', textDecoration: 'none', fontWeight: 700 }}>Downtown · Olympic Blvd</a>
            {' '}·{' '}
            <a href="/manchester" style={{ color: '#FF6666', textDecoration: 'none', fontWeight: 700 }}>South LA · Manchester Ave</a>
          </p>
          <p style={{ marginTop: '0.75rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', letterSpacing: '0.04em', lineHeight: 1.8 }}>
            <a href="/new-tires-los-angeles" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>New Tires</a>{' · '}
            <a href="/used-tires-los-angeles" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Used Tires</a>{' · '}
            <a href="/wheel-alignment-los-angeles" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Wheel Alignment</a>{' · '}
            <a href="/oil-change-los-angeles" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Oil Change</a>{' · '}
            <a href="/tpms-sensors-los-angeles" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>TPMS Sensors</a>{' · '}
            <a href="/brake-service-los-angeles" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Brakes</a>{' · '}
            <a href="/tire-shop-near-me-faq" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Tire FAQ</a>
          </p>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer style={{
        background: 'linear-gradient(180deg, #000 0%, #0a0606 100%)',
        padding: '5rem 2rem 2rem',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        borderTop: '1px solid rgba(255,31,31,0.2)',
      }}>
        {/* Subtle red ambient bloom */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '300px',
          background: 'radial-gradient(ellipse, rgba(255,31,31,0.08) 0%, transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: '1300px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
          {/* TOP SECTION: Logo + Identity */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.3fr 1fr 1fr',
            gap: '4rem',
            marginBottom: '3.5rem',
          }} className="footer-grid">
            {/* LEFT: Logo + Identity */}
            <div>
              {/* Circular logo + text */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '50%',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  boxShadow: '0 0 0 2px rgba(255,31,31,0.4), 0 0 30px rgba(255,31,31,0.3)',
                  flexShrink: 0,
                }}>
                  <img
                    src="/images/logo.webp"
                    alt="The Tire Plug"
                    style={{ width: '130%', height: '130%', objectFit: 'cover', objectPosition: 'center' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                  <span style={{
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    marginBottom: '0.3rem',
                  }}>
                    The
                  </span>
                  <span style={{
                    color: '#fff',
                    fontSize: '1.4rem',
                    fontWeight: 900,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}>
                    Tire <span style={{ color: '#FF1F1F' }}>Plug</span>
                  </span>
                </div>
              </div>

              {/* Service line */}
              <p style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: '0.85rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                marginBottom: '0.5rem',
              }}>
                Tires <span style={{ color: '#FF1F1F' }}>•</span> Alignments <span style={{ color: '#FF1F1F' }}>•</span> Oil <span style={{ color: '#FF1F1F' }}>•</span> TPMS
              </p>
              <p style={{
                fontSize: '0.95rem',
                color: 'rgba(255,255,255,0.5)',
                fontStyle: 'italic',
                letterSpacing: '0.02em',
              }}>
                Done right.
              </p>

              {/* Red divider */}
              <div style={{
                width: '60px',
                height: '2px',
                background: 'linear-gradient(90deg, #FF1F1F, transparent)',
                marginTop: '1.5rem',
                marginBottom: '1.5rem',
              }} />

              {/* Social Proof Stack */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <ProofItem icon="⭐" text="4.9 Google Rating" />
                <ProofItem icon="🚗" text="10,000+ Vehicles Serviced" />
                <ProofItem icon="📍" text="2 Los Angeles Locations" />
              </div>
            </div>

            {/* MIDDLE: Locations */}
            <div>
              <h4 style={footerHeadingStyle}>Locations</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <p style={{ color: '#FF3838', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    East LA
                  </p>
                  <p style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.2rem', lineHeight: 1.4 }}>
                    2331 E Olympic Blvd
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                    Los Angeles, CA 90021
                  </p>
                </div>
                <div>
                  <p style={{ color: '#FF3838', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    South LA
                  </p>
                  <p style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.2rem', lineHeight: 1.4 }}>
                    2220 E Manchester Ave
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                    Los Angeles, CA 90001
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT: Contact Premium */}
            <div>
              <h4 style={footerHeadingStyle}>Contact</h4>

              {/* GIANT PHONE NUMBER */}
              
                <a href="tel:562-513-0217"
                className="footer-phone"
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  marginBottom: '1.5rem',
                }}
              >
                <span style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  display: 'block',
                  marginBottom: '0.4rem',
                }}>
                  Call Direct
                </span>
                <span style={{
                  display: 'block',
                  background: 'linear-gradient(180deg, #FF3838 0%, #B30000 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontSize: 'clamp(1.5rem, 2.5vw, 2.1rem)',
                  fontWeight: 900,
                  letterSpacing: '-0.01em',
                  filter: 'drop-shadow(0 0 20px rgba(255,31,31,0.3))',
                  lineHeight: 1.1,
                  transition: 'filter 0.3s ease',
                }}>
                  562-513-0217
                </span>
              </a>

              {/* Email */}
              
               <a href="mailto:tiredepotplug@gmail.com"
                className="footer-link"
                style={{
                  display: 'block',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  marginBottom: '1.5rem',
                  transition: 'color 0.3s ease',
                }}
              >
                tiredepotplug@gmail.com
              </a>

              {/* Social */}
              <div>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Follow
                </p>
                
                  <a href="https://www.instagram.com/tireplugcali"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-social"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    color: '#fff',
                    textDecoration: 'none',
                    background: 'rgba(255,31,31,0.06)',
                    border: '1px solid rgba(255,31,31,0.2)',
                    padding: '0.65rem 1.1rem',
                    borderRadius: '50px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" fill="#FF3838"/>
                  </svg>
                  @tireplugcali
                </a>
              </div>
            </div>
          </div>

          {/* METALLIC SEPARATOR */}
          <div style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,31,31,0.4) 50%, transparent 100%)',
            marginBottom: '2rem',
          }} />

          {/* BOTTOM BAR */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }} className="footer-bottom">
            <p style={{
              color: 'rgba(255,255,255,0.35)',
              fontSize: '0.75rem',
              letterSpacing: '0.05em',
            }}>
              © {new Date().getFullYear()} The Tire Plug. All rights reserved.
              {' · '}
              <a href="/privacy" className="footer-link" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'color 0.3s ease' }}>
                Privacy
              </a>
              {' · '}
              <a href="/terms" className="footer-link" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'color 0.3s ease' }}>
                Terms
              </a>
              {' · '}
              <a href="/sms" className="footer-link" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'color 0.3s ease' }}>
                Text Alerts
              </a>
              {' · '}
              <a href="/careers" className="footer-link" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'color 0.3s ease' }}>
                We're Hiring
              </a>
            </p>
            <p style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
            }}>
              Done <span style={{ color: '#FF3838' }}>Right.</span>
            </p>
          </div>
        </div>

        <style jsx>{`
          @media (max-width: 968px) {
            .footer-grid {
              grid-template-columns: 1fr !important;
              gap: 2.5rem !important;
            }
            .footer-bottom {
              flex-direction: column;
              text-align: center;
            }
          }
          .cta-primary::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%);
            transition: left 0.7s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
          }
          .cta-primary:hover::before { left: 100%; }
          .cta-primary:hover {
            transform: translateY(-3px) scale(1.02);
            background: linear-gradient(180deg, #FF3838 0%, #D10000 50%, #9B0000 100%) !important;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,100,100,0.6), 0 18px 45px rgba(139,0,0,0.7), 0 0 90px rgba(255,42,42,0.6) !important;
            letter-spacing: 0.22em !important;
          }
          .cta-secondary:hover {
            background: rgba(255,31,31,0.08) !important;
            border-color: rgba(255,31,31,0.4) !important;
            transform: translateY(-2px);
          }
          .footer-phone:hover span:last-child {
            filter: drop-shadow(0 0 35px rgba(255,31,31,0.7)) !important;
          }
          .footer-link:hover { color: #FF3838 !important; }
          .footer-social:hover {
            background: rgba(255,31,31,0.15) !important;
            border-color: rgba(255,31,31,0.5) !important;
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(255,31,31,0.2);
          }
        `}</style>
      </footer>
    </>
  );
}

// ============ PROOF ITEM ============
function ProofItem({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <span style={{ fontSize: '1rem' }}>{icon}</span>
      <span style={{
        color: 'rgba(255,255,255,0.85)',
        fontSize: '0.85rem',
        fontWeight: 600,
        letterSpacing: '0.05em',
      }}>
        {text}
      </span>
    </div>
  );
}

const footerHeadingStyle = {
  color: '#FF3838',
  fontSize: '0.7rem',
  fontWeight: 800,
  letterSpacing: '0.35em',
  textTransform: 'uppercase',
  marginBottom: '1.5rem',
};