// next.config for the one-app upload (website + API in one Node app).
// package-one-app.js puts this in place of the website's own next.config.
//
// /api goes to the API that instrumentation.js starts on a private loopback
// port. The address is fixed here rather than read from API_BASE_URL, so a
// stale variable in the host's settings cannot point the site elsewhere.
const INTERNAL_API = "http://127.0.0.1:41755";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The backend is compiled into the build (instrumentation imports it), but
  // its npm packages load from node_modules at runtime as usual.
  serverExternalPackages: [
    "mongoose",
    "express",
    "express-rate-limit",
    "helmet",
    "compression",
    "cors",
    "morgan",
    "bcryptjs",
    "jsonwebtoken",
    "qrcode",
    "dotenv",
    "zod",
  ],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${INTERNAL_API}/api/:path*` }];
  },
};

export default nextConfig;
