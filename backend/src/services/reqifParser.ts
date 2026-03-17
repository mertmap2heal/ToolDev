/**
 * Minimal ReqIF 1.x parser using fast-xml-parser.
 * Extracts SPEC-OBJECTs as requirements (identifier, longName, description)
 * and SPEC-RELATIONs as relations (source/target refs).
 */
import { XMLParser } from 'fast-xml-parser'

export interface ReqIFRequirement {
  identifier: string
  title: string
  description?: string
  [key: string]: string | undefined
}

export interface ReqIFRelation {
  sourceRef: string
  targetRef: string
  type?: string
}

export interface ReqIFParseResult {
  requirements: ReqIFRequirement[]
  relations: ReqIFRelation[]
}

function getText(obj: unknown): string {
  if (obj == null) return ''
  if (typeof obj === 'string') return obj.trim()
  if (typeof obj === 'object' && obj !== null && 'key' in obj && '#text' in obj) return String((obj as any)['#text']).trim()
  return ''
}

function collectStrings(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return
  const o = node as Record<string, unknown>
  if (typeof o['#text'] === 'string') out.push((o['#text'] as string).trim())
  if (Array.isArray(o['#text'])) o['#text'].forEach((t) => out.push(String(t).trim()))
  for (const v of Object.values(o)) {
    if (Array.isArray(v)) v.forEach((c) => collectStrings(c, out))
    else if (v && typeof v === 'object') collectStrings(v, out)
  }
}

function extractAttrValue(attrVal: unknown): string {
  if (!attrVal || typeof attrVal !== 'object') return ''
  const a = attrVal as Record<string, unknown>
  const theVal = a['THE-VALUE'] ?? a['the-value'] ?? a['VALUE'] ?? a['value']
  if (typeof theVal === 'string') return theVal.trim()
  if (theVal && typeof theVal === 'object' && '#text' in theVal) return String((theVal as any)['#text']).trim()
  const def = a['DEFINITION'] ?? a['definition']
  if (def && typeof def === 'object' && (def as any)['IDENTIFIER']) return getText((def as any)['IDENTIFIER'])
  return ''
}

function stripXhtml(html: string): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function findChildren(node: unknown, tag: string): unknown[] {
  if (!node || typeof node !== 'object') return []
  const o = node as Record<string, unknown>
  const raw = o[tag] ?? o[tag.toLowerCase()] ?? o[tag.toUpperCase().replace(/-/g, '_')]
  if (Array.isArray(raw)) return raw
  if (raw != null) return [raw]
  return []
}

function findOne(node: unknown, tag: string): unknown {
  const arr = findChildren(node, tag)
  return arr.length > 0 ? arr[0] : null
}

function walkSpecObjects(node: unknown, out: ReqIFRequirement[]): void {
  if (!node || typeof node !== 'object') return
  const o = node as Record<string, unknown>
  const tag = 'SPEC-OBJECT'
  const alt = 'spec-object'
  const list = o[tag] ?? o[alt]
  const arr = Array.isArray(list) ? list : list != null ? [list] : []
  for (const spec of arr) {
    const identNode = findOne(spec, 'IDENTIFIER') ?? findOne(spec, 'identifier')
    const identifier = getText(identNode)
    if (!identifier) continue
    const values = findOne(spec, 'VALUES') ?? findOne(spec, 'values')
    const attrList = values ? findChildren(values, 'ATTRIBUTE-VALUE') : []
    if (attrList.length === 0) {
      const altAttr = values ? findChildren(values, 'attribute-value') : []
      attrList.push(...altAttr)
    }
    let title = identifier
    let description = ''
    const attrs: Record<string, string> = {}
    for (const av of attrList) {
      const def = findOne(av, 'DEFINITION') ?? findOne(av, 'definition')
      const defRef = def && typeof def === 'object' && def !== null ? findOne(def, 'IDENTIFIER') ?? findOne(def, 'identifier') : null
      const defId = getText(defRef)
      const val = extractAttrValue(av)
      const vStr = stripXhtml(val)
      if (defId) attrs[defId] = vStr
      const defLower = defId.toLowerCase()
      if (defLower.includes('longname') || defLower === 'name') title = vStr || title
      if (defLower.includes('description') || defLower === 'desc') description = vStr
    }
    out.push({
      identifier,
      title: title || identifier,
      description: description || undefined,
      ...attrs,
    })
  }
  for (const v of Object.values(o)) {
    if (Array.isArray(v)) v.forEach((c) => walkSpecObjects(c, out))
    else if (v && typeof v === 'object' && !Array.isArray(v)) walkSpecObjects(v, out)
  }
}

function walkSpecRelations(node: unknown, out: ReqIFRelation[]): void {
  if (!node || typeof node !== 'object') return
  const o = node as Record<string, unknown>
  const tag = 'SPEC-RELATION'
  const alt = 'spec-relation'
  const list = o[tag] ?? o[alt]
  const arr = Array.isArray(list) ? list : list != null ? [list] : []
  for (const rel of arr) {
    const src = findOne(rel, 'SOURCE') ?? findOne(rel, 'source')
    const tgt = findOne(rel, 'TARGET') ?? findOne(rel, 'target')
    const srcRef = src && typeof src === 'object' ? getText((src as any).REF ?? (src as any)['@_REF'] ?? (src as any).ref) : ''
    const tgtRef = tgt && typeof tgt === 'object' ? getText((tgt as any).REF ?? (tgt as any)['@_REF'] ?? (tgt as any).ref) : ''
    if (srcRef && tgtRef) out.push({ sourceRef: srcRef, targetRef: tgtRef })
  }
  for (const v of Object.values(o)) {
    if (Array.isArray(v)) v.forEach((c) => walkSpecRelations(c, out))
    else if (v && typeof v === 'object' && !Array.isArray(v)) walkSpecRelations(v, out)
  }
}

export function parseReqIF(xmlContent: string): ReqIFParseResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  })
  const parsed = parser.parse(xmlContent)
  const requirements: ReqIFRequirement[] = []
  const relations: ReqIFRelation[] = []
  walkSpecObjects(parsed, requirements)
  walkSpecRelations(parsed, relations)
  return { requirements, relations }
}
