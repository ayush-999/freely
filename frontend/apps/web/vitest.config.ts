import { resolve } from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "./src") },
    dedupe: ["react", "react-dom"],
  },
  test: {
    // Keep Radix's React imports in Vite's deduplicated module graph. Native
    // externalization can otherwise load another React instance through a
    // differently cased Windows workspace path.
    server: { deps: { inline: [/@radix-ui\//] } },
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/unit/setup.ts"],
    restoreMocks: true,
  },
})
