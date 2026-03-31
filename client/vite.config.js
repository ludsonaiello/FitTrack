import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'FitTrack — Planet Fitness Tracker',
        short_name: 'FitTrack',
        description: 'Track workouts, plan sessions, and monitor progress',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        icons: [
          { src: 'favicon-16x16.png',         sizes: '16x16',   type: 'image/png' },
          { src: 'favicon-32x32.png',         sizes: '32x32',   type: 'image/png' },
          { src: 'apple-touch-icon.png',      sizes: '180x180', type: 'image/png' },
          { src: 'android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallbackDenylist: [/^\/oauth-login/, /^\/oauth/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/images\.ctfassets\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
})
