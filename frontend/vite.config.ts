import fs from "fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Resolve backend target:
  // 1. Explicit environment variables (BACKEND_URL or VITE_BACKEND_URL)
  // 2. If running inside Docker container (/.dockerenv exists), default to http://backend:8000
  // 3. Otherwise (local host development), default to http://127.0.0.1:8000
  const isDocker = fs.existsSync("/.dockerenv");
  const defaultTarget = isDocker ? "http://backend:8000" : "http://127.0.0.1:8000";
  const target =
    process.env.BACKEND_URL ||
    process.env.VITE_BACKEND_URL ||
    env.BACKEND_URL ||
    env.VITE_BACKEND_URL ||
    defaultTarget;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});

