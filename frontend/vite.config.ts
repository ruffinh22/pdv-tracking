import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// @ts-ignore
const __dirname = path.resolve();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Sépare les grosses libs tierces (chargées seulement sur les pages qui en ont besoin,
    // grâce au lazy-loading des routes dans App.tsx) de la logique applicative, pour que le
    // navigateur les mette en cache indépendamment et les télécharge en parallèle.
    rollupOptions: {
      output: {
        manualChunks: {
          leaflet: ['leaflet'],
          charts: ['recharts'],
          vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
