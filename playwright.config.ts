import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'list',
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
    },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  use: {
    baseURL: 'http://127.0.0.1:4317',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4317 --strictPort',
    url: 'http://127.0.0.1:4317',
    reuseExistingServer: false,
  },
});
