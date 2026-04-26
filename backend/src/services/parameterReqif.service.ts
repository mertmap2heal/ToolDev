import { prisma } from '../lib/prisma'
import { XMLBuilder, XMLParser } from 'fast-xml-parser'

/**
 * ReqIF 1.2 import / export for the Parameters module.
 *
 * Reuses fast-xml-parser (already in deps via the requirements ReqIF
 * service) and emits a flat SPEC-OBJECT list — one row per parameter
 * — under a single "Parameters" SPECIFICATION. Attribute set:
 *
 *   ID, Name, DataType, DefaultValue, Unit, Tolerance, MinValue,
 *   MaxValue, Status, Classification, Description, Formula, Tags
 *
 * Uses standard ReqIF datatypes (XHTML for description, STRING for
 * everything else) so files round-trip through DOORS, Polarion, Jama.
 */

const NOW = () => new Date().toISOString()
const SPEC_TYPE_ID = 'SPEC-TYPE-PARAMETER'
const DATATYPE_STRING_ID = 'DT-STRING'
const DATATYPE_XHTML_ID = 'DT-XHTML'
const SPECIFICATION_ID = 'SPEC-PARAMETERS'

const ATTRIBUTES = [
  { id: 'ATTR-ID',          name: 'ID',          dt: DATATYPE_STRING_ID, type: 'STRING' },
  { id: 'ATTR-NAME',        name: 'Name',        dt: DATATYPE_STRING_ID, type: 'STRING' },
  { id: 'ATTR-DATATYPE',    name: 'DataType',    dt: DATATYPE_STRING_ID, type: 'STRING' },
  { id: 'ATTR-DEFAULT',     name: 'DefaultValue',dt: DATATYPE_STRING_ID, type: 'STRING' },
  { id: 'ATTR-UNIT',        name: 'Unit',        dt: DATATYPE_STRING_ID, type: 'STRING' },
  { id: 'ATTR-TOLERANCE',   name: 'Tolerance',   dt: DATATYPE_STRING_ID, type: 'STRING' },
  { id: 'ATTR-MIN',         name: 'MinValue',    dt: DATATYPE_STRING_ID, type: 'STRING' },
  { id: 'ATTR-MAX',         name: 'MaxValue',    dt: DATATYPE_STRING_ID, type: 'STRING' },
  { id: 'ATTR-STATUS',      name: 'Status',      dt: DATATYPE_STRING_ID, type: 'STRING' },
  { id: 'ATTR-CLASSIFICATION', name: 'Classification', dt: DATATYPE_STRING_ID, type: 'STRING' },
  { id: 'ATTR-DESCRIPTION', name: 'Description', dt: DATATYPE_XHTML_ID,  type: 'XHTML'  },
  { id: 'ATTR-FORMULA',     name: 'Formula',     dt: DATATYPE_STRING_ID, type: 'STRING' },
  { id: 'ATTR-TAGS',        name: 'Tags',        dt: DATATYPE_STRING_ID, type: 'STRING' },
] as const

function escapeXhtml(text: string | null | undefined): string {
  if (!text) return ''
  // Wrap plaintext in a div so the XHTML payload is well-formed.
  const escaped = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<div xmlns="http://www.w3.org/1999/xhtml">${escaped}</div>`
}

export async function exportParametersAsReqIF(args: {
  projectId: string
  toolId?: string
  title?: string
}): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: args.projectId },
    select: { name: true },
  })
  const params = await prisma.parameter.findMany({
    where: { projectId: args.projectId },
    orderBy: { name: 'asc' },
  })
  const headerId = `REQIF-${args.projectId}-${Date.now()}`
  const now = NOW()

  // Spec objects (one per parameter)
  const specObjects = params.map((p) => ({
    '@_IDENTIFIER': `SO-${p.id}`,
    '@_LAST-CHANGE': now,
    'TYPE': { 'SPEC-OBJECT-TYPE-REF': SPEC_TYPE_ID },
    'VALUES': {
      'ATTRIBUTE-VALUE-STRING': [
        { '@_THE-VALUE': p.parameterId ?? p.id, 'DEFINITION': { 'ATTRIBUTE-DEFINITION-STRING-REF': 'ATTR-ID' } },
        { '@_THE-VALUE': p.name, 'DEFINITION': { 'ATTRIBUTE-DEFINITION-STRING-REF': 'ATTR-NAME' } },
        { '@_THE-VALUE': p.dataType ?? '', 'DEFINITION': { 'ATTRIBUTE-DEFINITION-STRING-REF': 'ATTR-DATATYPE' } },
        { '@_THE-VALUE': p.defaultValue ?? '', 'DEFINITION': { 'ATTRIBUTE-DEFINITION-STRING-REF': 'ATTR-DEFAULT' } },
        { '@_THE-VALUE': p.unit ?? '', 'DEFINITION': { 'ATTRIBUTE-DEFINITION-STRING-REF': 'ATTR-UNIT' } },
        { '@_THE-VALUE': p.tolerance ?? '', 'DEFINITION': { 'ATTRIBUTE-DEFINITION-STRING-REF': 'ATTR-TOLERANCE' } },
        { '@_THE-VALUE': p.minValue?.toString() ?? '', 'DEFINITION': { 'ATTRIBUTE-DEFINITION-STRING-REF': 'ATTR-MIN' } },
        { '@_THE-VALUE': p.maxValue?.toString() ?? '', 'DEFINITION': { 'ATTRIBUTE-DEFINITION-STRING-REF': 'ATTR-MAX' } },
        { '@_THE-VALUE': p.status ?? 'draft', 'DEFINITION': { 'ATTRIBUTE-DEFINITION-STRING-REF': 'ATTR-STATUS' } },
        { '@_THE-VALUE': p.classification ?? 'internal', 'DEFINITION': { 'ATTRIBUTE-DEFINITION-STRING-REF': 'ATTR-CLASSIFICATION' } },
        { '@_THE-VALUE': p.formula ?? '', 'DEFINITION': { 'ATTRIBUTE-DEFINITION-STRING-REF': 'ATTR-FORMULA' } },
        { '@_THE-VALUE': (p.tags ?? []).join(';'), 'DEFINITION': { 'ATTRIBUTE-DEFINITION-STRING-REF': 'ATTR-TAGS' } },
      ],
      'ATTRIBUTE-VALUE-XHTML': [
        {
          'DEFINITION': { 'ATTRIBUTE-DEFINITION-XHTML-REF': 'ATTR-DESCRIPTION' },
          'THE-VALUE': escapeXhtml(p.description),
        },
      ],
    },
  }))

  const doc = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    'REQ-IF': {
      '@_xmlns': 'http://www.omg.org/spec/ReqIF/20110401/reqif.xsd',
      'THE-HEADER': {
        'REQ-IF-HEADER': {
          '@_IDENTIFIER': headerId,
          'CREATION-TIME': now,
          'REQ-IF-VERSION': '1.2',
          'SOURCE-TOOL-ID': args.toolId ?? 'engineering-tool',
          'TITLE': args.title ?? `${project?.name ?? 'Project'} — Parameters`,
        },
      },
      'CORE-CONTENT': {
        'REQ-IF-CONTENT': {
          'DATATYPES': {
            'DATATYPE-DEFINITION-STRING': {
              '@_IDENTIFIER': DATATYPE_STRING_ID,
              '@_LAST-CHANGE': now,
              '@_LONG-NAME': 'String',
              '@_MAX-LENGTH': '32000',
            },
            'DATATYPE-DEFINITION-XHTML': {
              '@_IDENTIFIER': DATATYPE_XHTML_ID,
              '@_LAST-CHANGE': now,
              '@_LONG-NAME': 'XHTML',
            },
          },
          'SPEC-TYPES': {
            'SPEC-OBJECT-TYPE': {
              '@_IDENTIFIER': SPEC_TYPE_ID,
              '@_LAST-CHANGE': now,
              '@_LONG-NAME': 'Parameter',
              'SPEC-ATTRIBUTES': {
                'ATTRIBUTE-DEFINITION-STRING': ATTRIBUTES.filter((a) => a.type === 'STRING').map((a) => ({
                  '@_IDENTIFIER': a.id,
                  '@_LAST-CHANGE': now,
                  '@_LONG-NAME': a.name,
                  'TYPE': { 'DATATYPE-DEFINITION-STRING-REF': a.dt },
                })),
                'ATTRIBUTE-DEFINITION-XHTML': ATTRIBUTES.filter((a) => a.type === 'XHTML').map((a) => ({
                  '@_IDENTIFIER': a.id,
                  '@_LAST-CHANGE': now,
                  '@_LONG-NAME': a.name,
                  'TYPE': { 'DATATYPE-DEFINITION-XHTML-REF': a.dt },
                })),
              },
            },
          },
          'SPEC-OBJECTS': { 'SPEC-OBJECT': specObjects },
          'SPECIFICATIONS': {
            'SPECIFICATION': {
              '@_IDENTIFIER': SPECIFICATION_ID,
              '@_LAST-CHANGE': now,
              '@_LONG-NAME': 'Parameters',
              'TYPE': { 'SPECIFICATION-TYPE-REF': SPEC_TYPE_ID },
              'CHILDREN': {
                'SPEC-HIERARCHY': specObjects.map((so, i) => ({
                  '@_IDENTIFIER': `SH-${i}`,
                  '@_LAST-CHANGE': now,
                  'OBJECT': { 'SPEC-OBJECT-REF': so['@_IDENTIFIER'] },
                })),
              },
            },
          },
        },
      },
    },
  }

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    suppressEmptyNode: true,
  })
  return builder.build(doc) as string
}

interface ImportResult {
  imported: number
  updated: number
  skipped: number
  errors: string[]
}

/**
 * Parse a ReqIF document and upsert parameters. Match strategy:
 *   - Existing parameter with the same `name` is updated.
 *   - Otherwise a new parameter is created with the next available
 *     parameterId via the existing project allocator pattern.
 *   - Rows lacking the required Name attribute are skipped (counted).
 */
export async function importParametersFromReqIF(args: {
  projectId: string
  xml: string
  dryRun?: boolean
}): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] }
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) =>
      [
        'SPEC-OBJECT',
        'ATTRIBUTE-VALUE-STRING',
        'ATTRIBUTE-VALUE-XHTML',
        'ATTRIBUTE-DEFINITION-STRING',
        'ATTRIBUTE-DEFINITION-XHTML',
        'SPECIFICATION',
        'SPEC-HIERARCHY',
      ].includes(name),
  })
  const doc = parser.parse(args.xml) as Record<string, unknown>
  const reqif =
    (doc['REQ-IF'] as Record<string, unknown>) ||
    (doc['reqif:REQ-IF'] as Record<string, unknown>)
  if (!reqif) {
    result.errors.push('Not a ReqIF document (missing REQ-IF root)')
    return result
  }
  const content = (
    (reqif['CORE-CONTENT'] as Record<string, unknown>) ||
    (reqif['reqif:CORE-CONTENT'] as Record<string, unknown>)
  )?.['REQ-IF-CONTENT'] as Record<string, unknown> | undefined
  const specObjects =
    ((content?.['SPEC-OBJECTS'] as Record<string, unknown>)?.['SPEC-OBJECT'] as Array<Record<string, unknown>>) ?? []

  if (specObjects.length === 0) {
    result.errors.push('No SPEC-OBJECT entries found')
    return result
  }

  for (const so of specObjects) {
    try {
      const values = (so['VALUES'] as Record<string, unknown>) ?? {}
      const stringValues =
        (values['ATTRIBUTE-VALUE-STRING'] as Array<Record<string, unknown>>) ?? []
      const xhtmlValues =
        (values['ATTRIBUTE-VALUE-XHTML'] as Array<Record<string, unknown>>) ?? []

      const get = (defId: string): string | null => {
        const v = stringValues.find((x) => {
          const def = (x['DEFINITION'] as Record<string, string>)?.['ATTRIBUTE-DEFINITION-STRING-REF']
          return def === defId
        })
        return v ? String(v['@_THE-VALUE'] ?? '') : null
      }
      const getXhtml = (defId: string): string | null => {
        const v = xhtmlValues.find((x) => {
          const def = (x['DEFINITION'] as Record<string, string>)?.['ATTRIBUTE-DEFINITION-XHTML-REF']
          return def === defId
        })
        if (!v) return null
        // THE-VALUE may be parsed as object or string.
        const raw = v['THE-VALUE']
        return typeof raw === 'string' ? raw : JSON.stringify(raw)
      }

      const name = get('ATTR-NAME')
      if (!name) {
        result.skipped++
        continue
      }
      const data = {
        name,
        dataType: get('ATTR-DATATYPE') ?? 'string',
        defaultValue: get('ATTR-DEFAULT') ?? '',
        unit: get('ATTR-UNIT') ?? null,
        tolerance: get('ATTR-TOLERANCE') ?? null,
        minValue: get('ATTR-MIN') ? parseFloat(get('ATTR-MIN') as string) : null,
        maxValue: get('ATTR-MAX') ? parseFloat(get('ATTR-MAX') as string) : null,
        status: get('ATTR-STATUS') ?? 'draft',
        classification: get('ATTR-CLASSIFICATION') ?? 'internal',
        formula: get('ATTR-FORMULA') || null,
        tags: get('ATTR-TAGS')?.split(';').filter(Boolean) ?? [],
        description: getXhtml('ATTR-DESCRIPTION'),
      }

      if (args.dryRun) {
        result.imported++
        continue
      }

      const existing = await prisma.parameter.findFirst({
        where: { projectId: args.projectId, name },
      })
      if (existing) {
        await prisma.parameter.update({
          where: { id: existing.id },
          data: {
            dataType: data.dataType,
            defaultValue: data.defaultValue,
            unit: data.unit,
            tolerance: data.tolerance,
            minValue: data.minValue,
            maxValue: data.maxValue,
            status: data.status,
            classification: data.classification,
            formula: data.formula,
            tags: data.tags,
            description: data.description,
          },
        })
        result.updated++
      } else {
        // Allocate a parameterId in PARAM-N format
        const last = await prisma.parameter.findFirst({
          where: { projectId: args.projectId, parameterId: { startsWith: 'PARAM-' } },
          orderBy: { createdAt: 'desc' },
        })
        const lastNum = last?.parameterId
          ? parseInt(last.parameterId.replace('PARAM-', ''), 10) || 0
          : 0
        const parameterId = `PARAM-${lastNum + 1}`
        await prisma.parameter.create({
          data: {
            projectId: args.projectId,
            parameterId,
            name: data.name,
            dataType: data.dataType,
            defaultValue: data.defaultValue,
            unit: data.unit,
            tolerance: data.tolerance,
            minValue: data.minValue,
            maxValue: data.maxValue,
            status: data.status,
            classification: data.classification,
            formula: data.formula,
            tags: data.tags,
            description: data.description,
            version: '1.0',
          },
        })
        result.imported++
      }
    } catch (e) {
      result.errors.push((e as Error).message)
      result.skipped++
    }
  }
  return result
}
