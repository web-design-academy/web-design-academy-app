import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from "@mdx-js/rollup";

export default defineConfig({
  base: './',
  plugins: [
    mdx(),
    react(),
  ],
  optimizeDeps: {
    include: ["react-dnd", "react-dnd-html5-backend"],
  }
});