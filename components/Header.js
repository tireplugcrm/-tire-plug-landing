import React from 'react';

export default function Header() {
  return (
    <nav style={{
      background: '#000',
      padding: '1rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#B2FF00' }}>
        THE TIRE:PLUG
      </div>
      <a 
        href="tel:562-513-0217"
        style={{ 
          color: '#fff', 
          fontSize: '18px', 
          textDecoration: 'none',
          fontWeight: 500,
          padding: '0.5rem 1rem',
          border: '1px solid #B2FF00',
          borderRadius: '4px',
        }}
      >
        📞 562-513-0217
      </a>
    </nav>
  );
}