import React from 'react';

export default function Hero() {
  const scrollToBooking = () => {
    document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section style={{
      background: 'linear-gradient(135deg, #000 0%, #1a1a1a 100%)',
      color: '#fff',
      padding: '6rem 2rem',
      textAlign: 'center',
      minHeight: '600px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <p style={{ color: '#B2FF00', fontSize: '18px', marginBottom: '1rem', fontWeight: 600 }}>
          BEST OIL CHANGE NEAR YOU
        </p>
        
        <h1 style={{
          fontSize: 'clamp(2.5rem, 8vw, 4rem)',
          fontWeight: 700,
          marginBottom: '1rem',
          lineHeight: 1.2,
        }}>
          Protect Your <span style={{ color: '#B2FF00' }}>Engine</span>
        </h1>

        <p style={{ fontSize: '1.3rem', color: '#ddd', marginBottom: '3rem' }}>
          Premium Oil. Peak Performance.
        </p>

        <div style={{
          background: 'rgba(178, 255, 0, 0.1)',
          border: '2px solid #B2FF00',
          borderRadius: '8px',
          padding: '2rem',
          marginBottom: '2rem',
        }}>
          <p style={{ fontSize: '18px', marginBottom: '1rem', color: '#ddd' }}>
            ⚡ Quick & Easy Service
          </p>
          <h2 style={{ fontSize: '2.5rem', color: '#B2FF00', margin: '0 0 0.5rem', fontWeight: 700 }}>
            IN & OUT IN 10 MINUTES
          </h2>
          <p style={{ color: '#B2FF00', fontSize: '1.1rem', fontWeight: 600 }}>
            NO APPOINTMENT NEEDED
          </p>
        </div>

        <button
          onClick={scrollToBooking}
          style={{
            background: '#B2FF00',
            color: '#000',
            padding: '1rem 3rem',
            fontSize: '1.2rem',
            fontWeight: 700,
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          BOOK YOUR OIL CHANGE
        </button>
      </div>
    </section>
  );
}