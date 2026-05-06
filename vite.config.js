/**
 * vite.config.js
 *
 * Vite build configuration for the Kytos frontend.
 *
 * Dev-server proxy: All requests to /api/* are forwarded to the FastAPI backend
 * running at http://127.0.0.1:8000, enabling seamless local development without
 * CORS issues and without hardcoding the API base URL in source files.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
