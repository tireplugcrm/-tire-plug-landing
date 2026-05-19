import React from 'react';

export default function Services() {
  const services = [
    {
      icon: 'OIL',
      title: 'Oil Change',
      desc: 'Full synthetic. In and out in 10 minutes.',
      price: 'Starting at $75',
    },
    {
      icon: 'TIRE',
      title: 'New Tires',
      desc: 'Top brands. Installed, balanced, and aligned.',
      price: 'Best prices in LA',
    },
    {
      icon: 'WHEEL',
      title: 'Alignment',
      desc: 'Computer-precise wheel alignment.',
      price: 'Starting at $75',
    },
    {
      icon: 'TPMS',
      title: 'TPMS Service',
      desc: 'We know that light is on — we help turn it off.',
      price: 'Starting at $199',
    },
  ];

  return (
    <section 
      id="services"
      style={{
        background: '#F5F5F7',
        padding: '6rem 2rem',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <p style={{
            color: '#86868B',
            fontSize: '0.95rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '0.5rem',
          }}>
            Our Services
          </p>
          <h2 style={{
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            fontWeight: 800,
            color: '#1d1d1f',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
          }}>
            Everything Your <br />
            Car Needs.
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.5rem',
        }}>
          {services.map((service, idx) => (
            <div 
              key={idx}
              style={{
                background: '#fff',
                borderRadius: '20px',
                padding: '2.5rem 2rem',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                border: '1px solid #E5E5E7',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.08)';
                e.currentTarget.style.borderColor = '#B2FF00';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#E5E5E7';
              }}
            >
              <div style={{
                background: '#000',
                color: '#B2FF00',
                width: '60px',
                height: '60px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 800,
                marginBottom: '1.5rem',
                letterSpacing: '0.05em',
              }}>
                {service.icon}
              </div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#1d1d1f',
                marginBottom: '0.5rem',
              }}>
                {service.title}
              </h3>
              <p style={{
                color: '#86868B',
                fontSize: '0.95rem',
                lineHeight: 1.5,
                marginBottom: '1rem',
              }}>
                {service.desc}
              </p>
              <p style={{
                color: '#1d1d1f',
                fontWeight: 700,
                fontSize: '1rem',
              }}>
                {service.price}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}