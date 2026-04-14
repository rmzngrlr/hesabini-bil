import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  server: {
    port: 3002,
  },
  preview: {
    port: 3002,
  },
  resolve: {
    alias: {
      // Use the resolved path for 'xlsx' to ensure we pick up the correct file
      // even if the package.json "module" field isn't picked up by some tools
      xlsx: path.resolve('node_modules/xlsx/xlsx.mjs'),
    },
  },
  optimizeDeps: {
    include: ['xlsx'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Hesabını Bil!',
        short_name: 'HesabınıBil',
        description: 'Kişisel Bütçe ve Altın Takip Uygulaması',
        theme_color: '#020817',
        background_color: '#020817',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml'
          },
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
