import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'singlefile' ? [viteSingleFile()] : [])],
  ...(mode === 'singlefile' ? {
    publicDir: false,
    build: { outDir: 'dist-singlefile' },
  } : {}),
}))
