// @ts-check
const { defineConfig, devices } = require("@playwright/test");

const baseURL = process.env.BASE_URL || "http://127.0.0.1:4173";

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 7_500,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run serve",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 10_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
