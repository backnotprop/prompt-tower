import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "release",
    rollupOptions: {
      output: {
        entryFileNames: "index.js",
        assetFileNames: "index.[ext]",
      },
    },
  },
});
