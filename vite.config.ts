import { defineConfig } from 'vitest/config';
import { glslSlim } from './tools/vite-plugin-glsl-slim';
import { falHero } from './tools/vite-plugin-fal';

export default defineConfig({
  base: './',
  plugins: [glslSlim(), falHero()],
  server: {
    port: 5173,
    watch: { ignored: ['**/trailer/**', '**/dist/**', '**/docs/**'] },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
