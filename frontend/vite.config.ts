import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  // graphql-js + Apollo Client superan el umbral por defecto de 500 kB.
  build: { chunkSizeWarningLimit: 800 },
});
