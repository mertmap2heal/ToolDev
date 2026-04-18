import { describe, it, expect } from 'vitest'
import { buildCorsOrigins } from '../server'

describe('buildCorsOrigins (#149)', () => {
  it('dev: includes localhost by default', () => {
    const out = buildCorsOrigins({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)
    expect(out).toContain('http://localhost:3000')
    expect(out).toContain('http://127.0.0.1:3000')
  })

  it('dev: includes APP_URL when set', () => {
    const out = buildCorsOrigins({
      NODE_ENV: 'development',
      APP_URL: 'https://staging.example.com',
    } as NodeJS.ProcessEnv)
    expect(out).toContain('https://staging.example.com')
    expect(out).toContain('http://localhost:3000')
  })

  it('production: EXCLUDES localhost when APP_URL set', () => {
    const out = buildCorsOrigins({
      NODE_ENV: 'production',
      APP_URL: 'https://app.example.com',
    } as NodeJS.ProcessEnv)
    expect(out).toEqual(['https://app.example.com'])
    expect(out).not.toContain('http://localhost:3000')
    expect(out).not.toContain('http://127.0.0.1:3000')
  })

  it('production: SOCKET_IO_ALLOWED_ORIGINS merges and splits on comma', () => {
    const out = buildCorsOrigins({
      NODE_ENV: 'production',
      APP_URL: 'https://app.example.com',
      SOCKET_IO_ALLOWED_ORIGINS: 'https://a.example.com,https://b.example.com',
    } as NodeJS.ProcessEnv)
    expect(out).toContain('https://app.example.com')
    expect(out).toContain('https://a.example.com')
    expect(out).toContain('https://b.example.com')
    expect(out).not.toContain('http://localhost:3000')
  })

  it('production: throws when no allowlist configured', () => {
    expect(() =>
      buildCorsOrigins({ NODE_ENV: 'production' } as NodeJS.ProcessEnv),
    ).toThrow(/CORS configuration error/)
  })
})
