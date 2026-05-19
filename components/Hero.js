import React from 'react';

export default function Hero() {
  const scrollToBooking = () => {
    const el = document.getElementById('booking');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section 
      id="hero"
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: 'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 100%), url(/images/shop-exterior.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: '#fff',
        padding: '8rem 2rem 4rem',
      }}
    >
      <div style={{ 
        maxWidth: '1200px', 
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block',
          padding: '0.5rem 1.2rem',
          background: 'rgba(178, 255, 0, 0.1)',
          border: '1px solid rgba(178, 255, 0, 0.4)',
          borderRadius: '50px',
          color: '#B2FF00',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '2rem',
        }}>
          LA Most Trusted Tire and Oil Shop
        </div>

        <h1 style={{
          fontSize: 'clamp(3rem, 9vw, 6rem)',
          fontWeight: 800,
          lineHeight: 1.05,
          marginBottom: '1.5rem',
        }}>
          Tires, Oil and Service. <span style={{ color: '#B2FF00' }}>Done Right.</span>
        </h1>

        <p style={{
          fontSize: '1.3rem',
          color: 'rgba(255, 255, 255, 0.85)',
          maxWidth: '700px',
          margin: '0 auto 3rem',
        }}>
          Premium service from people who actually care about your car. In and out fast, without the runaround.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '3rem' }}>
          <button onClick={scrollToBooking} style={{ background: '#B2FF00', color: '#000', padding: '1.1rem 2.5rem', fontSize: '1.05rem', fontWeight: 700, border: 'none', borderRadius: '50px', cursor: 'pointer' }}>
            Book Online
          </button>
          <a href="tel:562-513-0217" style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', padding: '1.1rem 2.5rem', fontSize: '1.05rem', fontWeight: 600, borderRadius: '50px', display: 'inline-block' }}>
            Call 562-513-0217
          </a>
        </div>

        <div style={{ display: 'flex', gap: '3rem', justifyContent: 'center', flexWrap: 'wrap', paddingTop: '2rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#B2FF00' }}>4.9 Stars</div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)' }}>Google Rating</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#B2FF00' }}>1000+</div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)' }}>Happy Customers</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#B2FF00' }}>2</div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)' }}>LA Locations</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#B2FF00' }}>Same Day</div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)' }}>Service</div>
          </div>
        </div>
      </div>
    </section>
  );
}