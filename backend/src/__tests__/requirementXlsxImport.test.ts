/**
 * Requirements Excel (`.xlsx`) import — parser + per-cell validation + the two
 * HTTP endpoints (NX-4-followup, issue #450).
 *
 * Covers:
 *  - the `parseRequirementsXlsx` parser: header detection, cell-string
 *    coercion, a formula cell read as its cached value (never evaluated),
 *    the empty-buffer / non-xlsx / over-row hostile-input guards;
 *  - POST /requirements/:projectId/import/xlsx/parse — server-side parse;
 *  - POST /requirements/:projectId/import/xlsx/commit — per-cell validation,
 *    partial success (valid subset commits, invalid rows reported per-cell),
 *    a DB-fault rollback, and the INCOSE/EARS advisory warnings;
 *  - tenant scope: 401 unauthenticated, 403 non-member;
 *  - round-trip parity: an exporter-shaped `.xlsx` re-imports with no loss.
 *
 * Per `.claude/testing.md`: real DB, isolated timestamped data, afterAll
 * cleanup, no Prisma mocks. `.xlsx` fixtures are built programmatically with
 * exceljs so the round-trip test is honest.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import ExcelJS from 'exceljs'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import {
  parseRequirementsXlsx,
  XlsxParseError,
  MAX_DATA_ROWS,
} from '../services/requirementXlsxImport.service'

/**
 * Build an `.xlsx` Buffer from a header row and data rows. Each data row is a
 * tuple of `ExcelJS.CellValue`s aligned to the headers — a string for a plain
 * cell, or `{ formula, result }` for a formula cell.
 */
async function buildXlsx(
  headers: string[],
  rows: ExcelJS.CellValue[][],
  sheetName = 'Requirements',
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheetName)
  ws.addRow(headers)
  for (const row of rows) ws.addRow(row)
  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out)
}

describe('Requirements Excel import (NX-4-followup, #450)', () => {
  const stamp = Date.now()
  let memberUserId: string
  let memberToken: string
  let outsiderUserId: string
  let outsiderToken: string
  let projectId: string
  let lockedReqId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const member = await prisma.user.create({
      data: { email: `xlsx-member-${stamp}@example.com`, password: 'hashed', name: 'Xlsx Member' },
    })
    memberUserId = member.id
    memberToken = jwt.sign({ userId: memberUserId }, secret)

    const outsider = await prisma.user.create({
      data: { email: `xlsx-outsider-${stamp}@example.com`, password: 'hashed', name: 'Xlsx Outsider' },
    })
    outsiderUserId = outsider.id
    outsiderToken = jwt.sign({ userId: outsiderUserId }, secret)

    const slug = `xlsx-proj-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Xlsx Project ${stamp}`, domain: slug, slug, userId: memberUserId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId: memberUserId, role: 'owner', status: 'accepted' },
    })

    // A locked requirement — an update to it must roll the whole batch back.
    const locked = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Locked target',
        description: 'A locked requirement.',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `XLSX-${stamp}-LOCKED`,
        isLocked: true,
        lockedByUserId: outsiderUserId,
      },
    })
    lockedReqId = locked.id
  })

  afterAll(async () => {
    const projectReqIds = (
      await prisma.requirement
        .findMany({ where: { projectId }, select: { id: true } })
        .catch(() => [])
    ).map((x) => x.id)
    if (projectReqIds.length > 0) {
      await prisma.requirementVersion
        .deleteMany({ where: { requirementId: { in: projectReqIds } } })
        .catch(() => {})
    }
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.verAuditEvent.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [memberUserId, outsiderUserId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  // ─── Parser unit tests ────────────────────────────────────────────────────
  describe('parseRequirementsXlsx', () => {
    it('parses a valid .xlsx into headers + row-keyed cells', async () => {
      const buf = await buildXlsx(
        ['Title', 'Description', 'Priority'],
        [
          ['Decelerate', 'The system shall decelerate within 200ms.', 'high'],
          ['Illuminate', 'The system shall illuminate the cabin.', 'medium'],
        ],
      )
      const parsed = await parseRequirementsXlsx(buf)
      expect(parsed.headers).toEqual(['Title', 'Description', 'Priority'])
      expect(parsed.rows).toHaveLength(2)
      // Header is row 1; first data row is row 2.
      expect(parsed.rows[0].rowNumber).toBe(2)
      expect(parsed.rows[1].rowNumber).toBe(3)
      expect(parsed.rows[0].cells.Title).toBe('Decelerate')
      expect(parsed.rows[1].cells.Priority).toBe('medium')
    })

    it('coerces a number cell to its display string', async () => {
      const buf = await buildXlsx(['Title', 'Description', 'Stage'], [['T', 'D', 3]])
      const parsed = await parseRequirementsXlsx(buf)
      expect(parsed.rows[0].cells.Stage).toBe('3')
    })

    it('reads a formula cell as its cached value, never evaluating the formula', async () => {
      // A formula cell whose cached result is the literal text "high". An
      // injection payload like =cmd|... would likewise surface only its inert
      // cached result — the formula is never re-computed.
      const buf = await buildXlsx(
        ['Title', 'Description', 'Priority'],
        [['Formula row', 'A description.', { formula: 'A2', result: 'high' }]],
      )
      const parsed = await parseRequirementsXlsx(buf)
      expect(parsed.rows[0].cells.Priority).toBe('high')
      // The formula text itself never leaks into the parsed value.
      expect(parsed.rows[0].cells.Priority).not.toContain('A2')
    })

    it('reads a formula cell with no cached result as an inert blank', async () => {
      const buf = await buildXlsx(
        ['Title', 'Description', 'Priority'],
        [['Row', 'Desc', { formula: 'SUM(1,2)' } as ExcelJS.CellValue]],
      )
      const parsed = await parseRequirementsXlsx(buf)
      expect(parsed.rows[0].cells.Priority).toBe('')
    })

    it('rejects an empty buffer with XlsxParseError', async () => {
      await expect(parseRequirementsXlsx(Buffer.alloc(0))).rejects.toBeInstanceOf(XlsxParseError)
    })

    it('rejects a non-xlsx buffer with XlsxParseError', async () => {
      await expect(
        parseRequirementsXlsx(Buffer.from('this is not a workbook', 'utf8')),
      ).rejects.toBeInstanceOf(XlsxParseError)
    })

    it('rejects a sheet with more than MAX_DATA_ROWS data rows', async () => {
      const rows: ExcelJS.CellValue[][] = []
      for (let i = 0; i < MAX_DATA_ROWS + 1; i++) rows.push([`T${i}`, `D${i}`])
      const buf = await buildXlsx(['Title', 'Description'], rows)
      await expect(parseRequirementsXlsx(buf)).rejects.toBeInstanceOf(XlsxParseError)
    })

    it('skips wholly-blank data rows', async () => {
      const buf = await buildXlsx(
        ['Title', 'Description'],
        [
          ['Real', 'A real requirement.'],
          ['', ''],
          ['Another', 'Another requirement.'],
        ],
      )
      const parsed = await parseRequirementsXlsx(buf)
      expect(parsed.rows).toHaveLength(2)
    })
  })

  // ─── Parse endpoint ───────────────────────────────────────────────────────
  describe('POST /import/xlsx/parse', () => {
    it('returns 401 without auth', async () => {
      const buf = await buildXlsx(['Title', 'Description'], [['T', 'D']])
      const res = await request(app)
        .post(`/api/v1/requirements/${projectId}/import/xlsx/parse`)
        .attach('file', buf, 'reqs.xlsx')
      expect(res.status).toBe(401)
    })

    it('returns 403 for a non-member', async () => {
      const buf = await buildXlsx(['Title', 'Description'], [['T', 'D']])
      const res = await request(app)
        .post(`/api/v1/requirements/${projectId}/import/xlsx/parse`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .attach('file', buf, 'reqs.xlsx')
      expect(res.status).toBe(403)
    })

    it('returns 400 when no file is attached', async () => {
      const res = await request(app)
        .post(`/api/v1/requirements/${projectId}/import/xlsx/parse`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(400)
    })

    it('returns 422 for a corrupt / non-xlsx file (parse-level failure)', async () => {
      const res = await request(app)
        .post(`/api/v1/requirements/${projectId}/import/xlsx/parse`)
        .set('Authorization', `Bearer ${memberToken}`)
        .attach('file', Buffer.from('not a workbook', 'utf8'), 'bad.xlsx')
      expect(res.status).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('returns 422 for a header-only file with no data rows', async () => {
      const buf = await buildXlsx(['Title', 'Description'], [])
      const res = await request(app)
        .post(`/api/v1/requirements/${projectId}/import/xlsx/parse`)
        .set('Authorization', `Bearer ${memberToken}`)
        .attach('file', buf, 'empty.xlsx')
      expect(res.status).toBe(422)
    })

    it('parses a valid .xlsx and returns headers + rows', async () => {
      const buf = await buildXlsx(
        ['Title', 'Description', 'Priority'],
        [['Decelerate', 'The system shall decelerate within 200ms.', 'high']],
      )
      const res = await request(app)
        .post(`/api/v1/requirements/${projectId}/import/xlsx/parse`)
        .set('Authorization', `Bearer ${memberToken}`)
        .attach('file', buf, 'reqs.xlsx')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.headers).toEqual(['Title', 'Description', 'Priority'])
      expect(res.body.data.rows).toHaveLength(1)
      expect(res.body.data.rows[0].rowNumber).toBe(2)
    })
  })

  // ─── Commit endpoint ──────────────────────────────────────────────────────
  describe('POST /import/xlsx/commit', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post(`/api/v1/requirements/${projectId}/import/xlsx/commit`)
        .send({ create: [{ title: 'X', description: 'Y' }] })
      expect(res.status).toBe(401)
    })

    it('returns 403 for a non-member', async () => {
      const res = await request(app)
        .post(`/api/v1/requirements/${projectId}/import/xlsx/commit`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ create: [{ title: 'X', description: 'Y' }] })
      expect(res.status).toBe(403)
    })

    it('returns 400 when neither create nor update is present', async () => {
      const res = await request(app)
        .post(`/api/v1/requirements/${projectId}/import/xlsx/commit`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
      expect(res.status).toBe(400)
    })

    it('commits valid create rows', async () => {
      const res = await request(app)
        .post(`/api/v1/requirements/${projectId}/import/xlsx/commit`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          create: [
            {
              title: `Commit OK A ${stamp}`,
              description: 'When the door opens, the system shall illuminate the cabin within 200ms.',
              _rowNumber: 2,
            },
            {
              title: `Commit OK B ${stamp}`,
              description: 'When the brake is applied, the system shall decelerate within 500ms.',
              _rowNumber: 3,
            },
          ],
          columnMap: { title: 'Title', description: 'Description' },
          filename: 'reqs.xlsx',
        })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.created).toBe(2)
      expect(res.body.data.errors).toHaveLength(0)
    })

    it('drops hostile / protected columns — a commit row cannot mass-assign id, projectId, or provenance fields', async () => {
      // Regression for the mass-assignment allowlist (PR #458 security review).
      // validateCreateRow builds the tx.requirement.create data object
      // field-by-field — it never spreads ...row — so a hostile spreadsheet
      // column named after a protected field (the Prisma primary key, the
      // server-set projectId, createdAt, or an R-1 provenance-lattice field)
      // must NOT reach the DB. The row still imports; the hostile values are
      // silently dropped and the requirement is stamped to the route's project
      // with the schema-default provenance.
      const HOSTILE_PROJECT_ID = '00000000-0000-0000-0000-000000000000'
      const HOSTILE_ID = 'hostile-primary-key-value'
      const uniqueTitle = `Mass-assign attempt ${stamp}`
      const res = await request(app)
        .post(`/api/v1/requirements/${projectId}/import/xlsx/commit`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          create: [
            {
              title: uniqueTitle,
              description: 'When the system arms, the system shall confirm the state within 100ms.',
              _rowNumber: 2,
              // ── hostile columns — every one must be dropped ──
              id: HOSTILE_ID,
              projectId: HOSTILE_PROJECT_ID,
              authorType: 'ai_applied',
              authorAiModel: 'evil-model',
              provenanceReviewStatus: 'signed_off',
              reviewerUserId: outsiderUserId,
              userId: outsiderUserId,
              createdAt: '2000-01-01T00:00:00.000Z',
              updatedAt: '2000-01-01T00:00:00.000Z',
              version: 999,
              isLocked: true,
              deletedAt: '2000-01-01T00:00:00.000Z',
            },
          ],
          columnMap: { title: 'Title', description: 'Description' },
          filename: 'mass-assign.xlsx',
        })

      // The row imported — hostile columns do not break the commit.
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.created).toBe(1)
      expect(res.body.data.errors).toHaveLength(0)

      // The created requirement is found ONLY under the route's project — the
      // hostile projectId did not redirect the write to another tenant.
      const hostileScoped = await prisma.requirement.findFirst({
        where: { projectId: HOSTILE_PROJECT_ID, title: uniqueTitle },
      })
      expect(hostileScoped).toBeNull()

      const created = await prisma.requirement.findFirst({
        where: { projectId, title: uniqueTitle },
      })
      expect(created).not.toBeNull()
      // projectId is the route param, never the spreadsheet cell.
      expect(created?.projectId).toBe(projectId)
      // The primary key is a fresh server UUID, not the hostile string.
      expect(created?.id).not.toBe(HOSTILE_ID)
      // The R-1 provenance lattice carries its schema defaults — a spreadsheet
      // column cannot stamp the row as AI-authored or pre-signed-off.
      expect(created?.authorType).toBe('human')
      expect(created?.authorAiModel).toBeNull()
      expect(created?.provenanceReviewStatus).toBe('drafted')
      expect(created?.reviewerUserId).toBeNull()
      // version starts at 1, not the hostile 999; the row is not soft-deleted
      // and not locked; createdAt is recent, not the hostile epoch date.
      expect(created?.version).toBe(1)
      expect(created?.deletedAt).toBeNull()
      expect(created?.isLocked).toBe(false)
      expect(created!.createdAt.getTime()).toBeGreaterThan(stamp - 60_000)
    })

    it('partial success: a mix of valid and invalid rows imports the valid subset and reports the invalid per-cell', async () => {
      // 5 rows, 2 invalid (rows 3 and 5 have no description).
      const res = await request(app)
        .post(`/api/v1/requirements/${projectId}/import/xlsx/commit`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          create: [
            { title: `Partial 1 ${stamp}`, description: 'When the system boots, the system shall self-test within 5 seconds.', _rowNumber: 2 },
            { title: `Partial 2 ${stamp}`, description: 'When the user logs in, the system shall load the project within 2 seconds.', _rowNumber: 3 },
            { title: `Partial 3 ${stamp}`, description: '', _rowNumber: 4 },
            { title: `Partial 4 ${stamp}`, description: 'When the file uploads, the system shall validate it within 1 second.', _rowNumber: 5 },
            { title: '', description: '', _rowNumber: 6 },
          ],
          columnMap: { title: 'Title', description: 'Description' },
          filename: 'partial.xlsx',
        })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      // 3 valid rows committed.
      expect(res.body.data.created).toBe(3)
      expect(res.body.data.skipped).toBe(2)
      // The 2 invalid rows are reported with their spreadsheet row + column.
      expect(res.body.data.errors.length).toBeGreaterThanOrEqual(2)
      const errorRows = res.body.data.errors.map((e: { rowNumber: number }) => e.rowNumber)
      expect(errorRows).toContain(4)
      expect(errorRows).toContain(6)
      // Each error names a column and a field.
      for (const e of res.body.data.errors) {
        expect(typeof e.column).toBe('string')
        expect(typeof e.field).toBe('string')
        expect(e.severity).toBe('error')
        expect(typeof e.reason).toBe('string')
      }
    })

    it('INCOSE/EARS findings appear as advisory warnings and never block the import', async () => {
      const res = await request(app)
        .post(`/api/v1/requirements/${projectId}/import/xlsx/commit`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          create: [
            {
              // "fast" is a vague INCOSE term — a quality warning, not a block.
              title: `Vague desc ${stamp}`,
              description: 'The system shall be fast.',
              _rowNumber: 2,
            },
          ],
          columnMap: { title: 'Title', description: 'Description' },
          filename: 'vague.xlsx',
        })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      // The row still imported despite the vague description.
      expect(res.body.data.created).toBe(1)
      expect(res.body.data.errors).toHaveLength(0)
      // A quality warning was attached, addressed to the description column.
      expect(res.body.data.qualityWarnings.length).toBeGreaterThan(0)
      const warn = res.body.data.qualityWarnings[0]
      expect(warn.severity).toBe('warning')
      expect(warn.field).toBe('description')
      expect(warn.rowNumber).toBe(2)
    })

    it('all-or-nothing DB fault: an update to a locked row rolls the batch back (409)', async () => {
      // The valid create in the same batch must NOT be written because the
      // locked-row update aborts the whole transaction (#92 behaviour).
      const beforeCount = await prisma.requirement.count({ where: { projectId } })
      const res = await request(app)
        .post(`/api/v1/requirements/${projectId}/import/xlsx/commit`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          create: [
            {
              title: `Should-not-persist ${stamp}`,
              description: 'When the engine starts, the system shall log the event within 1 second.',
              _rowNumber: 2,
            },
          ],
          update: [
            { id: lockedReqId, data: { title: 'Attempted edit of a locked row' }, _rowNumber: 3 },
          ],
          columnMap: { title: 'Title', description: 'Description' },
          filename: 'locked.xlsx',
        })
      expect(res.status).toBe(409)
      expect(res.body.success).toBe(false)
      // Nothing was partially written — the create rolled back with the batch.
      const afterCount = await prisma.requirement.count({ where: { projectId } })
      expect(afterCount).toBe(beforeCount)
    })
  })

  // ─── Round-trip parity ────────────────────────────────────────────────────
  describe('round-trip parity with the exporter', () => {
    it('an exporter-shaped .xlsx re-imports with no data loss on round-trippable fields', async () => {
      // Mirror the columns + extra coverage columns the requirements Excel
      // export emits (ExportBuilder.exportExcel). The coverage columns are
      // export-only — they map to nothing and are simply ignored on import.
      const headers = [
        'ID',
        'Title',
        'Description',
        'Priority',
        'Status',
        'Category',
        'Owner',
        'HasAllocation',
        'HasVerification',
        'CoverageStatus',
      ]
      const reqIdA = `XLSX-${stamp}-RT-A`
      const reqIdB = `XLSX-${stamp}-RT-B`
      const buf = await buildXlsx(headers, [
        [
          reqIdA,
          'Round-trip A',
          'When the system arms, the system shall confirm the state within 100ms.',
          'high',
          'draft',
          'functional',
          'alice',
          'Yes',
          'No',
          'Partial',
        ],
        [
          reqIdB,
          'Round-trip B',
          'When the system disarms, the system shall clear the state within 100ms.',
          'low',
          'draft',
          'functional',
          'bob',
          'No',
          'No',
          'None',
        ],
      ])

      // Parse via the endpoint, then commit (the wizard auto-maps the headers
      // ID/Title/Description/Priority/Status/Category/Owner to fields).
      const parseRes = await request(app)
        .post(`/api/v1/requirements/${projectId}/import/xlsx/parse`)
        .set('Authorization', `Bearer ${memberToken}`)
        .attach('file', buf, 'export-shaped.xlsx')
      expect(parseRes.status).toBe(200)
      const rows: Array<{ rowNumber: number; cells: Record<string, string> }> =
        parseRes.body.data.rows

      const commitRes = await request(app)
        .post(`/api/v1/requirements/${projectId}/import/xlsx/commit`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          create: rows.map((r) => ({
            requirementId: r.cells.ID,
            title: r.cells.Title,
            description: r.cells.Description,
            priority: r.cells.Priority,
            status: r.cells.Status,
            category: r.cells.Category,
            owner: r.cells.Owner,
            _rowNumber: r.rowNumber,
          })),
          columnMap: {
            requirementId: 'ID',
            title: 'Title',
            description: 'Description',
            priority: 'Priority',
            status: 'Status',
            category: 'Category',
            owner: 'Owner',
          },
          filename: 'export-shaped.xlsx',
        })
      expect(commitRes.status).toBe(200)
      expect(commitRes.body.data.created).toBe(2)
      expect(commitRes.body.data.errors).toHaveLength(0)

      // The two requirements landed with their round-trippable fields intact.
      const importedA = await prisma.requirement.findFirst({
        where: { projectId, requirementId: reqIdA },
      })
      expect(importedA).not.toBeNull()
      expect(importedA?.title).toBe('Round-trip A')
      expect(importedA?.priority).toBe('high')
      expect(importedA?.owner).toBe('alice')
      const importedB = await prisma.requirement.findFirst({
        where: { projectId, requirementId: reqIdB },
      })
      expect(importedB?.title).toBe('Round-trip B')
      expect(importedB?.owner).toBe('bob')
    })
  })
})
