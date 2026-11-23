/// <reference types="vite/client" />

import { resolve } from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"
import pkg from "./package.json" with { type: "json" }

// Dependencies and peers are installed next to the package, so they stay out of the bundle (subpaths included,
// e.g. react/jsx-runtime and motion/react): consumers then share a single copy of each.
const external = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)]

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    dts({
      tsconfigPath: "tsconfig.lib.json",
    }),
  ],
  build: {
    copyPublicDir: false,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      fileName: "index",
      formats: ["es"],
    },
    rollupOptions: {
      external: (id) => external.some((dep) => id === dep || id.startsWith(`${dep}/`)),
    },
  },
})
