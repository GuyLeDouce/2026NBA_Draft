import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3000",
    channel: "chrome",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH },
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    serviceWorkers: "block",
  },
  webServer: {
    command: "npm start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
