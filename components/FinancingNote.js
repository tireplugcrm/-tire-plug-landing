import React from 'react';

// "We finance" line for shoppers coming from the ads. Only what the owner confirmed:
// Snap Finance, pay over time, handled in store. Don't add rates or approval claims here.
export default function FinancingNote({ className = '' }) {
  return (
    <a className={`fin ${className}`} href="tel:5625004625">
      <svg className="fin-ic" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M2.5 10h19" stroke="currentColor" strokeWidth="2" />
        <path d="M6.5 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="fin-txt">
        <b>Financing available</b>
        <span>Pay over time with Snap Finance. Ask in store or call (562) 500-4625 →</span>
      </span>
      <style jsx>{`
        .fin { display: flex; align-items: center; gap: 0.8rem; padding: 0.85rem 1.1rem; border-radius: 12px; background: #fff;
          border: 1px solid #e6e6e6; box-shadow: 0 4px 14px rgba(0,0,0,0.04); color: #111; text-decoration: none; text-align: left; }
        .fin-ic { color: #E01B22; flex: none; }
        .fin-txt { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.15rem 0.75rem; }
        .fin-txt b { font-weight: 800; text-transform: uppercase; font-size: 0.95rem; }
        .fin-txt span { color: #555; font-size: 0.9rem; }
      `}</style>
    </a>
  );
}
