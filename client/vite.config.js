import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, /api calls go to the Express server on port 5000.
// BASE_PATH is set by the GitHub Pages workflow (the site lives under /chessday/).
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:5000" } },
});
