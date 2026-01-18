// This file sets up window.env BEFORE any other code runs
// It must be the first setup file in vitest.config.ts

// Define window.env for environment configuration
Object.defineProperty(window, 'env', {
  value: {
    API_URL: 'http://localhost:3000',
    CLIENT_ID: 'test-client-id',
    BASE_PATH: '/',
    GA_ID: '',
  },
  writable: true,
  configurable: true,
});

// Mock window.location if needed
if (!window.location) {
  Object.defineProperty(window, 'location', {
    value: {
      pathname: '/',
      href: 'http://localhost:3000/',
      origin: 'http://localhost:3000',
      search: '',
      hash: '',
    },
    writable: true,
    configurable: true,
  });
}
