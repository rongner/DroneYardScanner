import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Drone Yard Scanner',
        short_name: 'DroneYard',
        description: 'Autonomous drone-based plant health monitoring',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          {
            // API reads — network first, fall back to cache for offline browsing
            urlPattern: /^\/api\/(yards|missions|scans\/mission|scans\/plants|scans\/plant-history|settings)/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-reads', networkTimeoutSeconds: 5 },
          },
          {
            // Photos — cache first; they never change once written
            urlPattern: /^\/api\/scans\/\d+\/photo/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'scan-photos',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // OpenStreetMap tiles — cache first for offline map viewing
            urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://localhost:8000', ws: true },
      '/healthz': 'http://localhost:8000',
    },
  },
})
