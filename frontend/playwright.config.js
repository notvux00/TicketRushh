import { defineConfig } from "@playwright/test";
import process from "node:process";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  reporter: "line",
  outputDir: ".build/playwright-results",
  use: {
    baseURL: "http://127.0.0.1:18088",
    screenshot: "off",
    trace: "off",
    video: "off",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 18088 --strictPort",
    url: "http://127.0.0.1:18088",
    reuseExistingServer: false,
  },
});
