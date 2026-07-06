import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Chrome extension popup build: single HTML entry, assets emitted to dist/.
// public/manifest.json + public/icons are copied verbatim by Vite.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: 'es2020',
    emptyOutDir: true,
  },
});
