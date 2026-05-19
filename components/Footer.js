import React from 'react';

export default function Footer() {
  return (
    <footer style={{
      background: '#000',
      color: '#999',
      textAlign: 'center',
      padding: '2rem',
      borderTop: '1px solid #333',
    }}>
      <p style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
        &copy; 2026 The Tire:Plug Los Angeles. All rights reserved.
      </p>
      <p style={{ fontSize: '0.9rem' }}>
        Fast, Reliable Oil Change Service in Los Angeles
      </p>
      <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
        📞 562-513-0217
      </p>
    </footer>
  );
}