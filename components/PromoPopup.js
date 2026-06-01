import React, { useState, useEffect } from 'react';

export default function PromoPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ firstName: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const hasSeenPopup = sessionStorage.getItem('popupShown');
    if (!hasSeenPopup) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        sessionStorage.setItem('popupShown', 'true');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    if (isOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const canSubmit = formData.firstName.trim() && formData.email.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const response = await fetch('/api/submit-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.firstName,
          email: formData.email,
          phone: 'N/A',
          vehicle: 'N/A',
          tireSize: 'N/A',
          tireType: 'N/A',
          service: 'Discount Subscriber',
          serviceTiming: 'Newsletter Signup',
          leadPriority: 'SUBSCRIBER',
          date: new Date().toISOString().split('T')[0],
          time: '00:00',
          source: 'Website Discount Popup',
          tags: ['Discount Subscriber', 'Website Discount Popup'],
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSubmitted(true);
        setTimeout(() => setIsOpen(false), 4000);
      }
    } catch (err) {
      console.error('Subscription error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={() => setIsOpen(false)}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        animation: 'fadeIn 0.4s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #000 100%)',
          border: '1px solid rgba(255,31,31,0.3)',
          borderRadius: '20px',
          maxWidth: '440px',
          width: '100%',
          padding: '2.5rem 2rem',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(255,31,31,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
          animation: 'slideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        }}
      >
        {/* Metallic top edge */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '15%',
          right: '15%',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(255,31,31,0.6), transparent)',
          pointerEvents: 'none',
        }} />

        {/* Red ambient glow */}
        <div style={{
          position: 'absolute',
          top: '-30%',
          right: '-20%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(255,31,31,0.15) 0%, transparent 60%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }} />

        {/* Close button */}
        <button
          onClick={() => setIsOpen(false)}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.6)',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            zIndex: 10,
          }}
          className="close-btn"
        >
          ✕
        </button>

        {!submitted ? (
          <div style={{ position: 'relative', zIndex: 2 }}>
            {/* Small logo badge */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                boxShadow: '0 0 0 2px rgba(255,31,31,0.4), 0 0 20px rgba(255,31,31,0.25)',
              }}>
                <img
                  src="/images/logo.webp"
                  alt="The Tire Plug"
                  style={{ width: '130%', height: '130%', objectFit: 'cover', objectPosition: 'center' }}
                />
              </div>
            </div>

            {/* Tag */}
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <span style={{
                color: '#FF3838',
                fontSize: '0.65rem',
                fontWeight: 800,
                letterSpacing: '0.35em',
                textTransform: 'uppercase',
              }}>
                Exclusive Access
              </span>
            </div>

            {/* Headline */}
            <h2 style={{
              fontSize: 'clamp(1.5rem, 2.5vw, 1.85rem)',
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              textAlign: 'center',
              marginBottom: '0.85rem',
              textTransform: 'uppercase',
            }}>
              <span style={{
                background: 'linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.85) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Get Exclusive
              </span>{' '}
              <span style={{
                background: 'linear-gradient(180deg, #FF3838 0%, #B30000 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 15px rgba(255,31,31,0.3))',
              }}>
                Service Discounts
              </span>
            </h2>

            {/* Subheadline */}
            <p style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '0.85rem',
              textAlign: 'center',
              marginBottom: '1.75rem',
              lineHeight: 1.5,
            }}>
              Real deals on tires, oil, alignments, and more.
            </p>

            <form onSubmit={handleSubmit}>
              <input
                type="text"
                name="firstName"
                placeholder="First Name"
                value={formData.firstName}
                onChange={handleChange}
                required
                className="popup-input"
                style={inputStyle}
              />
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                required
                className="popup-input"
                style={inputStyle}
              />

              <button
                type="submit"
                disabled={submitting || !canSubmit}
                className="cinematic-cta"
                style={{
                  position: 'relative',
                  width: '100%',
                  background: 'linear-gradient(180deg, #FF2A2A 0%, #C20000 50%, #8B0000 100%)',
                  color: '#fff',
                  padding: '1.05rem',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  marginTop: '0.5rem',
                  marginBottom: '1rem',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,80,80,0.3), 0 8px 24px rgba(139,0,0,0.5), 0 0 40px rgba(255,42,42,0.2)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  fontFamily: 'inherit',
                  opacity: (!canSubmit || submitting) ? 0.4 : 1,
                  overflow: 'hidden',
                }}
              >
                {submitting ? 'Sending...' : 'Send Me Discounts →'}
              </button>
            </form>

            {/* Trust line */}
            <p style={{
              color: 'rgba(255,255,255,0.35)',
              fontSize: '0.7rem',
              textAlign: 'center',
              letterSpacing: '0.05em',
              fontStyle: 'italic',
            }}>
              No spam. Just real deals from The Tire Plug.
            </p>
            {/* Email consent disclaimer */}
            <p style={{
              color: 'rgba(255,255,255,0.3)',
              fontSize: '0.62rem',
              textAlign: 'center',
              lineHeight: 1.5,
              marginTop: '0.5rem',
            }}>
              By signing up, you agree to receive promotional emails from The Tire Plug. Unsubscribe
              anytime via the link in any email. See our{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,56,56,0.8)', textDecoration: 'underline' }}>Privacy Policy</a>.
            </p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '1.5rem 0', position: 'relative', zIndex: 2 }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(255,31,31,0.2) 0%, rgba(255,31,31,0.05) 100%)',
              border: '1px solid rgba(255,31,31,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              fontSize: '1.75rem',
              boxShadow: '0 0 30px rgba(255,31,31,0.3)',
            }}>
              ✓
            </div>
            <h2 style={{
              fontSize: '1.6rem',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
            }}>
              <span style={{
                background: 'linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.85) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                You're{' '}
              </span>
              <span style={{
                background: 'linear-gradient(180deg, #FF3838 0%, #B30000 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                In.
              </span>
            </h2>
            <p style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '0.9rem',
              lineHeight: 1.5,
            }}>
              Watch your inbox for deals.
            </p>
          </div>
        )}

        <style jsx>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideUp { 
            from { opacity: 0; transform: translateY(20px) scale(0.96); } 
            to { opacity: 1; transform: translateY(0) scale(1); } 
          }
          .popup-input:focus {
            border-color: rgba(255,31,31,0.5) !important;
            background: rgba(255,31,31,0.04) !important;
            box-shadow: 0 0 20px rgba(255,31,31,0.1);
          }
          .close-btn:hover {
            background: rgba(255,31,31,0.1) !important;
            border-color: rgba(255,31,31,0.3) !important;
            color: #FF3838 !important;
          }
          .cinematic-cta::before {
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
          .cinematic-cta:hover:not(:disabled)::before {
            left: 100%;
          }
          .cinematic-cta:hover:not(:disabled) {
            transform: translateY(-2px);
            background: linear-gradient(180deg, #FF3838 0%, #D10000 50%, #9B0000 100%) !important;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,100,100,0.5), 0 12px 32px rgba(139,0,0,0.6), 0 0 60px rgba(255,42,42,0.5) !important;
            letter-spacing: 0.22em !important;
          }
        `}</style>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '0.95rem 1.1rem',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  background: 'rgba(255,255,255,0.03)',
  color: '#fff',
  fontSize: '0.9rem',
  marginBottom: '0.6rem',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'all 0.3s ease',
  letterSpacing: '0.01em',
  boxSizing: 'border-box',
};