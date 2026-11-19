import React, { useEffect, useRef, useState } from 'react';
import { REVIEWS_FALLBACK } from '../lib/reviews-fallback';

// Social proof: Google rating badge, two rows of real review cards sliding in opposite
// directions, and a stats strip. Live Google reviews replace the saved ones when /api/reviews
// has them; saved reviews show no date (their relative dates would go stale).
const GOOGLE_URL = 'https://www.google.com/maps/search/?api=1&query=The+Tire+Plug+2331+E+Olympic+Blvd+Los+Angeles';

const IG_URL = 'https://www.instagram.com/tireplugcali/';
const IG_REELS = Array.from({ length: 10 }, (_, i) => `/videos/ig/reel-${i + 1}`);

const IgIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const STATS = [
  ['5.0', 'Google rating'],
  ['10K+', 'Vehicles serviced'],
  ['130K', 'Instagram followers'],
  ['5M+', 'Video views'],
];

const GoogleG = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

function Card({ r, live }) {
  return (
    <figure className="rv-card">
      <div className="rv-top">
        <span className="rv-stars" aria-label={`${r.rating} out of 5 stars`}>{'★'.repeat(r.rating || 5)}</span>
        <GoogleG size={18} />
      </div>
      <blockquote>{r.text}</blockquote>
      <figcaption>
        <span className="rv-av">{r.initial}</span>
        <span className="rv-who">
          <b>{r.name}</b>
          <small>{live && r.date ? r.date : 'Google review'}</small>
        </span>
        {r.highlight && <span className="rv-tag">{r.highlight}</span>}
      </figcaption>
    </figure>
  );
}

export default function Reviews() {
  const [data, setData] = useState({ reviews: REVIEWS_FALLBACK, live: false });
  const igRef = useRef(null);
  const [igOn, setIgOn] = useState(false); // load the reel loops only once the row is near the screen

  useEffect(() => {
    const el = igRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setIgOn(true); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let on = true;
    fetch('/api/reviews')
      .then((r) => r.json())
      .then((d) => {
        if (on && d && Array.isArray(d.reviews) && d.reviews.length) setData({ reviews: d.reviews, live: d.source !== 'fallback' });
      })
      .catch(() => {});
    return () => { on = false; };
  }, []);

  const { reviews, live } = data;
  const rowA = reviews;
  const rowB = [...reviews].reverse();

  const row = (list, cls) => (
    <div className={`rv-row ${cls}`}>
      <div className="rv-track">
        {[0, 1, 2].map((copy) => list.map((r, i) => (
          <div key={`${copy}-${i}`} aria-hidden={copy ? 'true' : undefined} className="rv-slot"><Card r={r} live={live} /></div>
        )))}
      </div>
    </div>
  );

  return (
    <section id="reviews" className="rv">
      <div className="rv-glow" aria-hidden="true" />
      <div className="rv-head">
        <div>
          <span className="rv-kicker">Social proof</span>
          <h2>Trusted by <span>LA drivers.</span></h2>
          <p>Real reviews from real customers. English or Español, every driver gets straight answers and a fair price.</p>
        </div>
        <a className="rv-badge" href={GOOGLE_URL} target="_blank" rel="noopener noreferrer">
          <span className="rv-badge-g"><GoogleG size={28} /></span>
          <span className="rv-badge-score">5.0</span>
          <span className="rv-badge-meta">
            <span className="rv-stars big">★★★★★</span>
            <span>Rated on Google</span>
            <u>Read our reviews →</u>
          </span>
        </a>
      </div>

      {row(rowA, 'a')}
      {row(rowB, 'b')}

      <div className="rv-ig-head" ref={igRef}>
        <a className="rv-ig-handle" href={IG_URL} target="_blank" rel="noopener noreferrer">
          <span className="rv-ig-logo"><IgIcon size={22} /></span>
          <span><b>@tireplugcali</b><small>130K followers on Instagram</small></span>
        </a>
        <a className="rv-ig-follow" href={IG_URL} target="_blank" rel="noopener noreferrer">Follow us →</a>
      </div>
      <div className="rv-row rv-ig">
        <div className="rv-track">
          {[0, 1].map((copy) => IG_REELS.map((src, i) => (
            <a key={`${copy}-${i}`} className="rv-reel" href={IG_URL} target="_blank" rel="noopener noreferrer"
              aria-hidden={copy ? 'true' : undefined} tabIndex={copy ? -1 : undefined} aria-label={copy ? undefined : 'Watch on Instagram'}>
              {igOn
                ? <video src={`${src}.mp4`} poster={`${src}.jpg`} autoPlay muted loop playsInline preload="auto" />
                : <img src={`${src}.jpg`} alt="" loading="lazy" />}
              <span className="rv-reel-badge"><IgIcon size={16} /></span>
              <span className="rv-reel-play" aria-hidden="true">▶</span>
            </a>
          )))}
        </div>
      </div>

      <div className="rv-stats">
        {STATS.map(([v, l]) => (
          <div key={l}><b>{v}</b><span>{l}</span></div>
        ))}
      </div>

      {/* global: the cards render from helpers styled-jsx can't scope; every class is rv- prefixed */}
      <style jsx global>{`
        .rv { position: relative; overflow: hidden; background: #0a0a0b; color: #fff; padding: 6rem 0 5rem; }
        .rv-glow { position: absolute; inset: -20% -10% auto auto; width: 700px; height: 700px; pointer-events: none;
          background: radial-gradient(circle, rgba(224,27,34,0.22) 0%, transparent 60%); filter: blur(60px); }
        .rv-head { position: relative; max-width: 1280px; margin: 0 auto 3rem; padding: 0 1.5rem; display: flex; align-items: flex-end; justify-content: space-between; gap: 2rem; flex-wrap: wrap; }
        .rv-kicker { display: inline-block; color: #FF3838; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.3em; text-transform: uppercase; margin-bottom: 1rem; }
        .rv-head h2 { margin: 0; font-size: clamp(2.5rem, 6vw, 4.75rem); font-weight: 900; line-height: 0.92; letter-spacing: -0.04em; text-transform: uppercase; }
        .rv-head h2 span { display: block; color: #E01B22; }
        .rv-head p { margin: 1.1rem 0 0; max-width: 460px; color: rgba(255,255,255,0.65); font-size: 1.05rem; line-height: 1.55; }

        .rv-badge { display: flex; align-items: center; gap: 1rem; padding: 1.1rem 1.5rem; border-radius: 18px; text-decoration: none; color: #111;
          background: #fff; box-shadow: 0 20px 50px rgba(0,0,0,0.45); transition: transform 0.2s ease; }
        .rv-badge:hover { transform: translateY(-3px); }
        .rv-badge-g { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; background: #f3f3f3; }
        .rv-badge-score { font-size: 3.4rem; font-weight: 900; letter-spacing: -0.05em; line-height: 1; }
        .rv-badge-meta { display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.85rem; color: #555; }
        .rv-badge-meta u { color: #E01B22; font-weight: 800; text-decoration: none; }

        .rv-row { position: relative; overflow: hidden; padding: 0.5rem 0;
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
        .rv-track { display: flex; width: max-content; animation: rvLeft 60s linear infinite; }
        .rv-row.b .rv-track { animation-name: rvRight; animation-duration: 70s; }
        .rv-row:hover .rv-track { animation-play-state: paused; }
        .rv-slot { flex: none; width: 380px; padding: 0 0.6rem; }
        @keyframes rvLeft { from { transform: translateX(0); } to { transform: translateX(-33.3333%); } }
        @keyframes rvRight { from { transform: translateX(-33.3333%); } to { transform: translateX(0); } }

        .rv-card { margin: 0; height: 100%; display: flex; flex-direction: column; gap: 0.9rem; padding: 1.4rem 1.5rem; border-radius: 16px;
          background: linear-gradient(180deg, #17171a 0%, #111113 100%); border: 1px solid #26262b; transition: border-color 0.2s ease, transform 0.2s ease; }
        .rv-card:hover { border-color: #E01B22; transform: translateY(-3px); }
        .rv-top { display: flex; align-items: center; justify-content: space-between; }
        .rv-stars { color: #FFB800; letter-spacing: 0.12em; font-size: 0.95rem; }
        .rv-stars.big { font-size: 1.05rem; }
        .rv-card blockquote { margin: 0; flex: 1; font-size: 1rem; line-height: 1.55; color: rgba(255,255,255,0.88); }
        .rv-card blockquote::before { content: '“'; color: #E01B22; font-weight: 900; margin-right: 0.1em; }
        .rv-card blockquote::after { content: '”'; color: #E01B22; font-weight: 900; margin-left: 0.05em; }
        .rv-card figcaption { display: flex; align-items: center; gap: 0.7rem; }
        .rv-av { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; flex: none;
          background: linear-gradient(135deg, #FF1F1F 0%, #8B0000 100%); font-weight: 800; }
        .rv-who { display: flex; flex-direction: column; min-width: 0; }
        .rv-who b { font-size: 0.92rem; }
        .rv-who small { font-size: 0.72rem; color: rgba(255,255,255,0.45); }
        .rv-tag { margin-left: auto; white-space: nowrap; padding: 0.25rem 0.65rem; border-radius: 50px; font-size: 0.62rem; font-weight: 800;
          letter-spacing: 0.1em; text-transform: uppercase; color: #FF5A5A; border: 1px solid rgba(224,27,34,0.45); background: rgba(224,27,34,0.1); }

        .rv-ig-head { position: relative; max-width: 1280px; margin: 3rem auto 1.1rem; padding: 0 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .rv-ig-handle { display: flex; align-items: center; gap: 0.8rem; color: #fff; text-decoration: none; }
        .rv-ig-handle b { display: block; font-size: 1.15rem; font-weight: 800; }
        .rv-ig-handle small { display: block; font-size: 0.8rem; color: rgba(255,255,255,0.55); }
        .rv-ig-logo { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 14px; color: #fff;
          background: radial-gradient(circle at 30% 110%, #feda75 0%, #fa7e1e 25%, #d62976 50%, #962fbf 75%, #4f5bd5 100%); }
        .rv-ig-follow { padding: 0.75rem 1.3rem; border-radius: 8px; font-weight: 800; font-size: 0.9rem; color: #fff; text-decoration: none;
          background: linear-gradient(135deg, #FF1F1F 0%, #B30000 100%); box-shadow: 0 10px 28px rgba(255,31,31,0.3); transition: transform 0.2s ease; }
        .rv-ig-follow:hover { transform: translateY(-2px); }
        .rv-ig .rv-track { animation-duration: 55s; }
        .rv-ig .rv-track { animation-name: rvHalf; }
        @keyframes rvHalf { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .rv-reel { position: relative; flex: none; width: 200px; aspect-ratio: 9 / 16; margin: 0 0.5rem; border-radius: 16px; overflow: hidden;
          border: 1px solid #26262b; background: #111; transition: transform 0.2s ease, border-color 0.2s ease; }
        .rv-reel:hover { transform: translateY(-4px); border-color: #E01B22; }
        .rv-reel video, .rv-reel img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .rv-reel::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.55) 100%); pointer-events: none; }
        .rv-reel-badge { position: absolute; top: 10px; right: 10px; z-index: 1; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; color: #fff; background: rgba(0,0,0,0.45); }
        .rv-reel-play { position: absolute; left: 12px; bottom: 10px; z-index: 1; font-size: 0.8rem; color: #fff; opacity: 0.9; }

        .rv-stats { position: relative; max-width: 1280px; margin: 3rem auto 0; padding: 0 1.5rem; display: grid; grid-template-columns: repeat(4, 1fr); }
        .rv-stats div { padding: 1.25rem 1rem; text-align: center; border-left: 1px solid #26262b; }
        .rv-stats div:first-child { border-left: none; }
        .rv-stats b { display: block; font-size: clamp(2rem, 4vw, 3rem); font-weight: 900; letter-spacing: -0.04em; line-height: 1; }
        .rv-stats div:nth-child(even) b { color: #E01B22; }
        .rv-stats span { display: block; margin-top: 0.5rem; font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.5); }

        @media (prefers-reduced-motion: reduce) {
          .rv-track { animation: none; }
          .rv-row { overflow-x: auto; }
        }
        @media (max-width: 768px) {
          .rv { padding: 4rem 0 3.5rem; }
          .rv-head { padding: 0 1rem; align-items: flex-start; }
          .rv-badge { width: 100%; }
          .rv-slot { width: 300px; padding: 0 0.45rem; }
          .rv-ig-head { padding: 0 1rem; margin-top: 2.5rem; }
          .rv-reel { width: 150px; margin: 0 0.35rem; }
          .rv-stats { grid-template-columns: repeat(2, 1fr); padding: 0 1rem; }
          .rv-stats div:nth-child(3) { border-left: none; }
          .rv-stats div:nth-child(n + 3) { border-top: 1px solid #26262b; }
        }
      `}</style>
    </section>
  );
}
