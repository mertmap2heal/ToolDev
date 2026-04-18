import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    env: { NODE_ENV: 'test' },
    include: ['src/**/*.test.ts'],
    // Shared DB + advisory lock + global findMany — run files sequentially
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
