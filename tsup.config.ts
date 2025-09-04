import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { 'fiskil-link': 'src/index.ts' },
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
  format: ['esm', 'iife'],
  globalName: 'FiskilLink',
  outDir: 'dist',
  target: 'es2020',
  outExtension: ({ format }) => ({
    js: format === 'esm' ? '.mjs' : format === 'cjs' ? '.cjs' : '.umd.js',
  }),
});
