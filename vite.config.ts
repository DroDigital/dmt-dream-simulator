import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 6000 },
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as any);
