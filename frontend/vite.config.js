import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, Vite (puerto 5173) reenvía /api al backend Express (puerto 3000).
// "npm run build" deja la app compilada en frontend/dist, que sirve Express.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': process.env.VITE_API_PROXY || 'http://localhost:3000' }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // React y Bootstrap quedan en archivos aparte que el navegador guarda en caché
        manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], bootstrap: ['react-bootstrap'] }
      }
    }
  }
});
