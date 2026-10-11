import { defineConfig } from "vitest/config";
import path from "node:path";

const alias = {
  "@": path.resolve(import.meta.dirname, "src"),
};

export default defineConfig({
  resolve: { alias },
  esbuild: { jsx: "automatic" },
  test: {
    hookTimeout: 60000,
    testTimeout: 60000,
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          testTimeout: 60000,
          hookTimeout: 60000,
        },
      },
      {
        resolve: { alias },
        esbuild: { jsx: "automatic" },
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["tests/**/*.dom.test.tsx"],
          setupFiles: ["tests/setup/dom.ts"],
          testTimeout: 60000,
          hookTimeout: 60000,
        },
      },
    ],
  },
});
