import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    open: true
  },
  publicDir: false, // We'll manually copy what we need
  // Copy the JS lib files since they're loaded as non-module scripts
  define: {
    __COPY_LIB_FILES__: 'true'
  }
});
