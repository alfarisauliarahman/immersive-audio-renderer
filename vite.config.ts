import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  publicDir: "dolby_atmos_chat_export/attachments",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
});
