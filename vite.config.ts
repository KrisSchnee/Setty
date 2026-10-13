import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages serves the app at /<repo>/; local and most hosts use "/".
  base: process.env.VITE_BASE || '/',
  server: {
    port: 5173,
    strictPort: true,
  },
})
