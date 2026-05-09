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
        // 50% target hit — lock in the floor at 48 lines / 47 stmts so
        // a passing rebase has a 2-point cushion without inviting drift.
        // Branches lag the others; raise gradually as fixes land.
        statements: 47,
        branches: 33,
        functions: 49,
        lines: 48,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
