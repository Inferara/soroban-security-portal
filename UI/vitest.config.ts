import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/env-setup.ts', './src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'e2e'],
    server: {
      deps: {
        // Inline MUI packages to handle their CSS imports in tests
        inline: [/@mui\/x-data-grid/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/__tests__/**',
        'src/**/index.ts', // barrel exports
      ],
      // Initial thresholds - increase as more tests are added
      thresholds: {
        // Thresholds are set low initially as we're building up test coverage
        // Target: Gradually increase to 60%+ as more page components are tested
        lines: 8,
        functions: 5,
        branches: 7,
        statements: 8,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': '/src',
      // Mock CSS imports from node_modules
      '@mui/x-data-grid/esm/index.css': './src/__tests__/__mocks__/style.ts',
    },
  },
});
