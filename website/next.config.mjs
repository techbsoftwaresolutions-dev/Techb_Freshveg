import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const api = process.env.API_BASE_URL || "http://localhost:5055";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
};

// A production build must not overwrite files used by a running dev server.
export default (phase) => ({
  ...nextConfig,
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
});
