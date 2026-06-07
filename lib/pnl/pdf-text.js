/**
 * Extract text from a TireBase report PDF, reconstructing visual lines by Y position.
 * Returns an array of trimmed text lines in top-to-bottom, left-to-right order —
 * the shape the Sales Journal / Sales Detail parsers expect.
 */
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractPdfLines(buffer) {
  // Node Buffer is a Uint8Array subclass but pdf.js rejects it — copy into a plain one.
  const data = new Uint8Array(buffer.buffer ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) : buffer);
  const doc = await getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const rows = {};
    for (const it of tc.items) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5]);
      (rows[y] = rows[y] || []).push([it.transform[4], it.str]);
    }
    Object.keys(rows).map(Number).sort((a, b) => b - a).forEach((y) => {
      const line = rows[y].sort((a, b) => a[0] - b[0]).map((x) => x[1]).join(" ").replace(/\s+/g, " ").trim();
      if (line) out.push(line);
    });
  }
  return out;
}
