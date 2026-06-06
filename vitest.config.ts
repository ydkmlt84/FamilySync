import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: [
      "server/src/**/*.test.ts",
      "web/src/**/*.test.tsx",
      "scripts/**/*.test.ts",
    ],
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        statements: 30,
        branches: 15,
        functions: 30,
        lines: 30,
      },
      include: ["server/src/**/*.ts", "web/src/**/*.{ts,tsx}"],
      exclude: [
        "server/src/main.ts",
        "server/src/**/*.module.ts",
        "server/src/**/*.entity.ts",
        "web/src/main.tsx",
      ],
    },
  },
});
