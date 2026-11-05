import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version: string };

export default defineConfig({
  entry: { 'fiskil-link': 'src/index.ts' },
  dts: true,
  define: { __SDK_VERSION__: JSON.stringify(version) },
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
