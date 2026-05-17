/**
 * OpenAPI docs endpoint tests — NX-5 (#451).
 *
 * Covers:
 *   1. GET /api/v1/docs/openapi.json returns a valid OpenAPI 3.1 document
 *      (openapi field, info block, non-empty paths, the first-tranche
 *      endpoints present, security schemes present).
 *   2. GET /api/v1/docs serves the Swagger UI HTML.
 *   3. Both endpoints are PUBLIC — they return 200 with NO auth token.
 *   4. The buildOpenApiSpec() builder produces a structurally valid spec.
 *
 * No DB is involved — the docs endpoint serves a static spec built at
 * boot, so a plain supertest GET is sufficient (no Prisma, no mocks).
 */
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { buildOpenApiSpec } from '../openapi/openapi'

describe('NX-5 — GET /api/v1/docs/openapi.json (raw spec)', () => {
  it('returns 200 with a valid OpenAPI 3.1 document — no auth required', async () => {
    const res = await request(app).get('/api/v1/docs/openapi.json')
    expect(res.status).toBe(200)
    // OpenAPI 3.1 — the AC mandates 3.1.x.
    expect(typeof res.body.openapi).toBe('string')
    expect(res.body.openapi).toMatch(/^3\.1\./)
  })

  it('includes the info block (title + version)', async () => {
    const res = await request(app).get('/api/v1/docs/openapi.json')
    expect(res.body.info).toBeDefined()
    expect(typeof res.body.info.title).toBe('string')
    expect(res.body.info.title.length).toBeGreaterThan(0)
    expect(typeof res.body.info.version).toBe('string')
  })

  it('has a non-empty paths object', async () => {
    const res = await request(app).get('/api/v1/docs/openapi.json')
    expect(res.body.paths).toBeDefined()
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(0)
  })

  it('declares the /api/v1 server', async () => {
    const res = await request(app).get('/api/v1/docs/openapi.json')
    expect(Array.isArray(res.body.servers)).toBe(true)
    expect(res.body.servers.some((s: { url: string }) => s.url === '/api/v1')).toBe(true)
  })

  it('includes the security schemes (bearerAuth + mcpKey)', async () => {
    const res = await request(app).get('/api/v1/docs/openapi.json')
    const schemes = res.body.components?.securitySchemes ?? {}
    expect(schemes.bearerAuth).toBeDefined()
    expect(schemes.bearerAuth.type).toBe('http')
    expect(schemes.bearerAuth.scheme).toBe('bearer')
    expect(schemes.mcpKey).toBeDefined()
  })

  it('includes the shared SuccessEnvelope and ErrorEnvelope schemas', async () => {
    const res = await request(app).get('/api/v1/docs/openapi.json')
    const schemas = res.body.components?.schemas ?? {}
    expect(schemas.SuccessEnvelope).toBeDefined()
    expect(schemas.ErrorEnvelope).toBeDefined()
  })

  it('documents the first-tranche endpoints (auth, requirements, baselines, verification, certification)', async () => {
    const res = await request(app).get('/api/v1/docs/openapi.json')
    const paths = res.body.paths as Record<string, unknown>
    // One representative endpoint per first-tranche route file.
    expect(paths['/auth/login']).toBeDefined()
    expect(paths['/auth/reauth']).toBeDefined()
    expect(paths['/requirements/{projectId}']).toBeDefined()
    expect(paths['/baselines/{projectId}']).toBeDefined()
    expect(paths['/verification/moc']).toBeDefined()
    expect(paths['/certification/{projectId}/objectives']).toBeDefined()
  })

  it('marks /auth/login as public (security: [])', async () => {
    const res = await request(app).get('/api/v1/docs/openapi.json')
    const login = (res.body.paths['/auth/login'] as { post?: { security?: unknown[] } }).post
    expect(login).toBeDefined()
    // An empty security array overrides the global bearerAuth requirement.
    expect(Array.isArray(login!.security)).toBe(true)
    expect(login!.security!.length).toBe(0)
  })

  it('serves application/json', async () => {
    const res = await request(app).get('/api/v1/docs/openapi.json')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })
})

describe('NX-5 — GET /api/v1/docs (Swagger UI)', () => {
  it('returns 200 and serves HTML — no auth required', async () => {
    const res = await request(app).get('/api/v1/docs/')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/html/)
    // swagger-ui-express renders a page containing the Swagger UI markup.
    expect(res.text).toMatch(/swagger/i)
  })
})

describe('NX-5 — buildOpenApiSpec() builder', () => {
  it('produces a structurally valid OpenAPI 3.1 spec', () => {
    const spec = buildOpenApiSpec() as {
      openapi: string
      info: { title: string; version: string }
      paths: Record<string, unknown>
      components: { schemas: Record<string, unknown> }
    }
    expect(spec.openapi).toBe('3.1.0')
    expect(spec.info.title).toBeTruthy()
    expect(spec.info.version).toBeTruthy()
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0)
    expect(spec.components.schemas.SuccessEnvelope).toBeDefined()
    expect(spec.components.schemas.ErrorEnvelope).toBeDefined()
  })

  it('every documented operation has a tag and at least one response', () => {
    const spec = buildOpenApiSpec() as { paths: Record<string, Record<string, { tags?: string[]; responses?: Record<string, unknown> }>> }
    const methods = ['get', 'post', 'put', 'patch', 'delete']
    for (const [path, item] of Object.entries(spec.paths)) {
      for (const method of methods) {
        const op = item[method]
        if (!op) continue
        expect(op.tags, `${method.toUpperCase()} ${path} must have a tag`).toBeDefined()
        expect((op.tags ?? []).length, `${method.toUpperCase()} ${path} must have a tag`).toBeGreaterThan(0)
        expect(op.responses, `${method.toUpperCase()} ${path} must have responses`).toBeDefined()
        expect(Object.keys(op.responses ?? {}).length).toBeGreaterThan(0)
      }
    }
  })
})
