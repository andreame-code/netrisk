import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    environment: 'node',
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@netrisk/core': path.resolve(__dirname, './src'),
    },
  },
});
