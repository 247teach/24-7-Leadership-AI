import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Agent Hub — React + Vite. Dev server on 5173.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
})
