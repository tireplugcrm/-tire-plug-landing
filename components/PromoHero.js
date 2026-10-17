import React, { useCallback, useEffect, useRef, useState } from 'react';
import QuoteByText from './QuoteByText';

// Promo-first homepage hero: the first thing a customer sees is the current deals.
// Edit SLIDES to change what rotates; each slide links to its page or the booking form.
const SLIDES = [
  {
    kicker: 'Landspider special',
    brand: { src: '/images/landspider/landspider-logo-white.png', alt: 'Landspider', h: 30 },
    title: ['Brand-new tires,', '15" to 20", from'],
    price: '$49',
    sub: 'Citytraxx G/P and H/P in 8 sizes. Install & balance $25 per wheel. While supplies last.',
    cta: { label: 'See sizes & prices', href: '/landspider-tires-los-angeles' },
    img: '/images/tires/landspider-citytraxx-h-p.webp',
    imgAlt: 'Landspider Citytraxx H/P tire',
  },
  {
    kicker: 'Kumho special',
    brand: { src: '/images/kumho/kumho-logo.png', alt: 'Kumho Tires', h: 40 },
    title: ['Buy 4 Kumho tires,', 'get a 4-wheel alignment'],
    price: '$49',
    sub: 'Ecsta · Crugen · Road Venture · Tesla-ready TA91 EV. From $99.75 a tire. Install & balance from $25 per wheel.',
    cta: { label: 'Shop Kumho', href: '/kumho-tires-los-angeles' },
    img: '/images/kumho/road-venture-ht52-cut.webp',
    imgAlt: 'Kumho Road Venture HT tire',
  },
  {
    kicker: 'New · RBP Repulsor A/T',
    brand: { src: '/images/rbp/rbp-logo-white.png', alt: 'RBP', h: 30 },
    title: ['All-terrain tires', 'from'],
    price: '$95',
    sub: '15" to 24", every size priced. 2-year road hazard coverage.',
    cta: { label: 'See sizes & prices', href: '/rbp-tires-los-angeles' },
    img: '/images/rbp/repulsor-at-plateau.png',
    imgAlt: 'RBP Repulsor A/T Plateau tire',
  },
  {
    kicker: 'Limited time',
    title: ['Tire rotation', '+ rebalance'],
    price: '$40',
    was: '$60',
    sub: 'Extend tire life. Recommended every 5,000 miles.',
    cta: { label: 'Book now', href: '/book?service=rotation' },
    img: '/images/mounting-equipment.webp',
    imgAlt: 'Tire mounting equipment at The Tire Plug',
    photo: true,
  },
  {
    kicker: 'New customers',
    title: ['Your first visit,', 'any service'],
    price: '$20 off',
    sub: 'First-time customers save instantly. Walk-ins welcome, open 7 days.',
    cta: { label: 'Book now', href: '/book?service=1' },
    img: '/images/shop-exterior.webp',
    imgAlt: 'The Tire Plug shop on Olympic Blvd',
    photo: true,
  },
];

const TRUST = [
  ['5.0', 'Google rated'],
  ['10K+', 'Vehicles serviced'],
  ['7 days', 'Open a week'],
  ['130K', 'Instagram followers'],
];

const INTERVAL = 6000;

export default function PromoHero() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (paused || reduce.current) return;
    const t = setTimeout(() => setI((n) => (n + 1) % SLIDES.length), INTERVAL);
    return () => clearTimeout(t);
  }, [i, paused]);

  const go = useCallback((n) => setI((n + SLIDES.length) % SLIDES.length), []);

  const onCta = (e, href) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const s = SLIDES[i];

  return (
    <section id="hero" className="ph">
      <a className="ph-bar" href="/kumho-tires-los-angeles">
        <span className="star">★</span>
        <span><b>Kumho special:</b> buy 4 tires, get a 4-wheel alignment for <b>$49</b></span>
        <span className="go">Shop now →</span>
      </a>

      <div className="ph-wrap">
        <div
          className="ph-carousel"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          aria-roledescription="carousel"
          aria-label="Current promotions"
        >
          <div className={`ph-slide${s.photo ? ' photo' : ''}`} key={i} aria-live="polite">
            {s.photo && <img className="ph-bg" src={s.img} alt="" aria-hidden="true" />}
            <div className="ph-copy">
              {s.brand && <img className="ph-brand" src={s.brand.src} alt={s.brand.alt} style={{ height: s.brand.h }} />}
              <span className="ph-kicker">{s.kicker}</span>
              <h1 className="ph-title">
                <span>{s.title[0]}</span>
                <span>{s.title[1]}</span>
              </h1>
              <div className="ph-price">
                {s.price}
                {s.was && <s>{s.was}</s>}
              </div>
              <p className="ph-sub">{s.sub}</p>
              <div className="ph-ctas">
                <a className="ph-btn" href={s.cta.href} onClick={(e) => onCta(e, s.cta.href)}>{s.cta.label} →</a>
                <a className="ph-btn ghost" href="tel:562-500-4625">Call (562) 500-4625</a>
              </div>
            </div>
            {!s.photo && <img className="ph-tire" src={s.img} alt={s.imgAlt} />}
          </div>

          <div className="ph-nav">
            <button type="button" className="ph-arrow" onClick={() => go(i - 1)} aria-label="Previous promotion">‹</button>
            <div className="ph-dots">
              {SLIDES.map((sl, n) => (
                <button key={sl.kicker} type="button" className={n === i ? 'on' : ''} onClick={() => go(n)} aria-label={`Show promotion ${n + 1}: ${sl.kicker}`} aria-current={n === i} />
              ))}
            </div>
            <button type="button" className="ph-arrow" onClick={() => go(i + 1)} aria-label="Next promotion">›</button>
          </div>
        </div>

        <div className="ph-finder" id="finder">
          <QuoteByText variant="hero" theme="light" />
        </div>
      </div>

      <div className="ph-brands">
        <span className="ph-brands-label">Brands we carry</span>
        <a href="/kumho-tires-los-angeles" aria-label="Shop Kumho tires"><img src="/images/kumho/kumho-logo.png" alt="Kumho Tires" style={{ height: 44 }} /></a>
        <a href="/rbp-tires-los-angeles" aria-label="Shop RBP tires"><img src="/images/rbp/rbp-logo.png" alt="RBP" style={{ height: 30 }} /></a>
      </div>

      <div className="ph-trust">
        {TRUST.map(([v, l]) => (
          <div key={l}><b>{v}</b><span>{l}</span></div>
        ))}
      </div>

      <style jsx>{`
        .ph { background: #fff; color: #111; padding: 144px 0 2.5rem; }
        .ph-bar { display: flex; align-items: center; justify-content: center; gap: 0.75rem; flex-wrap: wrap; text-align: center;
          background: linear-gradient(90deg, #B30000, #FF1F1F 50%, #B30000); color: #fff; text-decoration: none;
          padding: 0.7rem 1.25rem; font-size: 0.95rem; letter-spacing: 0.01em; }
        .ph-bar .star { color: #FFD43B; }
        .ph-bar .go { font-weight: 800; text-decoration: underline; text-underline-offset: 3px; }
        .ph-wrap { max-width: 1280px; margin: 1.5rem auto 0; padding: 0 1.5rem; display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 1.25rem; align-items: stretch; }

        .ph-carousel { position: relative; border-radius: 18px; overflow: hidden; border: 1px solid #111; color: #fff; box-shadow: 0 24px 50px rgba(0,0,0,0.18);
          background: radial-gradient(600px 400px at 85% 40%, rgba(255,31,31,0.22), transparent 70%), linear-gradient(135deg, #1a1a1d 0%, #050505 60%); min-height: 470px; display: flex; flex-direction: column; }
        .ph-slide { position: relative; flex: 1; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); align-items: center; gap: 1rem;
          padding: 2.5rem 2.75rem 1rem; animation: phIn 0.5s ease; }
        .ph-slide.photo { grid-template-columns: 1fr; }
        .ph-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.35; }
        .ph-slide.photo::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.2) 100%); }
        .ph-copy { position: relative; z-index: 1; max-width: 560px; }
        .ph-kicker { display: inline-block; background: rgba(255,31,31,0.15); border: 1px solid rgba(255,31,31,0.5); color: #FF5A5A;
          font-size: 0.75rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; padding: 0.35rem 0.75rem; border-radius: 50px; }
        .ph-title { margin: 1rem 0 0; font-size: clamp(1.9rem, 3.4vw, 2.9rem); font-weight: 900; line-height: 1.02; letter-spacing: -0.03em; text-transform: uppercase; }
        .ph-title span { display: block; }
        .ph-price { font-size: clamp(4.5rem, 10vw, 8rem); font-weight: 900; line-height: 0.9; letter-spacing: -0.05em; margin-top: 0.4rem;
          background: linear-gradient(180deg, #FF3838 0%, #B30000 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 30px rgba(255,31,31,0.35)); }
        .ph-price s { font-size: 0.32em; margin-left: 0.5rem; -webkit-text-fill-color: rgba(255,255,255,0.4); vertical-align: middle; letter-spacing: 0; }
        .ph-sub { color: rgba(255,255,255,0.72); font-size: 1.02rem; line-height: 1.5; margin: 0.9rem 0 0; max-width: 460px; }
        .ph-ctas { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1.5rem; }
        .ph-btn { display: inline-flex; align-items: center; background: linear-gradient(135deg, #FF1F1F 0%, #B30000 100%); color: #fff; text-decoration: none;
          padding: 0.95rem 1.6rem; border-radius: 8px; font-weight: 800; font-size: 0.95rem; letter-spacing: 0.03em; box-shadow: 0 10px 28px rgba(255,31,31,0.3); transition: transform 0.2s ease; }
        .ph-btn:hover { transform: translateY(-2px); }
        .ph-btn.ghost { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18); box-shadow: none; font-weight: 700; }
        .ph-tire { position: relative; z-index: 1; width: 100%; max-height: 380px; object-fit: contain; filter: drop-shadow(0 30px 40px rgba(0,0,0,0.6)); transform: rotate(-6deg); }

        .ph-nav { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1.25rem 1.1rem; }
        .ph-arrow { width: 40px; height: 40px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.18); background: rgba(0,0,0,0.4); color: #fff; font-size: 1.5rem; line-height: 1; cursor: pointer; }
        .ph-arrow:hover { border-color: #FF1F1F; }
        .ph-dots { display: flex; gap: 0.5rem; }
        .ph-dots button { width: 10px; height: 10px; border-radius: 50px; border: none; background: rgba(255,255,255,0.3); cursor: pointer; padding: 0; transition: all 0.3s ease; }
        .ph-dots button.on { width: 30px; background: #FF1F1F; }
        .ph-arrow:focus-visible, .ph-dots button:focus-visible, .ph-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

        .ph-finder { display: flex; flex-direction: column; justify-content: center; scroll-margin-top: 150px; }

        .ph-brand { display: block; width: auto; margin-bottom: 0.9rem; }
        .ph-brands { max-width: 1280px; margin: 1.25rem auto 0; padding: 0 1.5rem; display: flex; align-items: center; justify-content: center; gap: 2.5rem; flex-wrap: wrap; }
        .ph-brands-label { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #6b6b6b; }
        .ph-brands a { display: flex; align-items: center; padding: 0.6rem 1.1rem; border: 1px solid #e6e6e6; border-radius: 12px; background: #fff; transition: transform 0.2s ease, border-color 0.2s ease; }
        .ph-brands a:hover { transform: translateY(-2px); border-color: #E01B22; }
        .ph-brands img { width: auto; display: block; }
        .ph-trust { max-width: 1280px; margin: 1.25rem auto 0; padding: 0 1.5rem; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; }
        .ph-trust div { border: 1px solid #e6e6e6; background: #fff; border-radius: 12px; padding: 0.9rem 1rem; text-align: center; box-shadow: 0 4px 14px rgba(0,0,0,0.04); }
        .ph-trust b { display: block; font-size: 1.4rem; font-weight: 800; color: #111; }
        .ph-trust span { font-size: 0.7rem; letter-spacing: 0.16em; text-transform: uppercase; color: #6b6b6b; }
        .ph-trust div:nth-child(even) b { color: #E01B22; }

        @keyframes phIn { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .ph-slide { animation: none; } }

        @media (max-width: 1024px) {
          .ph-wrap { grid-template-columns: 1fr; }
          /* Stacked: size lookup first, promos under it */
          .ph-finder { max-width: 560px; width: 100%; margin: 0 auto; order: -1; }
        }
        @media (max-width: 640px) {
          .ph { padding-top: 105px; }
          .ph-bar { font-size: 0.85rem; padding: 0.6rem 1rem; }
          .ph-wrap { padding: 0 1rem; margin-top: 1rem; }
          .ph-carousel { min-height: 0; }
          .ph-slide { grid-template-columns: 1fr; padding: 1.5rem 1.25rem 0.5rem; }
          .ph-tire { max-height: 190px; order: -1; justify-self: center; width: auto; }
          .ph-ctas .ghost { display: none; }
          .ph-trust { grid-template-columns: repeat(2, 1fr); padding: 0 1rem; }
          .ph-brands { gap: 0.75rem 1rem; padding: 0 1rem; }
          .ph-brands-label { width: 100%; text-align: center; }
          .ph-brand { margin-bottom: 0.6rem; }
        }
      `}</style>
    </section>
  );
}
