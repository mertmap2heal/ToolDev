import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Use `npm run dev:tunnel` when exposing the dev server via ngrok (HTTPS → HMR must use wss:443).
const tunnelHmr = process.env.TUNNEL_HMR === '1'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    host: true,
    port: 3000,
    // Allow any tunnel hostname (ngrok, Cloudflare, etc.). A fixed list misses new ngrok regions/TLDs.
    allowedHosts: true,
    hmr: tunnelHmr
      ? {
          protocol: 'wss',
          clientPort: 443,
        }
      : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
