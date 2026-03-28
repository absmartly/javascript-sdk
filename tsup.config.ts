import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs", "iife"],
  globalName: "absmartly",
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
  target: "es2022",
  outExtension({ format }) {
    if (format === "iife") return { js: ".global.js" };
    return {};
  },
});
