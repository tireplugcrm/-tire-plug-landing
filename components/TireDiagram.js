// A car seen from above (front at the top) with its four wheels. Lit wheels are the ones getting
// new tires; arrows show a rotation pattern. Tap a wheel to pick it when onToggle is given.
// Shared by the admin Shop Floor (light) and the shop TVs (dark): colors come in as props.
import React from "react";
import { WHEELS, ROTATIONS } from "../lib/shop-floor.js";

const AT = { LF: [22, 34], RF: [78, 34], LR: [22, 106], RR: [78, 106] };
const LIGHT = { body: "#e5e7eb", bodyLine: "#d1d5db", tire: "#4b5563", on: "#1a66d6", arrow: "#b45309", label: "#6b7280" };

// From wheel a toward wheel b, stopping short of both wheels so the arrow sits between them.
function arrowPath(a, b, bend) {
  const [x1, y1] = AT[a], [x2, y2] = AT[b];
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), cut = 17 / len;
  const sx = x1 + dx * cut, sy = y1 + dy * cut, ex = x2 - dx * cut, ey = y2 - dy * cut;
  if (!bend) return `M${sx},${sy} L${ex},${ey}`;
  // Swaps draw two curved arrows, one on each side of the straight line.
  const mx = (sx + ex) / 2 - (dy / len) * bend, my = (sy + ey) / 2 + (dx / len) * bend;
  return `M${sx},${sy} Q${mx},${my} ${ex},${ey}`;
}

export default function TireDiagram({ wheels = [], rotation, onToggle, size = 120, colors, labels }) {
  const c = { ...LIGHT, ...colors };
  const moves = ROTATIONS.find((r) => r.k === rotation)?.moves || [];
  const isSwap = (a, b) => moves.some(([x, y]) => x === b && y === a);
  const id = `ah${String(size).replace(/\W/g, "")}${rotation || ""}`;
  return (
    <svg viewBox="0 0 100 140" {...(typeof size === "number" ? { width: size * (100 / 140), height: size } : {})} role="img" style={{ display: "block", flexShrink: 0 }}
      aria-label={`${wheels.length ? `New tires on ${wheels.map((k) => WHEELS.find((w) => w.k === k)?.l).join(", ")}` : "Wheels"}${rotation ? `, ${ROTATIONS.find((r) => r.k === rotation)?.l}` : ""}`}>
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={c.arrow} />
        </marker>
      </defs>
      <rect x="28" y="8" width="44" height="124" rx="16" fill={c.body} stroke={c.bodyLine} strokeWidth="1.5" />
      <rect x="33" y="30" width="34" height="20" rx="5" fill="none" stroke={c.bodyLine} strokeWidth="1.5" />
      {WHEELS.map((w) => {
        const [x, y] = AT[w.k];
        const on = wheels.includes(w.k);
        return (
          <g key={w.k} onClick={onToggle ? () => onToggle(w.k) : undefined} style={onToggle ? { cursor: "pointer" } : undefined}>
            {onToggle && <rect x={x - 14} y={y - 20} width="28" height="40" fill="transparent" />}
            <rect x={x - 7} y={y - 14} width="14" height="28" rx="4" fill={on ? c.on : c.tire} stroke={on ? c.on : "none"} strokeWidth="3" />
            {labels && <text x={x} y={y + 27} textAnchor="middle" fontSize="8" fontWeight="600" fill={on ? c.on : c.label}>{w.k}</text>}
          </g>
        );
      })}
      {moves.map(([a, b]) => (
        <path key={`${a}${b}`} d={arrowPath(a, b, isSwap(a, b) ? 6 : 0)} fill="none" stroke={c.arrow} strokeWidth="3" strokeLinecap="round" markerEnd={`url(#${id})`} />
      ))}
    </svg>
  );
}
