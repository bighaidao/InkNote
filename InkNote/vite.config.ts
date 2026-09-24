import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // dev 依赖预构建同样要把 pdfjs-dist 的 Node 端原生依赖挡在 esbuild 之外，
  // 否则 optimizeDeps 会在 require("@napi-rs/canvas") 处因 .node 文件无 loader 而失败。
  optimizeDeps: {
    esbuildOptions: {
      plugins: [
        {
          name: "external-napi-canvas",
          setup(build) {
            build.onResolve({ filter: /^@napi-rs\/canvas/ }, (args) => ({
              path: args.path,
              external: true,
            }));
          },
        },
      ],
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    rollupOptions: {
      // pdfjs-dist 的 Node 端 canvas 工厂（原生 .node 二进制）只在 Node 运行时被引用，
      // 浏览器/WKWebView 永远不会执行该分支；external 化避免 Rollup 打包原生二进制。
      external: [/^@napi-rs\/canvas/],
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/@codemirror/") || id.includes("/@lezer/")) return "editor-core";
          if (id.includes("/highlight.js/")) return "syntax-highlight";
          if (id.includes("/katex/")) return "math-renderer";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) return "react-runtime";
          // 预览引擎不设 manualChunks：viewerBundle 经 dynamic import 加载，
          // Rollup 会自动把它与其依赖切成独立懒加载 chunk，手工分组反而制造循环警告
          return undefined;
        },
      },
    },
  },
}));
