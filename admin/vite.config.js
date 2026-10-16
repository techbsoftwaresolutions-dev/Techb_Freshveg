import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    // Dev requests go to the API through this proxy, so the browser only ever
    // talks to one origin and there is no CORS story in development.
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET || "http://localhost:5055",
        changeOrigin: true,
      },
    },
  },
});
