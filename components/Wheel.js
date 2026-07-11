import React from 'react';

// Clean front-facing tire + wheel, drawn in SVG so it needs no image asset and
// picks up the theme (--tire / --rim). Used in the hero and product cards.
export default function Wheel({ size = 200, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={style} className={className} aria-hidden="true">
      <defs>
        <radialGradient id="tpRim" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#f2f3f5" />
          <stop offset="68%" stopColor="var(--rim)" />
          <stop offset="100%" stopColor="#93989f" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="97" fill="var(--tire)" />
      <circle cx="100" cy="100" r="80" fill="none" stroke="#000" strokeOpacity="0.2" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="67" fill="url(#tpRim)" stroke="#8b9098" strokeWidth="1" />
      <g fill="#aab0b7">
        {[0, 72, 144, 216, 288].map((a) => (
          <rect key={a} x="93.5" y="40" width="13" height="54" rx="5" transform={`rotate(${a} 100 100)`} />
        ))}
      </g>
      <circle cx="100" cy="100" r="17" fill="#dadde1" stroke="#aeb3ba" />
      <circle cx="100" cy="100" r="5.5" fill="#8b9098" />
    </svg>
  );
}
