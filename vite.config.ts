import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      external: ['vue/jsx-runtime'],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-i18next', 'i18next'],
          sdk: ['@lark-base-open/js-sdk']
        }
      }
    }
  }
})
