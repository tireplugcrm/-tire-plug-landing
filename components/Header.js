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
    <nav style={{
      background: scrolled ? 'rgba(0, 0, 0, 0.95)' : 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      padding: scrolled ? '0.8rem 2rem' : '1.2rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      transition: 'all 0.3s ease',
      borderBottom: scrolled ? '1px solid rgba(255,255,255,0.1)' : 'none',
    }}>
      {/* Logo */}
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

      {/* Desktop Nav Links */}
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
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(178, 255, 0, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          📞 562-513-0217
        </a>
      </div>

      {/* Mobile Menu Button */}
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

      {/* Mobile Menu */}
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
            📞 Call 562-513-0217
          </a>
        </div>
      )}

      <style jsx>{`
        @media (max-width: 768px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-menu-btn {
            display: block !important;
          }
        }
      `}</style>
    </nav>
  );
}

const navLinkStyle = {
  background: 'transparent',
  border: 'none',
  color: '#fff',
  fontSize: '0.95rem',
  fontWeight: 500,
  transition: 'color 0.3s ease',
};

const mobileNavStyle = {
  background: 'transparent',
  border: 'none',
  color: '#fff',
  fontSize: '1.2rem',
  fontWeight: 500,
  textAlign: 'left',
  padding: '0.5rem 0',
};