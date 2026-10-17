import { defineConfig, devices } from '@playwright/test';

// End-to-end tests in a real browser, at phone and desktop width (SPEC.md → Kalite).
// Without Supabase keys the app uses its same-browser transport, so online games run between two tabs.
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.results',
  timeout: 60_000,
  fullyParallel: false,
  use: { baseURL: 'http://localhost:5179', trace: 'retain-on-failure' },
  projects: [
    { name: 'telefon', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'masaüstü', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'npx vite --port 5179 --strictPort',
    url: 'http://localhost:5179',
    reuseExistingServer: true,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
});
