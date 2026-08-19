import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Locally held research fixtures are convenient in the dev server but must
  // never be copied into a production bundle or public release artifact.
  publicDir: command === "serve" ? "dolby_atmos_chat_export/attachments" : false,
  clearScreen: false,
  build: {
    emptyOutDir: true,
  },
  server: {
    port: 1420,
    strictPort: true,
  },
}));
