// next.config for the one-app upload (website + API in one Node app).
// package-one-app.js puts this in place of the website's own next.config.
//
// No /api rewrite: pages/api/[...path].js serves the API in this process.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The backend's code is compiled into the build, but its npm packages load
  // from node_modules at runtime as usual.
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
};

export default nextConfig;
