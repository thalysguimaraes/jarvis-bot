import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.wrangler'],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules',
        'tests',
        '*.config.ts',
        '*.config.js',
        'src/types',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 75,
          lines: 80,
          statements: 80,
        },
        'src/modules/portfolio-tracker/': {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'src/modules/fund-tracker/': {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@domains': path.resolve(__dirname, './src/domains'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@services': path.resolve(__dirname, './src/services'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
});