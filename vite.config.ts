import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  root: 'app',
  // The build is served from GitHub Pages at https://codeviants-lab.github.io/chess/; dev and e2e stay at /.
  base: command === 'build' ? '/chess/' : '/',
  build: { outDir: '../dist', emptyOutDir: true },
}));
