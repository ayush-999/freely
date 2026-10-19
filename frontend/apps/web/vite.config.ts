import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

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
    proxy: {
      // Forward API calls to the FastAPI backend (default port 8000,
      // routes live under /api/v1) so no CORS/env setup is needed in dev.
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
})
