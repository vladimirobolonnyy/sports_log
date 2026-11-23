import { defineConfig, devices } from '@playwright/test';

// End-to-end tests against the production build (with the service worker): desktop Chrome and Chrome with an iPhone
// viewport and touch. WebKit (the engine of Safari on iOS) is opt-in with PW_WEBKIT=1: Playwright's WebKit build
// crashes on launch on macOS 26.0 (checked with Playwright 1.65.1), so it cannot be a default here.
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    // No timezoneId: the browser must see the same «today» as the test code running in Node.
    locale: 'ru-RU',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile-chrome', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', channel: 'chrome' } },
    ...(process.env.PW_WEBKIT ? [{ name: 'iphone-webkit', use: { ...devices['iPhone 13'] } }] : []),
  ],
});
