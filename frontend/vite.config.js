import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Geliştirmede /api istekleri backend'e (8000) proxy'lenir.
// Böylece CORS'a gerek kalmadan tek origin gibi çalışır.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET || "http://localhost:8000",
        changeOrigin: true,
        ws: true,   // WebSocket (/api/ws -> backend /ws) da proxy'lensin
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
