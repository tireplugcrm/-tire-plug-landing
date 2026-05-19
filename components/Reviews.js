import React, { useState, useEffect } from 'react';

export default function Reviews() {
  const reviews = [
    {
      name: 'Marcus T.',
      rating: 5,
      text: 'Came in last minute before closing — they still took care of me. Fast, friendly, and trustworthy. These guys are the real deal.',
      service: 'Oil Change + Rotation',
    },
    {
      name: 'Sarah K.',
      rating: 5,
      text: 'Got 4 new tires installed, balanced, and aligned all in the same day. No running around to different shops. Excellent service!',
      service: '4 New Tires + Alignment',
    },
    {
      name: 'Jose R.',
      rating: 5,
      text: 'Honest pricing, multiple options, no pressure to upsell. They actually want to help. Found my forever tire shop.',
      service: 'Tire Replacement',
    },
    {
      name: 'Diana M.',
      rating: 5,
      text: 'My TPMS light was driving me crazy for months. They fixed it in under an hour. Finally peace of mind!',
      service: 'TPMS Service',
    },
    {
      name: 'Kevin L.',
      rating: 5,
      text: 'Best alignment shop in LA. My car drives perfectly straight now. Fair price, quick service. Will be back.',
      service: 'Wheel Alignment',
    },
    {
      name: 'Amanda P.',
      rating: 5,
      text: 'Quick oil change, no upsells, fair price. Exactly what I want from a shop. Highly recommend!',
      service: 'Full Synthetic Oil Change',
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % reviews.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [reviews.length]);

  const nextReview = () => {
    setCurrentIndex((prev) => (prev + 1) % reviews.length);
  };

  const prevReview = () => {
    setCurrentIndex((prev) => (prev - 1 + reviews.length) % reviews.length);
  };

  return (
    <section
      id="reviews"
      style={{
        background: '#fff',
        padding: '6rem 2rem',
      }}
    >
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <p style={{
            color: '#86868B',
            fontSize: '0.95rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '0.5rem',
          }}>
            What Customers Say
          </p>
          <h2 style={{
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            fontWeight: 800,
            color: '#1d1d1f',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: '1rem',
          }}>
            Real reviews. <br />
            <span style={{ color: '#B2FF00' }}>Real customers.</span>
          </h2>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#86868B',
            fontSize: '0.95rem',
          }}>
            <span style={{ color: '#FFB800', fontSize: '1.2rem' }}>★★★★★</span>
            <span style={{ fontWeight: 600, color: '#1d1d1f' }}>4.9</span>
            <span>on Google</span>
          </div>
        </div>

        <div style={{
          background: '#F5F5F7',
          borderRadius: '24px',
          padding: '3rem',
          minHeight: '300px',
          position: 'relative',
          transition: 'all 0.3s ease',
        }}>
          <div style={{
            fontSize: '4rem',
            color: '#B2FF00',
            lineHeight: 1,
            marginBottom: '1rem',
            fontFamily: 'Georgia, serif',
          }}>
            "
          </div>

          <p style={{
            fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
            color: '#1d1d1f',
            lineHeight: 1.5,
            marginBottom: '2rem',
            minHeight: '120px',
          }}>
            {reviews[currentIndex].text}
          </p>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <div>
              <div style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#1d1d1f',
                marginBottom: '0.25rem',
              }}>
                {reviews[currentIndex].name}
              </div>
              <div style={{
                fontSize: '0.85rem',
                color: '#86868B',
              }}>
                {reviews[currentIndex].service}
              </div>
            </div>
            <div style={{ color: '#FFB800', fontSize: '1.2rem' }}>
              {'★'.repeat(reviews[currentIndex].rating)}
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
            marginTop: '2rem',
          }}>
            <button
              onClick={prevReview}
              style={{
                background: '#fff',
                border: '1px solid #E5E5E7',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '1.2rem',
                color: '#1d1d1f',
              }}
            >
              {'<'}
            </button>
            <button
              onClick={nextReview}
              style={{
                background: '#fff',
                border: '1px solid #E5E5E7',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '1.2rem',
                color: '#1d1d1f',
              }}
            >
              {'>'}
            </button>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            marginTop: '1.5rem',
          }}>
            {reviews.map((_, idx) => (
              <div
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                style={{
                  width: idx === currentIndex ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: idx === currentIndex ? '#B2FF00' : '#E5E5E7',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}