import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base '/' - deploy tại root domain shms.tuanserver.win/
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 3011,
    host: '127.0.0.1',
    proxy: {
      '/api': { target: 'http://127.0.0.1:3010', changeOrigin: true },
    },
  },
});
