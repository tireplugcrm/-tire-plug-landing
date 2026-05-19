import React, { useState, useEffect } from 'react';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <>
      <div className="trust-bar" style={{
        background: '#000',
        borderBottom: '1px solid rgba(178, 255, 0, 0.2)',
        padding: '0.5rem 2rem',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1001,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '2.5rem',
        fontSize: '0.8rem',
        color: 'rgba(255, 255, 255, 0.9)',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '1rem' }}>📸</span>
          <span style={{ color: '#B2FF00', fontWeight: 700 }}>130K</span>
          <span>Instagram Followers</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '1rem' }}>🏆</span>
          <span style={{ color: '#B2FF00', fontWeight: 700 }}>5M+</span>
          <span>Views</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '1rem' }}>🏆</span>
          <span style={{ color: '#B2FF00', fontWeight: 700 }}>10,000+</span>
          <span>Vehicles Serviced in 2025</span>
        </div>
      </div>

      <nav style={{
        background: scrolled ? 'rgba(0, 0, 0, 0.95)' : 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: scrolled ? '0.8rem 2rem' : '1.2rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'fixed',
        top: '38px',
        left: 0,
        right: 0,
        zIndex: 1000,
        transition: 'all 0.3s ease',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.1)' : 'none',
      }}>
        <div 
          onClick={() => scrollToSection('hero')}
          style={{ 
            fontSize: '1.5rem', 
            fontWeight: 800, 
            color: '#fff',
            letterSpacing: '-0.02em',
            cursor: 'pointer',
          }}
        >
          The Tire <span style={{ color: '#B2FF00' }}>Plug</span>
        </div>

        <div className="desktop-nav" style={{
          display: 'flex',
          gap: '2rem',
          alignItems: 'center',
        }}>
          <button onClick={() => scrollToSection('services')} style={navLinkStyle}>Services</button>
          <button onClick={() => scrollToSection('promos')} style={navLinkStyle}>Promos</button>
          <button onClick={() => scrollToSection('booking')} style={navLinkStyle}>Book</button>
          <button onClick={() => scrollToSection('locations')} style={navLinkStyle}>Locations</button>
          
          <a 
            href="tel:562-513-0217"
            style={{ 
              background: '#B2FF00',
              color: '#000', 
              fontSize: '0.95rem', 
              fontWeight: 700,
              padding: '0.7rem 1.5rem',
              borderRadius: '50px',
              transition: 'all 0.3s ease',
              display: 'inline-block',
            }}
          >
            📞 Click to Call
          </a>
        </div>

        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            display: 'none',
            background: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '1.5rem',
          }}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>

        {mobileMenuOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'rgba(0, 0, 0, 0.98)',
            backdropFilter: 'blur(20px)',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}>
            <button onClick={() => scrollToSection('services')} style={mobileNavStyle}>Services</button>
            <button onClick={() => scrollToSection('promos')} style={mobileNavStyle}>Promos</button>
            <button onClick={() => scrollToSection('booking')} style={mobileNavStyle}>Book Now</button>
            <button onClick={() => scrollToSection('locations')} style={mobileNavStyle}>Locations</button>
            <a 
              href="tel:562-513-0217"
              style={{
                background: '#B2FF00',
                color: '#000',
                padding: '1rem',
                borderRadius: '50px',
                textAlign: 'center',
                fontWeight: 700,
              }}
            >
              📞 Click to Call
            </a>
          </div>
        )}
      </nav>

      <style jsx>{`
        @media (max-width: 768px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-menu-btn {
            display: block !important;
          }
          .trust-bar {
            font-size: 0.65rem !important;
            gap: 0.8rem !important;
            padding: 0.4rem 1rem !important;
          }
        }
      `}</style>
    </>
  );
}

const navLinkStyle = {
  background: 'transparent',
  border: 'none',
  color: '#fff',
  fontSize: '0.95rem',
  fontWeight: 500,
  transition: 'color 0.3s ease',
  cursor: 'pointer',
};

const mobileNavStyle = {
  background: 'transparent',
  border: 'none',
  color: '#fff',
  fontSize: '1.2rem',
  fontWeight: 500,
  textAlign: 'left',
  padding: '0.5rem 0',
  cursor: 'pointer',
};