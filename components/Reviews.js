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
          <h2 style={{ fontSize: 'clamp(1.9rem, 4vw, 2.6rem)', fontWeight: 700, letterSpacing: '-0.03em', margin: '0.5rem 0 0.5rem' }}>
            5.0 on Google
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
