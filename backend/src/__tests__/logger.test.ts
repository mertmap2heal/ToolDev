/**
 * Tests for #42 — structured JSON logger and X-Request-Id middleware.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { logger, setRequestId, getRequestId } from '../lib/logger'

describe('Structured logger — JSON output (#42)', () => {
  it('logger.info writes a valid JSON record to stdout', () => {
    const writes: string[] = []
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      writes.push(typeof chunk === 'string' ? chunk : chunk.toString())
      return true
    })

    logger.info('test_event', { foo: 'bar' })
    spy.mockRestore()

    expect(writes.length).toBeGreaterThan(0)
    const parsed = JSON.parse(writes[0])
    expect(parsed.level).toBe('info')
    expect(parsed.event).toBe('test_event')
    expect(parsed.foo).toBe('bar')
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('logger.error writes to stderr', () => {
    const writes: string[] = []
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      writes.push(typeof chunk === 'string' ? chunk : chunk.toString())
      return true
    })

    logger.error('test_error', { error: 'boom' })
    spy.mockRestore()

    expect(writes.length).toBeGreaterThan(0)
    const parsed = JSON.parse(writes[0])
    expect(parsed.level).toBe('error')
    expect(parsed.event).toBe('test_error')
  })

  it('logger sanitizes newlines in string values', () => {
    const writes: string[] = []
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      writes.push(typeof chunk === 'string' ? chunk : chunk.toString())
      return true
    })

    logger.warn('newline_test', { msg: 'line1\nline2\r\nline3' })
    spy.mockRestore()

    const parsed = JSON.parse(writes[0])
    expect(parsed.msg).not.toContain('\n')
    expect(parsed.msg).not.toContain('\r')
  })

  it('logger includes requestId when set', () => {
    setRequestId('test-req-id-123')
    const writes: string[] = []
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      writes.push(typeof chunk === 'string' ? chunk : chunk.toString())
      return true
    })

    logger.info('with_request_id')
    spy.mockRestore()
    setRequestId(undefined)

    const parsed = JSON.parse(writes[0])
    expect(parsed.requestId).toBe('test-req-id-123')
  })
})

describe('X-Request-Id middleware (#42)', () => {
  it('response includes X-Request-Id header', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['x-request-id']).toBeDefined()
    // UUID format
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
  })

  it('echoes a client-supplied X-Request-Id', async () => {
    const clientId = 'client-provided-id-abc'
    const res = await request(app)
      .get('/api/health')
      .set('X-Request-Id', clientId)
    expect(res.headers['x-request-id']).toBe(clientId)
  })
})
