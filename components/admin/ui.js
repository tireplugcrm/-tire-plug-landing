// Shared look for the admin: design tokens and the outline icon (Google Material Symbols,
// loaded by the admin Shell; the same icon family Tekmetric uses). Blue is for actions,
// red only for the brand and for alerts.
//
// Glass theme: frosted panels over the shop photo (the admin Shell paints the photo and blurs
// anything on T.surface). Accent colors are the light shades so they read on the dark glass;
// ui.pill(color) tints with `${color}14`, so accents must stay 6-digit hex.
import React from "react";

export const T = {
  page: "transparent", surface: "rgba(255,255,255,0.08)", hover: "rgba(255,255,255,0.10)",
  text: "#f8fafc", textMuted: "rgba(255,255,255,0.68)", textFaint: "rgba(255,255,255,0.45)",
  border: "rgba(255,255,255,0.14)", borderStrong: "rgba(255,255,255,0.24)",
  blue: "#3b82f6", blueHover: "#2563eb", blueSoft: "rgba(96,165,250,0.20)", blueRing: "rgba(96,165,250,0.35)",
  topbar: "rgba(12,16,22,0.55)", red: "#f87171", green: "#34d399", amber: "#fbbf24",
};
const glass = { backdropFilter: "blur(18px) saturate(140%)", WebkitBackdropFilter: "blur(18px) saturate(140%)" };

export function Icon({ name, size = 20, style }) {
  return <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: size, lineHeight: 1, width: size, ...style }}>{name}</span>;
}

// Buttons, card and pill in the same style as the rest of the admin.
export const ui = {
  btn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 34, background: T.surface, color: T.text, padding: "0 0.8rem", fontSize: 13.5, fontWeight: 500, border: `1px solid ${T.borderStrong}`, borderRadius: 999, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", whiteSpace: "nowrap" },
  primary: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 34, background: T.blue, color: "#fff", padding: "0 0.9rem", fontSize: 13.5, fontWeight: 600, border: `1px solid ${T.blue}`, borderRadius: 999, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", whiteSpace: "nowrap" },
  card: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "0.9rem 1.1rem", boxShadow: "0 8px 32px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.10)", ...glass },
  pill: (color) => ({ display: "inline-flex", alignItems: "center", gap: 4, height: 22, fontSize: 12, fontWeight: 500, padding: "0 9px", borderRadius: 999, background: /^#[0-9a-f]{6}$/i.test(color) ? `${color}2e` : T.hover, color, whiteSpace: "nowrap" }),
  h1: { margin: 0, fontSize: 22, fontWeight: 600, color: T.text, letterSpacing: "-0.01em" },
  h2: { fontSize: 15, fontWeight: 600, color: T.text, margin: "1.6rem 0 0.7rem" },
  label: { display: "block", color: T.textMuted, fontSize: 13, fontWeight: 500, marginBottom: "0.35rem" },
  input: { width: "100%", height: 38, padding: "0 0.75rem", border: `1px solid ${T.borderStrong}`, borderRadius: 6, background: T.surface, color: T.text, fontSize: 14, marginBottom: "0.6rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  muted: { color: T.textMuted, fontSize: 13, lineHeight: 1.5 },
};
