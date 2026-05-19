import React from 'react';

export default function Footer() {
  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer style={{
      background: '#000',
      color: '#fff',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    }}>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto',
        padding: '4rem 2rem 2rem',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '3rem',
          marginBottom: '3rem',
        }}>
          <div>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              marginBottom: '1rem',
              letterSpacing: '-0.02em',
            }}>
              THE TIRE<span style={{ color: '#B2FF00' }}>:</span>PLUG
            </div>
            <p style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '0.9rem',
              lineHeight: 1.6,
              marginBottom: '1.5rem',
            }}>
              LA's most trusted shop for tires, oil changes, alignments, and TPMS service. Fast, honest, and affordable.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#FFB800', fontSize: '1rem' }}>★★★★★</span>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>
                4.9 on Google
              </span>
            </div>
          </div>

          <div>
            <h4 style={footerTitleStyle}>Quick Links</h4>
            <button onClick={() => scrollToSection('services')} style={footerLinkStyle}>Services</button>
            <button onClick={() => scrollToSection('promos')} style={footerLinkStyle}>Current Promos</button>
            <button onClick={() => scrollToSection('booking')} style={footerLinkStyle}>Book Online</button>
            <button onClick={() => scrollToSection('reviews')} style={footerLinkStyle}>Reviews</button>
            <button onClick={() => scrollToSection('locations')} style={footerLinkStyle}>Locations</button>
          </div>

          <div>
            <h4 style={footerTitleStyle}>Services</h4>
            <p style={serviceItemStyle}>Oil Change</p>
            <p style={serviceItemStyle}>New Tires</p>
            <p style={serviceItemStyle}>Wheel Alignment</p>
            <p style={serviceItemStyle}>Tire Rotation</p>
            <p style={serviceItemStyle}>TPMS Service</p>
          </div>

          <div>
            <h4 style={footerTitleStyle}>Contact</h4>
            <a href="tel:562-513-0217" style={{
              display: 'block',
              color: '#B2FF00',
              fontSize: '1.1rem',
              fontWeight: 700,
              marginBottom: '1rem',
              textDecoration: 'none',
            }}>
              562-513-0217
            </a>
            <p style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '0.9rem',
              marginBottom: '0.25rem',
            }}>
              2331 E Olympic Blvd
            </p>
            <p style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '0.9rem',
              marginBottom: '1rem',
            }}>
              2220 E Manchester Ave
            </p>
            <p style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '0.85rem',
            }}>
              Los Angeles, CA
            </p>
          </div>
        </div>

        <div style={{
          paddingTop: '2rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <p style={{
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '0.85rem',
          }}>
            © 2026 The Tire:Plug. All rights reserved.
          </p>
          <p style={{
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '0.85rem',
          }}>
            Open 7 Days · Same Day Service Available
          </p>
        </div>
      </div>
    </footer>
  );
}

const footerTitleStyle = {
  color: '#fff',
  fontSize: '0.9rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: '1.5rem',
};

const footerLinkStyle = {
  display: 'block',
  background: 'transparent',
  border: 'none',
  color: 'rgba(255, 255, 255, 0.6)',
  fontSize: '0.9rem',
  padding: '0.4rem 0',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  fontFamily: 'inherit',
  transition: 'color 0.3s ease',
};

const serviceItemStyle = {
  color: 'rgba(255, 255, 255, 0.6)',
  fontSize: '0.9rem',
  padding: '0.4rem 0',
};