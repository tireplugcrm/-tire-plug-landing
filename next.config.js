/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep these heavy Node-only libs out of the bundler so they load at runtime
  // intact (PDF text extraction + Excel generation in the Weekly P&L API).
  serverExternalPackages: ["exceljs"],
  // The Manchester (South LA) location closed. Permanently redirect its old,
  // Google-indexed URL to the Olympic location page so links keep their value.
  async redirects() {
    return [
      { source: "/manchester", destination: "/olympic", permanent: true },
    ];
  },
};

module.exports = nextConfig;
