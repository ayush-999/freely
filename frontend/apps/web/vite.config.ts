import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Overridden in Docker (host.docker.internal:8000); defaults to the local backend.
const apiTarget = process.env.VITE_PROXY_TARGET || "http://localhost:8000"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
    // Ensure the linked workspace packages (@workspace/ui) share the app's
    // single React copy instead of getting their own bundled instance.
    dedupe: ["react", "react-dom"],
  },
  server: {
    // Bind mounts from Windows don't emit file events inside the container.
    watch: process.env.VITE_USE_POLLING ? { usePolling: true } : undefined,
    proxy: {
      // Forward API calls to the FastAPI backend (default port 8000,
      // routes live under /api/v1) so no CORS/env setup is needed in dev.
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/uploads": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
