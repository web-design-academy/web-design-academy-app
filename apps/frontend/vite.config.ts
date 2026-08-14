import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_BASE_URL || "/",
    plugins: [
      react(),
      mdx({
        remarkPlugins: [
          remarkFrontmatter,
          [remarkMdxFrontmatter, { name: "frontmatter" }],
        ],
      }),
      tsconfigPaths(),
    ],
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
      alias: {
        "@monaco-editor/react": path.resolve(
          __dirname,
          "node_modules/@monaco-editor/react",
        ),
      },
    },
    build: {
      outDir: "dist",
    },
  };
});
