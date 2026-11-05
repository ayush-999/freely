import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// Overridden in Docker (host.docker.internal:8000); defaults to the local backend.
const apiTarget = process.env.VITE_PROXY_TARGET || "http://localhost:8000"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_")
  const extraOrigins: string[] = []
  if (env.VITE_API_BASE_URL && /^https?:\/\//.test(env.VITE_API_BASE_URL)) {
    const origin = new URL(env.VITE_API_BASE_URL)
    if (mode === "production" && origin.protocol !== "https:")
      throw new Error("Production API must use HTTPS")
    extraOrigins.push(origin.origin, origin.origin.replace(/^https:/, "wss:"))
  }
  const policy = `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' ${extraOrigins.join(" ")}; worker-src 'self' blob:; media-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'`
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "production-document-csp",
        apply: "build",
        transformIndexHtml: () => [
          {
            tag: "meta",
            attrs: { "http-equiv": "Content-Security-Policy", content: policy },
            injectTo: "head-prepend",
          },
        ],
      },
    ],
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
          ws: true,
        },
        "/uploads": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
