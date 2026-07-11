import React, { useState } from 'react';

// Fast-path quote: the customer fills 3 quick fields, taps the button, and their
// own phone's Messages app opens with a pre-written text to the shop — they just
// hit send. No Twilio, no separate number, no A2P approval; the lead lands as a
// real text in the shop's phone (562-500-4625).
const SHOP_SMS = '+15625004625';

const SERVICES = ['New Tires', 'Used Tires', 'Oil Change', 'Alignment', 'TPMS Sensors', 'Brakes'];

export default function QuoteByText() {
  const [firstName, setFirstName] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [service, setService] = useState('');

  const ready = firstName.trim() && service;

  const message =
    `Hi Tire Plug! I'm ${firstName.trim() || 'a new customer'}. ` +
    `I'm interested in ${service || 'a quote'}` +
    `${vehicle.trim() ? ` for my ${vehicle.trim()}` : ''}. ` +
    `Can you send me a price?`;

  // "?&body=" is the cross-platform trick that pre-fills the text on both iOS & Android.
  const smsHref = `sms:${SHOP_SMS}?&body=${encodeURIComponent(message)}`;

  const handleSend = (e) => {
    if (!ready) { e.preventDefault(); return; }
    // Count it as a lead for ad tracking (no-op until analytics is installed).
    if (typeof window !== 'undefined') {
      if (window.gtag) window.gtag('event', 'generate_lead', { method: 'text', currency: 'USD', value: 1 });
      if (window.fbq) window.fbq('track', 'Lead');
    }
  };

  return (
    <section id="quote" style={{ background: '#000', padding: '8rem 2rem 4rem', color: '#fff', position: 'relative', overflow: 'hidden', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      {/* Ambient glows — top and bottom for a full-screen opening */}
      <div style={{ position: 'absolute', top: '-8%', right: '-8%', width: '620px', height: '620px', background: 'radial-gradient(circle, rgba(255,31,31,0.14) 0%, transparent 60%)', filter: 'blur(120px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-15%', left: '-10%', width: '560px', height: '560px', background: 'radial-gradient(circle, rgba(255,31,31,0.10) 0%, transparent 60%)', filter: 'blur(120px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '640px', width: '100%', margin: '0 auto', position: 'relative', zIndex: 2 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.1rem' }}>
            <div style={{ width: '26px', height: '1px', background: 'linear-gradient(90deg, transparent, #FF1F1F)' }} />
            <span style={{ color: '#FF3838', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
              10-Second Quote
            </span>
            <div style={{ width: '26px', height: '1px', background: 'linear-gradient(90deg, #FF1F1F, transparent)' }} />
          </div>
          <h2 style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', fontWeight: 900, lineHeight: 0.98, letterSpacing: '-0.03em', textTransform: 'uppercase', margin: '0 0 0.85rem' }}>
            <span style={{ background: 'linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.85) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Text us. </span>
            <span style={{ background: 'linear-gradient(180deg, #FF3838 0%, #B30000 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', filter: 'drop-shadow(0 0 22px rgba(255,31,31,0.35))' }}>Get a price.</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: '1rem', maxWidth: '440px', margin: '0 auto', lineHeight: 1.5 }}>
            Tell us three things and tap send — we'll text you back a real quote, fast.
          </p>
        </div>

        {/* Card */}
        <div style={{ background: 'linear-gradient(135deg, rgba(20,20,20,0.85) 0%, rgba(0,0,0,0.95) 100%)', border: '1px solid rgba(255,31,31,0.25)', borderRadius: '20px', padding: '2rem 1.75rem', boxShadow: '0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
          {/* 1. First name */}
          <label style={labelStyle}>Your first name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="e.g. Marcus"
            style={inputStyle}
            className="qt-input"
          />

          {/* 2. Vehicle or tire size */}
          <label style={labelStyle}>Tire size or vehicle</label>
          <input
            type="text"
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder="225/45R17  —  or  —  2019 Honda Accord"
            style={inputStyle}
            className="qt-input"
          />

          {/* 3. Service */}
          <label style={labelStyle}>What do you need?</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.75rem' }}>
            {SERVICES.map((s) => {
              const on = service === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setService(s)}
                  className="qt-chip"
                  style={{
                    background: on ? 'rgba(255,31,31,0.15)' : 'rgba(255,255,255,0.03)',
                    border: on ? '1px solid #FF1F1F' : '1px solid rgba(255,255,255,0.12)',
                    color: on ? '#FF3838' : 'rgba(255,255,255,0.85)',
                    padding: '0.6rem 1rem',
                    borderRadius: '50px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.25s ease',
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>

          {/* Send button */}
          <a
            href={smsHref}
            onClick={handleSend}
            aria-disabled={!ready}
            className="qt-send"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              width: '100%',
              background: 'linear-gradient(180deg, #FF2A2A 0%, #C20000 50%, #8B0000 100%)',
              color: '#fff',
              padding: '1.2rem',
              fontSize: '0.95rem',
              fontWeight: 800,
              borderRadius: '10px',
              textDecoration: 'none',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 10px 30px rgba(139,0,0,0.5), 0 0 50px rgba(255,42,42,0.22)',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              opacity: ready ? 1 : 0.45,
              pointerEvents: ready ? 'auto' : 'none',
              transition: 'all 0.3s ease',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
            Text The Tire Plug · (562) 500-4625
          </a>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginTop: '0.9rem', lineHeight: 1.5 }}>
            {ready
              ? 'Opens your text messages with everything filled in — just hit send.'
              : 'Add your name and pick a service to text us.'}
          </p>
        </div>
      </div>

      <style jsx>{`
        .qt-input:focus {
          border-color: #FF1F1F !important;
          background: rgba(255,31,31,0.05) !important;
          box-shadow: 0 0 20px rgba(255,31,31,0.15);
        }
        .qt-chip:hover {
          border-color: rgba(255,31,31,0.5) !important;
          transform: translateY(-1px);
        }
        .qt-send:hover {
          transform: translateY(-2px);
          background: linear-gradient(180deg, #FF3838 0%, #D10000 50%, #9B0000 100%) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), 0 16px 40px rgba(139,0,0,0.6), 0 0 70px rgba(255,42,42,0.45) !important;
        }
      `}</style>
    </section>
  );
}

const labelStyle = {
  display: 'block',
  color: 'rgba(255,255,255,0.75)',
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  marginBottom: '0.5rem',
};

const inputStyle = {
  width: '100%',
  padding: '1rem 1.15rem',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  background: 'rgba(255,255,255,0.03)',
  color: '#fff',
  fontSize: '0.95rem',
  marginBottom: '1.4rem',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'all 0.3s ease',
  boxSizing: 'border-box',
};
