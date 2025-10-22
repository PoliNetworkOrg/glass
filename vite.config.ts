import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@polinetwork/glass": path.resolve(__dirname, "./packages/glass/src/index.ts"),
    },
  },
  base: "/glass/",
  optimizeDeps: {
    exclude: ["@polinetwork/glass"],
  },
})
