import React, { useEffect, useState } from 'react';
import { REVIEWS_FALLBACK } from '../lib/reviews-fallback';

export default function Reviews() {
  const [reviews, setReviews] = useState(REVIEWS_FALLBACK);

  useEffect(() => {
    let on = true;
    fetch('/api/reviews')
      .then((r) => r.json())
      .then((d) => { if (on && d && Array.isArray(d.reviews) && d.reviews.length) setReviews(d.reviews); })
      .catch(() => {});
    return () => { on = false; };
  }, []);

  const shown = reviews.slice(0, 3);

  return (
    <section id="reviews" style={{ background: 'var(--bg)', padding: 'clamp(3.5rem, 8vw, 5.5rem) 0' }}>
      <div className="tp-wrap">
        <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
          <span className="tp-eyebrow">Reviews</span>
          <h2 style={{ fontSize: 'clamp(1.9rem, 4vw, 2.6rem)', fontWeight: 700, letterSpacing: '-0.03em', margin: '0.5rem 0 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
            5.0 on
            <svg width="26" height="26" viewBox="0 0 24 24" aria-label="Google" style={{ verticalAlign: 'middle' }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          </h2>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '1.02rem' }}>Trusted by 10,000+ Los Angeles drivers.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          {shown.map((r, i) => (
            <figure key={i} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '1.5rem', margin: 0 }}>
              <div style={{ color: '#f5a623', marginBottom: '0.6rem', fontSize: '0.9rem', letterSpacing: '0.1em' }}>{'★'.repeat(r.rating || 5)}</div>
              <blockquote style={{ margin: '0 0 1rem', fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--ink-soft)' }}>&ldquo;{r.text}&rdquo;</blockquote>
              <figcaption style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ fontWeight: 700 }}>{r.name}</span>
                <span style={{ color: 'var(--muted)' }}>{r.date}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <a href="https://share.google/TtmW5AELc7UPOYkIP" target="_blank" rel="noopener noreferrer" className="tp-btn tp-btn-ghost">Read all reviews on Google</a>
        </div>
      </div>
    </section>
  );
}
