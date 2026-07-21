import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['embed/static/src/**/*.test.js'],
  },
});
