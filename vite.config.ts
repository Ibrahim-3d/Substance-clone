import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages serves this project at /Substance-clone/.
// base is only applied to production builds so local dev stays at /.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/Substance-clone/" : "/",
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
}));
