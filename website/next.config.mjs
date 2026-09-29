/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The browser talks only to this origin; Next forwards /api to the backend.
  // Keeps CORS out of the picture and means the API host is never baked into
  // the shipped HTML.
  async rewrites() {
    const api = process.env.API_BASE_URL || "http://localhost:5055";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
