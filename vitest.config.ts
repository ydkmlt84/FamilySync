import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: [
      "app/server/src/**/*.test.ts",
      "app/ui/src/**/*.test.{ts,tsx}",
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
      include: ["app/server/src/**/*.ts", "app/ui/src/**/*.{ts,tsx}"],
      exclude: [
        "app/server/src/main.ts",
        "app/server/src/dev.ts",
        "app/server/src/**/*.module.ts",
        "app/server/src/**/*.entity.ts",
        "app/ui/src/main.tsx",
      ],
    },
  },
});
