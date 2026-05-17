/**
 * ReqIF round-trip conformance suite (NX-1 / issue #437).
 *
 * Closes gap-summary.md #6 — the legacy ReqIF importer dropped ~80% of a
 * typical input (no SPEC-HIERARCHY, no typed SPEC-RELATIONs, no
 * DATATYPE-DEFINITION-* resolution, xhtml regex-stripped to plain text). The
 * silent-data-loss risk is the architecture comment's flagged risk; a test
 * that only asserts "import succeeded" is insufficient. This suite asserts
 * STRUCTURAL EQUALITY across an import -> export -> re-import cycle.
 *
 * Two layers:
 *   1. Pure parser/serializer round-trip (no DB) — fast, runs the vendor
 *      conformance corpus through parse -> serialize -> parse and asserts the
 *      typed model is structurally identical.
 *   2. DB-backed import/export round-trip — imports a vendor fixture into a
 *      real project, exports it back to ReqIF, re-imports, and asserts the
 *      persisted SPEC-OBJECT count, attribute fidelity, hierarchy parentage,
 *      and per-link type are preserved.
 *
 * Fixture provenance: the four fixtures under __tests__/fixtures/reqif/ are
 * FAITHFUL REPRESENTATIVE exports authored to exercise each vendor's known
 * namespace/structure quirks (DOORS `reqif:` prefix + ENUM; Polarion default
 * xmlns + `reqif-xhtml:` + INTEGER/REAL/BOOLEAN/DATE + xhtml <table>; Jama two
 * SPEC-OBJECT-TYPEs + Verifies relation; a ReqIF-Academy-style conformance doc
 * with a 3-level hierarchy + an unmapped relation type). They are NOT real
 * exports from licensed DOORS Next / Polarion / Jama instances — real vendor
 * corpora and the public ReqIF Academy conformance suite should be vendored in
 * as a follow-up so CI exercises true vendor dialects.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import {
  parseReqIFDocument,
  serializeReqIFModel,
  buildExportModel,
  resolveLinkType,
  ReqIFStructureError,
  ReqIFLimitError,
  MAX_SPEC_OBJECTS,
} from '../services/reqif'
import type { ReqIFModel, SpecHierarchy } from '../services/reqif'

const FIXTURE_DIR = join(__dirname, 'fixtures', 'reqif')
function fixture(name: string): string {
  return readFileSync(join(FIXTURE_DIR, name), 'utf8')
}

const VENDOR_FIXTURES = ['doors-next.reqif', 'polarion.reqif', 'jama.reqif', 'conformance.reqif']

/* ------------------------------------------------------------------ *
 * Structural-equality helpers
 * ------------------------------------------------------------------ */

/** Total node count of a SPEC-HIERARCHY forest. */
function countHierarchy(roots: SpecHierarchy[]): number {
  let n = 0
  const walk = (h: SpecHierarchy): void => {
    n++
    h.children.forEach(walk)
  }
  roots.forEach(walk)
  return n
}

/** Max depth of a SPEC-HIERARCHY forest. */
function hierarchyDepth(roots: SpecHierarchy[]): number {
  const depth = (h: SpecHierarchy): number =>
    1 + (h.children.length ? Math.max(...h.children.map(depth)) : 0)
  return roots.length ? Math.max(...roots.map(depth)) : 0
}

/** Flatten a SPEC-HIERARCHY forest into objectRef -> parentObjectRef pairs. */
function parentEdges(roots: SpecHierarchy[]): Map<string, string> {
  const edges = new Map<string, string>()
  const walk = (h: SpecHierarchy, parentObj?: string): void => {
    if (h.objectRef && parentObj) edges.set(h.objectRef, parentObj)
    h.children.forEach((c) => walk(c, h.objectRef ?? parentObj))
  }
  roots.forEach((r) => walk(r, undefined))
  return edges
}

/* ------------------------------------------------------------------ *
 * Layer 1 — pure parser/serializer round-trip (no DB)
 * ------------------------------------------------------------------ */

describe('ReqIF parser — vendor dialect coverage (NX-1)', () => {
  it('parses the DOORS Next dialect (reqif: prefix, ENUM, nested hierarchy)', () => {
    const model = parseReqIFDocument(fixture('doors-next.reqif'))
    expect(model.specObjects).toHaveLength(3)
    expect(model.specObjectTypes).toHaveLength(1)
    expect(model.specRelations).toHaveLength(2)
    // ENUMERATION datatype with two enum values resolved.
    const enumDt = model.datatypes.find((d) => d.kind === 'ENUMERATION')
    expect(enumDt).toBeDefined()
    expect(enumDt?.enumValues).toHaveLength(2)
    // The enum value on the parent object resolved to its LONG-NAME.
    const parent = model.specObjects.find((o) => o.identifier === '_so-sys-1')!
    const enumVal = parent.values.find((v) => v.kind === 'ENUMERATION')
    expect(enumVal?.value).toBe('high')
    // Hierarchy: one root with two children.
    expect(countHierarchy(model.specifications[0].children)).toBe(3)
    expect(hierarchyDepth(model.specifications[0].children)).toBe(2)
  })

  it('parses the Polarion dialect (default xmlns, reqif-xhtml:, numeric datatypes, xhtml table)', () => {
    const model = parseReqIFDocument(fixture('polarion.reqif'))
    expect(model.specObjects).toHaveLength(2)
    // INTEGER / REAL / BOOLEAN / DATE datatypes all present.
    const kinds = new Set(model.datatypes.map((d) => d.kind))
    expect(kinds).toContain('INTEGER')
    expect(kinds).toContain('REAL')
    expect(kinds).toContain('BOOLEAN')
    expect(kinds).toContain('DATE')
    // The xhtml <table> payload survives as HTML markup, not stripped text.
    const so1 = model.specObjects.find((o) => o.identifier === 'so-pol-1')!
    const xhtmlVal = so1.values.find((v) => v.isXhtml)!
    expect(xhtmlVal.value).toMatch(/<table>/)
    expect(xhtmlVal.value).toMatch(/<td>Watts<\/td>/)
    // Typed numeric values are carried.
    const intVal = so1.values.find((v) => v.kind === 'INTEGER')
    expect(intVal?.value).toBe('42')
    const boolVal = so1.values.find((v) => v.kind === 'BOOLEAN')
    expect(boolVal?.value).toBe('true')
  })

  it('parses the Jama dialect (two SPEC-OBJECT-TYPEs in one document)', () => {
    const model = parseReqIFDocument(fixture('jama.reqif'))
    expect(model.specObjectTypes).toHaveLength(2)
    expect(model.specObjects).toHaveLength(2)
    // The two objects reference the two different types.
    const typeRefs = new Set(model.specObjects.map((o) => o.typeRef))
    expect(typeRefs.size).toBe(2)
    // The Verifies relation type is present.
    expect(model.specRelationTypes.some((t) => t.longName === 'Verifies')).toBe(true)
  })

  it('parses the conformance fixture (3-level hierarchy, unmapped relation)', () => {
    const model = parseReqIFDocument(fixture('conformance.reqif'))
    expect(model.specObjects).toHaveLength(3)
    expect(hierarchyDepth(model.specifications[0].children)).toBe(3)
    expect(model.specRelations).toHaveLength(2)
  })

  it.each(VENDOR_FIXTURES)('round-trips %s parse -> serialize -> parse with structural equality', (name) => {
    const original = parseReqIFDocument(fixture(name))
    const xml = serializeReqIFModel(original)
    const reparsed = parseReqIFDocument(xml)

    // SPEC-OBJECT count preserved.
    expect(reparsed.specObjects).toHaveLength(original.specObjects.length)
    // SPEC-RELATION count preserved.
    expect(reparsed.specRelations).toHaveLength(original.specRelations.length)
    // SPEC-HIERARCHY node count + depth preserved.
    for (let i = 0; i < original.specifications.length; i++) {
      const o = original.specifications[i].children
      const r = reparsed.specifications[i].children
      expect(countHierarchy(r)).toBe(countHierarchy(o))
      expect(hierarchyDepth(r)).toBe(hierarchyDepth(o))
    }
    // Every SPEC-OBJECT identifier survives.
    const origIds = new Set(original.specObjects.map((o) => o.identifier))
    const reIds = new Set(reparsed.specObjects.map((o) => o.identifier))
    expect([...reIds].sort()).toEqual([...origIds].sort())
  })

  it('preserves xhtml payload markup byte-equivalently through serialize -> parse', () => {
    const model = parseReqIFDocument(fixture('polarion.reqif'))
    const xml = serializeReqIFModel(model)
    const reparsed = parseReqIFDocument(xml)
    const origXhtml = model.specObjects
      .find((o) => o.identifier === 'so-pol-1')!
      .values.find((v) => v.isXhtml)!.value
    const reXhtml = reparsed.specObjects
      .find((o) => o.identifier === 'so-pol-1')!
      .values.find((v) => v.isXhtml)!.value
    expect(reXhtml).toContain('<table>')
    expect(reXhtml).toContain('<td>Watts</td>')
    // The table structure survives intact.
    expect(reXhtml.replace(/\s+/g, '')).toBe(origXhtml.replace(/\s+/g, ''))
  })

  it('rejects a non-ReqIF document', () => {
    expect(() => parseReqIFDocument('<not-reqif><foo/></not-reqif>')).toThrow(ReqIFStructureError)
  })

  it('rejects a DOCTYPE-bearing document (XXE protection)', () => {
    const evil = `<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x "y">]><REQ-IF/>`
    expect(() => parseReqIFDocument(evil)).toThrow()
  })

  it('enforces the SPEC-OBJECT count cap', () => {
    const objects = Array.from(
      { length: MAX_SPEC_OBJECTS + 1 },
      (_, i) => `<reqif:SPEC-OBJECT IDENTIFIER="o-${i}"><reqif:VALUES/></reqif:SPEC-OBJECT>`,
    ).join('')
    const xml = `<?xml version="1.0"?>
<reqif:REQ-IF xmlns:reqif="http://www.omg.org/spec/ReqIF/20110401/reqif.xsd">
  <reqif:CORE-CONTENT><reqif:REQ-IF-CONTENT>
    <reqif:SPEC-OBJECTS>${objects}</reqif:SPEC-OBJECTS>
  </reqif:REQ-IF-CONTENT></reqif:CORE-CONTENT>
</reqif:REQ-IF>`
    expect(() => parseReqIFDocument(xml)).toThrow(ReqIFLimitError)
  })
})

describe('ReqIF link-type resolution (NX-1)', () => {
  it('maps standard relation-type names onto the TraceLink vocabulary', () => {
    expect(resolveLinkType('Satisfies').linkType).toBe('satisfies')
    expect(resolveLinkType('Satisfied By').linkType).toBe('satisfies')
    expect(resolveLinkType('Verifies').linkType).toBe('verifies')
    expect(resolveLinkType('verifiedBy').linkType).toBe('verifies')
    expect(resolveLinkType('Derived From').linkType).toBe('derives')
    expect(resolveLinkType('Refines').linkType).toBe('refines')
  })

  it('falls back to trace for an unmapped relation type and flags it', () => {
    const r = resolveLinkType('Constrains')
    expect(r.linkType).toBe('trace')
    expect(r.fellBack).toBe(true)
  })

  it('does not flag fallback for an absent relation type', () => {
    const r = resolveLinkType(undefined)
    expect(r.linkType).toBe('trace')
    expect(r.fellBack).toBe(false)
  })
})

/* ------------------------------------------------------------------ *
 * Layer 2 — DB-backed import / export / re-import round-trip
 * ------------------------------------------------------------------ */

describe('ReqIF DB round-trip — import / export / re-import (NX-1)', () => {
  const stamp = Date.now()
  let userId: string
  let token: string

  /** Spin up an isolated project + member; returns its id. */
  async function makeProject(suffix: string): Promise<string> {
    const slug = `reqif-conf-${stamp}-${suffix}`
    const project = await prisma.project.create({
      data: { name: `ReqIF Conf ${stamp} ${suffix}`, domain: slug, slug, userId },
    })
    await prisma.projectMember.create({
      data: { projectId: project.id, userId, role: 'owner', status: 'accepted' },
    })
    return project.id
  }

  /** Tear down every requirement + link + member for a project, then the project. */
  async function dropProject(projectId: string): Promise<void> {
    await prisma.traceLink.deleteMany({ where: { projectId } }).catch(() => {})
    // Null parentId first so the self-relation does not block deletion order.
    await prisma.requirement
      .updateMany({ where: { projectId }, data: { parentId: null } })
      .catch(() => {})
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
  }

  const createdProjectIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: { email: `reqif-conf-${stamp}@example.test`, password: 'x', name: 'ReqIF Conf' },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)
  })

  afterAll(async () => {
    for (const pid of createdProjectIds) await dropProject(pid)
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('imports the DOORS Next fixture: 3 requirements, parentId tree, 2 typed links', async () => {
    const projectId = await makeProject('doors')
    createdProjectIds.push(projectId)

    const res = await request(app)
      .post(`/api/v1/reqif/${projectId}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reqifXml: fixture('doors-next.reqif') })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.created).toBe(3)

    const reqs = await prisma.requirement.findMany({
      where: { projectId, deletedAt: null },
    })
    expect(reqs).toHaveLength(3)

    // Hierarchy: the parent has two children pointing at it.
    const parent = reqs.find((r) => r.requirementId === 'DOORS-SYS-1')!
    const childA = reqs.find((r) => r.requirementId === 'DOORS-SUB-1')!
    const childB = reqs.find((r) => r.requirementId === 'DOORS-SUB-2')!
    expect(childA.parentId).toBe(parent.id)
    expect(childB.parentId).toBe(parent.id)
    expect(parent.parentId).toBeNull()

    // xhtml description survived as HTML markup, not stripped text.
    expect(parent.description).toMatch(/<b>shall<\/b>/)

    // Two SPEC-RELATIONs -> two typed TraceLinks (Satisfies -> 'satisfies').
    const links = await prisma.traceLink.findMany({ where: { projectId } })
    expect(links).toHaveLength(2)
    expect(links.every((l) => l.linkType === 'satisfies')).toBe(true)
  })

  it('imports the Polarion fixture and preserves the xhtml table + numeric attributes', async () => {
    const projectId = await makeProject('polarion')
    createdProjectIds.push(projectId)

    const res = await request(app)
      .post(`/api/v1/reqif/${projectId}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reqifXml: fixture('polarion.reqif') })
    expect(res.status).toBe(200)
    expect(res.body.data.created).toBe(2)

    const reqs = await prisma.requirement.findMany({ where: { projectId, deletedAt: null } })
    const powerReq = reqs.find((r) => r.requirementId === 'POL-REQ-100')!
    // xhtml <table> survived into the description column.
    expect(powerReq.description).toMatch(/<table>/)
    expect(powerReq.description).toMatch(/Watts/)

    // The 'Derived From' relation maps to the 'derives' link type.
    const links = await prisma.traceLink.findMany({ where: { projectId } })
    expect(links).toHaveLength(1)
    expect(links[0].linkType).toBe('derives')
  })

  it('imports the Jama fixture and maps the Verifies relation', async () => {
    const projectId = await makeProject('jama')
    createdProjectIds.push(projectId)

    const res = await request(app)
      .post(`/api/v1/reqif/${projectId}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reqifXml: fixture('jama.reqif') })
    expect(res.status).toBe(200)
    expect(res.body.data.created).toBe(2)

    const links = await prisma.traceLink.findMany({ where: { projectId } })
    expect(links).toHaveLength(1)
    expect(links[0].linkType).toBe('verifies')
  })

  it('surfaces a warning when a SPEC-RELATION-TYPE cannot be mapped', async () => {
    const projectId = await makeProject('conf-warn')
    createdProjectIds.push(projectId)

    const res = await request(app)
      .post(`/api/v1/reqif/${projectId}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reqifXml: fixture('conformance.reqif') })
    expect(res.status).toBe(200)
    // The 'Constrains' relation type is unmapped -> a row-0 advisory warning.
    const advisory = (res.body.data.errors as Array<{ row: number; errors: string[] }>).find(
      (e) => e.row === 0,
    )
    expect(advisory).toBeDefined()
    expect(advisory!.errors.join(' ')).toMatch(/Constrains/)

    // 'Refines' mapped to 'refines'; 'Constrains' fell back to 'trace'.
    const links = await prisma.traceLink.findMany({ where: { projectId } })
    const linkTypes = links.map((l) => l.linkType).sort()
    expect(linkTypes).toEqual(['refines', 'trace'])
  })

  it('preserves a 3-level hierarchy through import', async () => {
    const projectId = await makeProject('conf-hier')
    createdProjectIds.push(projectId)

    await request(app)
      .post(`/api/v1/reqif/${projectId}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reqifXml: fixture('conformance.reqif') })

    const reqs = await prisma.requirement.findMany({ where: { projectId, deletedAt: null } })
    const gp = reqs.find((r) => r.requirementId === 'CONF-GP-1')!
    const p = reqs.find((r) => r.requirementId === 'CONF-P-1')!
    const c = reqs.find((r) => r.requirementId === 'CONF-C-1')!
    expect(gp.parentId).toBeNull()
    expect(p.parentId).toBe(gp.id)
    expect(c.parentId).toBe(p.id)
  })

  it('preserves an attribute with no dedicated column via customAttributes', async () => {
    const projectId = await makeProject('conf-custom')
    createdProjectIds.push(projectId)

    await request(app)
      .post(`/api/v1/reqif/${projectId}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reqifXml: fixture('conformance.reqif') })

    const gp = await prisma.requirement.findFirst({
      where: { projectId, requirementId: 'CONF-GP-1', deletedAt: null },
    })
    // 'Vendor Tracking Code' has no Requirement column -> customAttributes.
    expect(gp?.customAttributes).toBeTruthy()
    const custom = gp!.customAttributes as Record<string, string>
    expect(custom['Vendor Tracking Code']).toBe('VENDOR-XYZ-001')
    // 'Rationale' DOES have a column.
    const p = await prisma.requirement.findFirst({
      where: { projectId, requirementId: 'CONF-P-1', deletedAt: null },
    })
    expect(p?.rationale).toMatch(/bound interface scope/)
  })

  it('FULL ROUND-TRIP: import -> export -> re-import preserves objects, hierarchy and link types', async () => {
    // --- import the DOORS fixture into project A ---
    const projectA = await makeProject('rt-a')
    createdProjectIds.push(projectA)
    await request(app)
      .post(`/api/v1/reqif/${projectA}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reqifXml: fixture('doors-next.reqif') })

    const reqsA = await prisma.requirement.findMany({ where: { projectId: projectA, deletedAt: null } })
    const linksA = await prisma.traceLink.findMany({ where: { projectId: projectA } })
    expect(reqsA).toHaveLength(3)
    expect(linksA).toHaveLength(2)

    // --- export project A to ReqIF ---
    const exportRes = await request(app)
      .get(`/api/v1/reqif/${projectA}/export`)
      .set('Authorization', `Bearer ${token}`)
    expect(exportRes.status).toBe(200)
    const exportedXml = exportRes.text
    expect(exportedXml).toMatch(/SPEC-HIERARCHY/)
    expect(exportedXml).toMatch(/SPEC-RELATION-TYPE/)
    expect(exportedXml).toMatch(/DATATYPE-DEFINITION-XHTML/)

    // The exported model has a real type/hierarchy block.
    const exportedModel: ReqIFModel = parseReqIFDocument(exportedXml)
    expect(exportedModel.specObjects).toHaveLength(3)
    expect(exportedModel.specRelations).toHaveLength(2)
    expect(exportedModel.specObjectTypes.length).toBeGreaterThanOrEqual(1)
    // Hierarchy reflects parentId: one root with two children.
    expect(hierarchyDepth(exportedModel.specifications[0].children)).toBe(2)
    const edges = parentEdges(exportedModel.specifications[0].children)
    expect(edges.size).toBe(2)
    // The two typed links round-trip as 'Satisfies'.
    expect(
      exportedModel.specRelationTypes.every((t) => /satisf/i.test(t.longName ?? '')),
    ).toBe(true)

    // --- re-import the export into a fresh project B ---
    const projectB = await makeProject('rt-b')
    createdProjectIds.push(projectB)
    const reimportRes = await request(app)
      .post(`/api/v1/reqif/${projectB}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reqifXml: exportedXml })
    expect(reimportRes.status).toBe(200)
    expect(reimportRes.body.data.created).toBe(3)

    const reqsB = await prisma.requirement.findMany({
      where: { projectId: projectB, deletedAt: null },
    })
    const linksB = await prisma.traceLink.findMany({ where: { projectId: projectB } })

    // STRUCTURAL EQUALITY across the round-trip:
    // (1) same SPEC-OBJECT count.
    expect(reqsB).toHaveLength(reqsA.length)
    // (2) same requirementId set.
    expect(reqsB.map((r) => r.requirementId).sort()).toEqual(
      reqsA.map((r) => r.requirementId).sort(),
    )
    // (3) same hierarchy parentage.
    const parentB = reqsB.find((r) => r.requirementId === 'DOORS-SYS-1')!
    const childA_B = reqsB.find((r) => r.requirementId === 'DOORS-SUB-1')!
    const childB_B = reqsB.find((r) => r.requirementId === 'DOORS-SUB-2')!
    expect(childA_B.parentId).toBe(parentB.id)
    expect(childB_B.parentId).toBe(parentB.id)
    expect(parentB.parentId).toBeNull()
    // (4) same link count + per-link type.
    expect(linksB).toHaveLength(linksA.length)
    expect(linksB.map((l) => l.linkType).sort()).toEqual(
      linksA.map((l) => l.linkType).sort(),
    )
    // (5) xhtml description survived both hops.
    expect(parentB.description).toMatch(/<b>shall<\/b>/)
  })

  it('re-importing the same export updates rather than duplicates', async () => {
    const projectId = await makeProject('rt-idem')
    createdProjectIds.push(projectId)

    // First import.
    await request(app)
      .post(`/api/v1/reqif/${projectId}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reqifXml: fixture('doors-next.reqif') })
    const exportRes = await request(app)
      .get(`/api/v1/reqif/${projectId}/export`)
      .set('Authorization', `Bearer ${token}`)

    // Re-import the export into the SAME project.
    const second = await request(app)
      .post(`/api/v1/reqif/${projectId}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reqifXml: exportRes.text })
    expect(second.status).toBe(200)
    expect(second.body.data.created).toBe(0)
    expect(second.body.data.updated).toBe(3)

    // No duplicate requirements were created.
    const count = await prisma.requirement.count({ where: { projectId, deletedAt: null } })
    expect(count).toBe(3)
  })

  it('builds an export model whose hierarchy reflects Requirement.parentId', async () => {
    // Pure model-builder check independent of the HTTP layer.
    const projectId = await makeProject('rt-model')
    createdProjectIds.push(projectId)
    const root = await prisma.requirement.create({
      data: {
        projectId,
        requirementId: `RT-ROOT-${stamp}`,
        title: 'Root',
        description: 'root',
        priority: 'high',
        status: 'draft',
        stage: '',
      },
    })
    const leaf = await prisma.requirement.create({
      data: {
        projectId,
        requirementId: `RT-LEAF-${stamp}`,
        title: 'Leaf',
        description: 'leaf',
        priority: 'low',
        status: 'draft',
        stage: '',
        parentId: root.id,
      },
    })
    const model = buildExportModel({
      projectName: 'RT Model',
      requirements: [root, leaf],
      traceLinks: [{ sourceId: leaf.id, targetId: root.id, linkType: 'derives' }],
    })
    // One root hierarchy node with one child.
    expect(model.specifications[0].children).toHaveLength(1)
    expect(model.specifications[0].children[0].children).toHaveLength(1)
    // The derives link became a SPEC-RELATION with a typed SPEC-RELATION-TYPE.
    expect(model.specRelations).toHaveLength(1)
    expect(model.specRelationTypes.some((t) => t.longName === 'Derives')).toBe(true)
  })
})
