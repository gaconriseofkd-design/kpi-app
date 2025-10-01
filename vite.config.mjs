// vite.config.mjs  (hoặc vite.config.js nếu type=module)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',   // 👈 thêm dòng này để load đúng asset
  server: { port: 5173 }
})
