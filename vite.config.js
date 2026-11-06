import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  // GitHub Pages serves the site from https://datodia.github.io/Groove-Mood/
  base: command === 'build' || isPreview ? '/Groove-Mood/' : '/',
}))
