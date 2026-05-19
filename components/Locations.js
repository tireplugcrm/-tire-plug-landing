import React from 'react';

export default function Locations() {
  const locations = [
    {
      name: 'East LA',
      address: '2331 E Olympic Blvd',
      city: 'Los Angeles, CA 90021',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=2331+E+Olympic+Blvd+Los+Angeles+CA',
      embedUrl: 'https://maps.google.com/maps?q=2331+E+Olympic+Blvd+Los+Angeles+CA&z=15&output=embed',
    },
    {
      name: 'South LA',
      address: '2220 E Manchester Ave',
      city: 'Los Angeles, CA 90001',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=2220+E+Manchester+Ave+Los+Angeles+CA',
      embedUrl: 'https://maps.google.com/maps?q=2220+E+Manchester+Ave+Los+Angeles+CA&z=15&output=embed',
    },
  ];

  return (
    <section id="locations" style={{ background: '#F5F5F7', padding: '6rem 2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <p style={{ color: '#86868B', fontSize: '0.95rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            Our Locations
          </p>
          <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, color: '#1d1d1f', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Two LA shops. <span style={{ color: '#B2FF00' }}>Same great service.</span>
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
          {locations.map((loc, idx) => (
            <div key={idx} style={{ background: '#fff', borderRadius: '20px', overflow: 'hidden', border: '1px solid #E5E5E7' }}>
              <div style={{ height: '250px', background: '#000' }}>
                <iframe src={loc.embedUrl} width="100%" height="100%" style={{ border: 0 }} loading="lazy" title={loc.name}></iframe>
              </div>

              <div style={{ padding: '2rem' }}>
                <div style={{ display: 'inline-block', background: 'rgba(178, 255, 0, 0.15)', color: '#5d8c00', padding: '0.3rem 0.8rem', borderRadius: '50px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '1rem' }}>
                  THE TIRE:PLUG
                </div>

                <h3 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1d1d1f', marginBottom: '1rem', letterSpacing: '-0.02em' }}>
                  {loc.name}
                </h3>

                <div style={{ marginBottom: '1.5rem' }}>
                  <p style={{ color: '#1d1d1f', fontSize: '1rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                    {loc.address}
                  </p>
                  <p style={{ color: '#86868B', fontSize: '0.95rem' }}>
                    {loc.city}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <a href={loc.mapUrl} target="_blank" rel="noopener noreferrer" style={{ background: '#000', color: '#fff', padding: '0.8rem 1.5rem', fontSize: '0.9rem', fontWeight: 600, borderRadius: '50px', display: 'inline-block' }}>
                    Get Directions
                  </a>
                  <a href="tel:562-513-0217" style={{ background: '#B2FF00', color: '#000', padding: '0.8rem 1.5rem', fontSize: '0.9rem', fontWeight: 700, borderRadius: '50px', display: 'inline-block' }}>
                    Call Shop
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '3rem', padding: '2rem', background: '#fff', borderRadius: '20px', border: '1px solid #E5E5E7' }}>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1d1d1f', marginBottom: '0.5rem' }}>
            Open 7 Days a Week
          </h3>
          <p style={{ color: '#86868B', fontSize: '0.95rem', marginBottom: '1rem' }}>
            Mon-Sat: 8AM - 6PM | Sun: 9AM - 4PM
          </p>
          <p style={{ color: '#86868B', fontSize: '0.85rem' }}>
            Same day appointments available. Walk-ins welcome.
          </p>
        </div>
      </div>
    </section>
  );
}