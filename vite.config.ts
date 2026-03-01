import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { comlink } from "vite-plugin-comlink";
import path from "node:path";

export default defineConfig({
  plugins: [comlink(), react(), tailwindcss()],
  worker: {
    plugins: () => [comlink()],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom") || id.includes("react-router")) return "react";
            if (id.includes("framer-motion")) return "motion";
            if (id.includes("/d3")) return "d3";
            if (id.includes("radix-ui") || id.includes("lucide-react")) return "ui";
            if (id.includes("dexie") || id.includes("zustand") || id.includes("comlink") || id.includes("fflate")) return "data";
          }
        },
      },
    },
  },
});
