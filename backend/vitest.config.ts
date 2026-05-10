import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    env: { NODE_ENV: 'test' },
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/controllers/**',
        'src/services/**',
        'src/middleware/**',
        'src/routes/**',
        'src/lib/**',
        'src/realtime/**',
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/__tests__/**',
        'src/scripts/**',
        'src/server.ts',
        'src/realtime/realtime.ts',
      ],
      // CI floor — `vitest run --coverage` exits non-zero when any of these
      // drops below the threshold. Set 1-2 points below the current measured
      // value so a no-op rebase does not flake; raise as new tests land.
      // Target to climb to: 50% lines.
      thresholds: {
        // CI measures coverage 1-3% lower than local because Windows
        // sometimes registers extra files that CI's Linux runner skips
        // due to env differences. Set the floor to match CI's actual
        // measured coverage rather than local. Local target stays 50%.
        statements: 45,
        branches: 30,
        functions: 47,
        lines: 46,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
