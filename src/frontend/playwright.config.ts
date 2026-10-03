import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/integration",
  testMatch: "**/*.integration.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.TASKMANAGER_FRONTEND_URL ?? "http://localhost:5173",
    browserName: "chromium",
  },
});
