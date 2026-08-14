import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "VisualEditor",
      fileName: "index"
    },
    rollupOptions: {
      external: ["react", "react-dom", "@monaco-editor/react"],
      output: {
        globals: {
          "@monaco-editor/react": "MonacoEditor",
          react: "React",
          "react-dom": "ReactDOM"
        }
      }
    }
  }
});
