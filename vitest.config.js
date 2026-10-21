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
      include: ['*.{js,jsx}', 'content/**/*.{js,jsx}', 'deck/**/*.js'],
      // site/** is the demo site + the deck-stage web component runtime; the
      // coverage contract covers the library layer (deckStage.test.js drives
      // the engine's additive-build machine behaviorally, not for coverage).
      exclude: ['**/*.test.{js,jsx}', 'index.js', 'deck/index.js', 'deck/bin.js', 'deck/test/**', 'vitest.config.js', 'vitest.setup.js', 'site/**'],
      reporter: ['text', 'text-summary'],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 95 },
    },
  },
});
