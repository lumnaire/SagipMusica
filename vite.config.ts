import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Fixed port so the OAuth redirect URLs registered in Supabase/Google
    // Cloud Console don't go stale when another local project occupies
    // Vite's default 5173. strictPort fails loudly instead of silently
    // shifting to a different port that isn't registered anywhere.
    port: 5190,
    strictPort: true,
  },
})
