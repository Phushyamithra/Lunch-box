import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Web/PWA build of the platform (deployed to Vercel). Lives beside the
// Chrome extension build (vite.config.ts) and shares src/ (theme, models)
// with it; the extension build is unaffected by anything here.
export default defineConfig({
  root: resolve(__dirname, 'web'),
  envDir: __dirname,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Tracker',
        short_name: 'Tracker',
        description: 'Meals, fitness, finance and goals in one place.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0E1C20',
        theme_color: '#0E1C20',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only. Supabase API traffic is never cached by the
        // service worker — cloud data must not be served stale silently.
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  esbuild: {
    drop: ['debugger'],
    pure: ['console.debug'],
  },
  // Scan every source file at startup, including lazy routes, so the dev
  // server never discovers a new dependency mid-session (that forces a
  // re-bundle and briefly loads two copies of React: "Invalid hook call").
  optimizeDeps: { entries: ['src/**/*.tsx'] },
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
  build: {
    outDir: resolve(__dirname, 'dist-web'),
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@mui') || id.includes('@emotion')) return 'mui';
          if (id.includes('@supabase')) return 'supabase';
          return 'vendor';
        },
      },
    },
  },
});
