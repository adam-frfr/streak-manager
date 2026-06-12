import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // '/' for local dev, '/streak-manager/' for GitHub Pages production build
  base: command === 'serve' ? '/' : '/streak-manager/',
}))
