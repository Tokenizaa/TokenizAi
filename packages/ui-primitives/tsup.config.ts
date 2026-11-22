import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  outDir: 'dist',
  platform: 'browser',
  external: [
    'react',
    'react-dom',
    'tailwindcss',
    'clsx',
    'tailwind-merge',
    'class-variance-authority',
    '@radix-ui/react-dialog',
    '@radix-ui/react-dropdown-menu',
    '@radix-ui/react-slot',
  ],
});
