import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base '/shms/' để asset và router chạy sau gateway Nginx prefix /shms/.
export default defineConfig({
  base: '/shms/',
  plugins: [react()],
  server: {
    port: 3011,
    host: '127.0.0.1',
    proxy: {
      '/shms/api': { target: 'http://127.0.0.1:3010', changeOrigin: true },
    },
  },
});
