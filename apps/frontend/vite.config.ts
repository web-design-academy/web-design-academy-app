import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_BASE_URL || "/",
    plugins: [react()],
    server: {
      host: true,
      proxy: {
        "/api": {
          target: env.VITE_PROXY_TARGET || "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
    resolve: {
      tsconfigPaths: true,
      alias: {
        "@monaco-editor/react": path.resolve(
          import.meta.dirname,
          "node_modules/@monaco-editor/react",
        ),
      },
    },
    build: {
      outDir: "dist",
    },
  };
});
