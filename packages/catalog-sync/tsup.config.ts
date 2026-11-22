import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/sync-orchestrator.ts', 'src/observability.ts', 'src/circuit-breaker.ts', 'src/fallback-chain.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  outDir: 'dist',
  platform: 'node',
  external: ['node-fetch', 'zod', '@nettoscorp/shared', 'crypto', 'fs', 'path', 'stream'],
});
