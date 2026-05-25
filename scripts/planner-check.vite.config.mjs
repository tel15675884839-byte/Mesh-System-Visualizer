import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  root: resolve('src/renderer'),
  publicDir: resolve('public'),
  plugins: [vue()],
  server: {
    host: '127.0.0.1'
  },
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  }
})
