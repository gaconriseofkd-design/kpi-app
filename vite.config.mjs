// vite.config.mjs  (hoặc vite.config.js nếu type=module)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',   // 👈 đường dẫn tương đối cho local file:// protocol
  server: { port: 5173 }
})
