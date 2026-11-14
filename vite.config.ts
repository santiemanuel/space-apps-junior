import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    // Phaser ocupa ~1.5 MB minificado; es esperado.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
