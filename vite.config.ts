import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_CONFIG } from './src/config/appConfig';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: null,
        includeAssets: ['icon-192.png', 'icon-512.png'],
        manifest: {
          name: `${APP_CONFIG.name} – ${APP_CONFIG.fullName} ${APP_CONFIG.schoolName}`,
          short_name: APP_CONFIG.shortName,
          description: `${APP_CONFIG.fullName} Terintegrasi ${APP_CONFIG.schoolName}`,
          theme_color: APP_CONFIG.themeColor,
          background_color: APP_CONFIG.backgroundColor,
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icon-192.png',
              type: 'image/png',
              sizes: '192x192',
              purpose: 'any maskable'
            },
            {
              src: '/icon-512.png',
              type: 'image/png',
              sizes: '512x512',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api/],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}']
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'recharts'],
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (
                id.includes('/react/') ||
                id.includes('/react-dom/') ||
                id.includes('/react-router/') ||
                id.includes('/react-router-dom/') ||
                id.includes('/scheduler/') ||
                id.includes('/@remix-run/router/') ||
                id.includes('/use-sync-external-store/')
              ) {
                return 'react-vendor';
              }
              if (id.includes('/firebase/')) {
                return 'firebase';
              }
              if (id.includes('jspdf') || id.includes('html2canvas')) {
                return 'pdf';
              }
              if (id.includes('xlsx') || id.includes('exceljs')) {
                return 'excel';
              }
              if (id.includes('recharts') || id.includes('d3')) {
                return 'charts';
              }
              if (id.includes('html5-qrcode') || id.includes('qrcode.react')) {
                return 'qr';
              }
              return 'vendor';
            }
          },
        },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
