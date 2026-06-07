/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep these heavy Node-only libs out of the bundler so they load at runtime
  // intact (PDF text extraction + Excel generation in the Weekly P&L API).
  serverExternalPackages: ["pdfjs-dist", "exceljs"],
};

module.exports = nextConfig;
