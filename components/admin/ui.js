// Shared look for the admin: design tokens and the outline icon (Google Material Symbols,
// loaded by the admin Shell; the same icon family Tekmetric uses). Blue is for actions,
// red only for the brand and for alerts.
import React from "react";

export const T = {
  page: "#f4f5f7", surface: "#ffffff", hover: "#f3f4f6",
  text: "#1f2937", textMuted: "#6b7280", textFaint: "#9ca3af",
  border: "#e5e7eb", borderStrong: "#d1d5db",
  blue: "#1a66d6", blueHover: "#1556b5", blueSoft: "#e8f0fe", blueRing: "rgba(26,102,214,0.18)",
  topbar: "#1e2833", red: "#e01b22", green: "#15803d", amber: "#b45309",
};

export function Icon({ name, size = 20, style }) {
  return <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: size, lineHeight: 1, width: size, ...style }}>{name}</span>;
}

// Buttons, card and pill in the same style as the rest of the admin.
export const ui = {
  btn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 34, background: T.surface, color: T.text, padding: "0 0.8rem", fontSize: 13.5, fontWeight: 500, border: `1px solid ${T.borderStrong}`, borderRadius: 6, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", whiteSpace: "nowrap" },
  primary: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 34, background: T.blue, color: "#fff", padding: "0 0.9rem", fontSize: 13.5, fontWeight: 600, border: `1px solid ${T.blue}`, borderRadius: 6, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", whiteSpace: "nowrap" },
  card: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "0.9rem 1.1rem" },
  pill: (color) => ({ display: "inline-flex", alignItems: "center", gap: 4, height: 22, fontSize: 12, fontWeight: 500, padding: "0 8px", borderRadius: 4, background: `${color}14`, color, whiteSpace: "nowrap" }),
  h1: { margin: 0, fontSize: 22, fontWeight: 600, color: T.text, letterSpacing: "-0.01em" },
  h2: { fontSize: 15, fontWeight: 600, color: T.text, margin: "1.6rem 0 0.7rem" },
  label: { display: "block", color: "#374151", fontSize: 13, fontWeight: 500, marginBottom: "0.35rem" },
  input: { width: "100%", height: 38, padding: "0 0.75rem", border: `1px solid ${T.borderStrong}`, borderRadius: 6, background: T.surface, color: T.text, fontSize: 14, marginBottom: "0.6rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  muted: { color: T.textMuted, fontSize: 13, lineHeight: 1.5 },
};
