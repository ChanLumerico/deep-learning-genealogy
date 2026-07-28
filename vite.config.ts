import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', assetsDir: 'assets' },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
})
