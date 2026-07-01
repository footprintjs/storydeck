import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    coverage: {
      provider: 'v8',
      include: ['*.{js,jsx}', 'content/**/*.{js,jsx}'],
      exclude: ['**/*.test.{js,jsx}', 'index.js', 'vitest.config.js', 'vitest.setup.js'],
      reporter: ['text', 'text-summary'],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 95 },
    },
  },
});
