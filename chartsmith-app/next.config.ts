import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: {
    position: "bottom-right",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  // Keep Node.js-only packages as external (not bundled)
  // Required for pg (PostgreSQL) which uses 'dns' and other Node.js modules
  serverExternalPackages: ['pg', 'pg-native'],
};

export default nextConfig;
