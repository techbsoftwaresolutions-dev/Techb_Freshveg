/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No floating "N" badge while developing (it never shows in production).
  devIndicators: false,
  async rewrites() {
    const api = process.env.API_BASE_URL || "http://localhost:5055";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
