import React, { useState } from 'react';
import TireSizeSearch from './TireSizeSearch';

// Fast-path tire quote: the customer enters their size, taps the button, and their
// own phone's Messages app opens with a pre-written text to the shop — they just
// hit send. No Twilio, no separate number; the lead lands as a text in the shop's
// texting number (562) 250-3737; calls still go to (562) 500-4625. New tires are the focus — add-ons happen at checkout.
const SHOP_SMS = '+15622503737';

const SIZE_MODES = {
  metric: {
    example: '225/45R17',
    labels: ['Width', 'Height', 'Rim'],
    sep: ['/', 'R'],
    s1: ['155', '165', '175', '185', '195', '205', '215', '225', '235', '245', '255', '265', '275', '285', '295', '305', '315', '325', '335'],
    s2: ['30', '35', '40', '45', '50', '55', '60', '65', '70', '75', '80', '85'],
    s3: ['13', '14', '15', '16', '17', '18', '19', '19.5', '20', '20.5', '21', '22', '22.5', '24', '24.5'],
  },
  truck: {
    example: '33x12.50R20',
    labels: ['Diameter', 'Width', 'Rim'],
    sep: ['x', 'R'],
    s1: ['30', '31', '32', '33', '34', '35', '37', '38', '40'],
    s2: ['9.50', '10.50', '11.50', '12.50', '13.50', '14.50'],
    s3: ['15', '16', '17', '18', '20', '22', '24'],
  },
};

// variant="section" (default): full-width homepage section with its own heading.
// variant="hero": the "Shop tires by size" box in the promo hero. No texting there: picking a
// size goes straight to /tires/<size>, which shows what's in stock and every option we carry.
export default function QuoteByText({ variant = 'section', theme = 'dark' }) {
  const T = theme === 'light' ? LIGHT : THEME;
  if (variant === 'hero') return <HeroSizeFinder T={T} />;
  return <TextQuote T={T} />;
}

function HeroSizeFinder({ T }) {
  return (
    <div className="tp-quote" style={{ ...T, color: 'var(--ink)', height: '100%' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', boxShadow: 'var(--shadow)', height: '100%', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: '1.1rem' }}>
          <span className="tp-eyebrow">Shop tires by size</span>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', margin: '0.35rem 0 0.25rem' }}>Find tires in your size</h2>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.9rem' }}>Pick your size to see what's in stock today and every option we carry.</p>
        </div>
        <TireSizeSearch />
        <p style={{ textAlign: 'center', fontSize: '0.8rem', margin: '0.85rem 0 0' }}>
          <a href="/tire-size-guide" style={{ color: 'var(--ink)', fontWeight: 600 }}>Don't know your size?</a>
        </p>
      </div>
      <QuoteStyles />
    </div>
  );
}

function TextQuote({ T }) {
  const [firstName, setFirstName] = useState('');
  const [sizeMode, setSizeMode] = useState('metric');
  const [s1, setS1] = useState('');
  const [s2, setS2] = useState('');
  const [s3, setS3] = useState('');
  const [sizeUnknown, setSizeUnknown] = useState(false);

  const cfg = SIZE_MODES[sizeMode];
  const size = !sizeUnknown && s1 && s2 && s3 ? `${s1}${cfg.sep[0]}${s2}${cfg.sep[1]}${s3}` : '';
  const ready = firstName.trim() && (size || sizeUnknown);

  function pickMode(mode) { setSizeMode(mode); setS1(''); setS2(''); setS3(''); }

  const sizePart = sizeUnknown ? ' (not sure of my size — can you help?)' : (size ? ` in ${size}` : '');
  const message = `Hi Tire Plug! I'm ${firstName.trim() || 'a new customer'}. I'm looking for new tires${sizePart}. Can you send me a price?`;
  const smsHref = `sms:${SHOP_SMS}?&body=${encodeURIComponent(message)}`;

  const handleSend = (e) => {
    if (!ready) { e.preventDefault(); return; }
    // Save the lead to the admin dashboard BEFORE the phone hands off to Messages.
    // sendBeacon (with a keepalive fetch fallback) guarantees the request survives
    // the page losing focus to the SMS app — and never blocks or delays the text.
    try {
      const payload = JSON.stringify({ name: firstName.trim(), tireSize: sizeUnknown ? null : size, sizeUnknown });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/text-quote', new Blob([payload], { type: 'application/json' }));
      } else {
        fetch('/api/text-quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true });
      }
    } catch (_) { /* never block the text on a tracking hiccup */ }

    if (typeof window !== 'undefined') {
      if (window.gtag) window.gtag('event', 'generate_lead', { method: 'text', currency: 'USD', value: 1 });
      if (window.fbq) window.fbq('track', 'Lead');
    }
  };

  const card = (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 'clamp(1.4rem, 4vw, 2rem)', boxShadow: 'var(--shadow)', boxSizing: 'border-box' }}>
          <label style={labelStyle}>Your first name</label>
          <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Marcus" style={inputStyle} className="tp-field" />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Tire size</label>
            <button type="button" onClick={() => setSizeUnknown(!sizeUnknown)} style={{ background: 'none', border: 'none', color: 'var(--ink)', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'underline', padding: 0 }}>
              {sizeUnknown ? 'I know my size' : "Don't know it?"}
            </button>
          </div>

          {sizeUnknown ? (
            <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '0.9rem 1rem', marginBottom: '1.6rem', color: 'var(--ink-soft)', fontSize: '0.9rem', textAlign: 'center' }}>
              👍 No problem — we'll help you find it when you text.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
                {Object.keys(SIZE_MODES).map((mode) => {
                  const on = sizeMode === mode;
                  return (
                    <button key={mode} type="button" onClick={() => pickMode(mode)} className="tp-chip" style={{ ...chipStyle, flex: 1, ...(on ? chipOn : {}) }}>
                      {SIZE_MODES[mode].example}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <select value={s1} onChange={(e) => setS1(e.target.value)} style={selectStyle} className="tp-field">
                  <option value="">{cfg.labels[0]}</option>{cfg.s1.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <select value={s2} onChange={(e) => setS2(e.target.value)} style={selectStyle} className="tp-field">
                  <option value="">{cfg.labels[1]}</option>{cfg.s2.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <select value={s3} onChange={(e) => setS3(e.target.value)} style={selectStyle} className="tp-field">
                  <option value="">{cfg.labels[2]}</option>{cfg.s3.map((v) => <option key={v} value={v}>R{v}</option>)}
                </select>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.75rem', margin: '0 0 1.6rem' }}>
                It's on your tire's sidewall{size ? ` — you picked ${size}` : `, e.g. ${cfg.example}`}.
              </p>
            </>
          )}

          <a href={smsHref} onClick={handleSend} aria-disabled={!ready} className="tp-btn tp-btn-primary" style={{ width: '100%', padding: '1.05rem', opacity: ready ? 1 : 0.45, pointerEvents: ready ? 'auto' : 'none' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
            Text us · (562) 250-3737
          </a>
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.75rem', marginTop: '0.85rem' }}>
            {ready ? 'Opens your texts with everything filled in — just hit send.' : 'Add your name and tire size to text us.'}
          </p>
        </div>
  );

  return (
    <section id="quote" className="tp-quote" style={{ ...T, background: 'var(--bg-alt)', color: 'var(--ink)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: 'clamp(3rem, 7vw, 5rem) 1.25rem', scrollMarginTop: '110px' }}>
      <div className="tp-wrap" style={{ maxWidth: '560px' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <span className="tp-eyebrow">Not sure? Text us your size</span>
          <h2 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)', fontWeight: 700, letterSpacing: '-0.03em', margin: '0.5rem 0 0.5rem' }}>Get a tire quote by text</h2>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '1rem' }}>Enter your size and tap send — we'll text you back a real price.</p>
        </div>
        {card}
      </div>
      <QuoteStyles />
    </section>
  );
}

function QuoteStyles() {
  return (
    <style jsx global>{`
      .tp-field:focus { border-color: var(--accent) !important; outline: none; }
      .tp-chip:hover { border-color: var(--accent) !important; }
      .tp-quote .tp-wrap { margin: 0 auto; }
      .tp-quote .tp-eyebrow { color: #FF3838; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; }
      .tp-quote .tp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.6rem; border-radius: 50px; font-weight: 800; font-size: 1rem; letter-spacing: 0.02em; text-decoration: none; transition: all 0.3s ease; box-sizing: border-box; }
      .tp-quote .tp-btn-primary { background: linear-gradient(135deg, #FF1F1F 0%, #B30000 100%); color: #fff; box-shadow: 0 8px 24px rgba(255, 31, 31, 0.25); }
      .tp-quote .tp-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(255, 31, 31, 0.4); }
      .tp-quote select option { background: var(--bg); color: var(--ink); }
      .tp-quote input::placeholder { color: var(--muted); }
    `}</style>
  );
}

// This section was written against design tokens the site never defined, so it rendered
// unstyled. Define them here, matching the dark black/red look of the rest of the homepage.
const THEME = {
  '--bg-alt': '#0a0a0b', '--bg': '#141416', '--card': 'rgba(255,255,255,0.03)',
  '--line': 'rgba(255,255,255,0.12)', '--ink': '#ffffff', '--ink-soft': 'rgba(255,255,255,0.78)',
  '--muted': 'rgba(255,255,255,0.55)', '--accent': '#FF1F1F',
  '--radius': '10px', '--radius-lg': '20px', '--shadow': '0 20px 40px rgba(0,0,0,0.35)',
  colorScheme: 'dark',
};
// White/black/red version for the white promo hero.
const LIGHT = {
  '--bg-alt': '#f5f5f5', '--bg': '#ffffff', '--card': '#ffffff',
  '--line': '#dcdcdc', '--ink': '#111111', '--ink-soft': '#333333',
  '--muted': '#6b6b6b', '--accent': '#E01B22',
  '--radius': '10px', '--radius-lg': '18px', '--shadow': '0 24px 50px rgba(0,0,0,0.10)',
  colorScheme: 'light',
};

const labelStyle = { display: 'block', color: 'var(--ink-soft)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem' };
const inputStyle = { width: '100%', padding: '0.9rem 1rem', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--bg)', color: 'var(--ink)', fontSize: '0.95rem', marginBottom: '1.4rem', outline: 'none', boxSizing: 'border-box' };
const selectStyle = { ...inputStyle, marginBottom: 0, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', padding: '0.85rem 0.6rem' };
const chipStyle = { background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink-soft)', padding: '0.6rem 1rem', borderRadius: 'var(--radius)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s ease' };
const chipOn = { background: 'rgba(255,31,31,0.12)', borderColor: 'var(--accent)', color: 'var(--ink)' };
