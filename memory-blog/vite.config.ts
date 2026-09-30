import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.MEMORY_BASE_PATH || '/',
  plugins: [react()],
  build: {
    sourcemap: false,
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          markdown: ['react-markdown', 'remark-gfm', 'rehype-raw', 'rehype-sanitize'],
          motion: ['framer-motion']
        }
      }
    }
  },
  server: { host: '127.0.0.1', port: 4173, strictPort: true }
});
