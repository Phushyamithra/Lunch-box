import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Chrome extension build: the app page (index.html) plus the MV3 service
// worker (background.ts), which must land at a stable un-hashed path
// because manifest.json references it by name.
export default defineConfig({
  plugins: [react()],
  esbuild: {
    // Production hygiene: debug logging is dev-only, debugger never ships.
    drop: ['debugger'],
    pure: ['console.debug'],
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        // Split heavyweight vendors for better caching + startup profile.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('xlsx')) return 'xlsx';
          if (id.includes('@mui') || id.includes('@emotion')) return 'mui';
          if (id.includes('framer-motion')) return 'motion';
          return 'vendor';
        },
      },
    },
  },
});
