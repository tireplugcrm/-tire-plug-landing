// Normalize a line description into a stable match key (lowercase, alphanumeric only).
// "215/55R17- Arroyo Grand Sport AS" -> "21555r17arroyograndsportas"
// Used by the Weekly P&L pipeline to match uploaded line items to saved tire costs.
export function normalizeDesc(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
