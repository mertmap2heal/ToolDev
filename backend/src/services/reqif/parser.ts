/**
 * ReqIF 1.x parser (NX-1) — namespace-agnostic, two-pass, order-preserving.
 *
 * Pass 1 builds IDENTIFIER-keyed dictionaries for DATATYPE-DEFINITION-*,
 * SPEC-OBJECT-TYPE, SPEC-RELATION-TYPE and SPECIFICATION-TYPE.
 * Pass 2 resolves every `*-REF` element against those dictionaries while
 * building the typed `ReqIFModel`.
 *
 * Why two passes: a SPEC-OBJECT's ATTRIBUTE-VALUE carries a DEFINITION-REF;
 * to type the value correctly (enumeration / boolean / integer vs string) the
 * parser must resolve that ref to its ATTRIBUTE-DEFINITION and on to its
 * DATATYPE-DEFINITION. The legacy single-pass walk had no dictionary to resolve
 * against, so it string-coerced everything and dropped 80% of fidelity.
 *
 * Order-preserving: fast-xml-parser runs in `preserveOrder` mode so the inner
 * XHTML of an ATTRIBUTE-VALUE-XHTML (mixed text + elements, e.g. tables) keeps
 * document order and round-trips intact. The legacy parser collapsed mixed
 * content, scrambling "<p>foo <b>bar</b> baz</p>" into "foo baz bar".
 *
 * Namespace-agnostic: fast-xml-parser keeps any XML prefix in the tag name
 * (`reqif:SPEC-OBJECT`, `xhtml:div`, ...). DOORS, Polarion and Jama exports use
 * different prefixes or none — every lookup strips the prefix to the local name.
 *
 * XXE / XML-bomb safety: `parseXmlSafely` (reused) rejects DOCTYPE; the parser
 * runs with `processEntities:false`. The 5000-SPEC-OBJECT / 20000-SPEC-RELATION
 * / 50000-SPEC-HIERARCHY caps bound CPU + heap for a hostile but well-formed
 * payload.
 */
import { XMLParser } from 'fast-xml-parser'
import { parseXmlSafely } from '../testResultParsers/xmlShared'
import type {
  AttributeDefinition,
  AttributeValue,
  Datatype,
  DatatypeKind,
  EnumValue,
  ReqIFHeader,
  ReqIFModel,
  SpecHierarchy,
  SpecObject,
  SpecObjectType,
  SpecRelation,
  SpecRelationType,
  Specification,
  SpecificationType,
} from './model'

/** Max SPEC-OBJECTs a single ReqIF document may carry (#298 DoS cap). */
export const MAX_SPEC_OBJECTS = 5000
/** Max SPEC-RELATIONs a single document may carry. */
export const MAX_SPEC_RELATIONS = 20000
/** Max SPEC-HIERARCHY nodes a single document may carry. */
export const MAX_HIERARCHY_NODES = 50000

/** Raised when a ReqIF document exceeds a structural DoS cap. */
export class ReqIFLimitError extends Error {}
/** Raised when the XML is not a recognisable ReqIF document. */
export class ReqIFStructureError extends Error {}

/* ------------------------------------------------------------------ *
 * preserveOrder node model
 * ------------------------------------------------------------------ *
 * In preserveOrder mode fast-xml-parser yields an ordered array of single-key
 * objects. An element is `{ tagName: ElemNode[], ":@": { "@_attr": val } }`;
 * a text node is `{ "#text": string }`. We work directly on that shape so
 * mixed content (text interleaved with elements) is never reordered.
 */

/** One node in a preserveOrder child list. */
type OrderedNode = Record<string, unknown>

/** Strip any `prefix:` from an XML tag / attribute name. */
function localName(tag: string): string {
  const idx = tag.indexOf(':')
  return idx >= 0 ? tag.slice(idx + 1) : tag
}

/** True when an ordered node is a text node. */
function isTextNode(node: OrderedNode): boolean {
  return '#text' in node
}

/** The single element tag name of an ordered element node, or undefined. */
function elemTag(node: OrderedNode): string | undefined {
  for (const k of Object.keys(node)) {
    if (k === '#text' || k === ':@' || k.startsWith('?')) continue
    return k
  }
  return undefined
}

/** The ordered child list of an element node (the value under its tag key). */
function elemChildren(node: OrderedNode): OrderedNode[] {
  const tag = elemTag(node)
  if (tag === undefined) return []
  const v = node[tag]
  return Array.isArray(v) ? (v as OrderedNode[]) : []
}

/** The attribute bag of an element node. */
function elemAttrs(node: OrderedNode): Record<string, unknown> {
  const at = node[':@']
  return at && typeof at === 'object' ? (at as Record<string, unknown>) : {}
}

/**
 * All child elements of `node` whose local tag name equals `tag`.
 * `node` may be a single element node or already a child list.
 */
function findAll(node: OrderedNode | OrderedNode[] | undefined, tag: string): OrderedNode[] {
  if (!node) return []
  const list = Array.isArray(node) ? node : elemChildren(node)
  const out: OrderedNode[] = []
  for (const c of list) {
    const t = elemTag(c)
    if (t !== undefined && localName(t) === tag) out.push(c)
  }
  return out
}

/** First child element of `node` with local tag name `tag`. */
function findOne(node: OrderedNode | OrderedNode[] | undefined, tag: string): OrderedNode | undefined {
  const all = findAll(node, tag)
  return all.length ? all[0] : undefined
}

/**
 * Read an attribute (`@_name`, prefix-stripped) of an element node, or the
 * text of a same-named child element. ReqIF allows both `<X ID="..">` and
 * `<X><ID>..</ID></X>`.
 */
function attr(node: OrderedNode | undefined, name: string): string | undefined {
  if (!node) return undefined
  const attrs = elemAttrs(node)
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('@_') && localName(k.slice(2)) === name) {
      if (v !== undefined && v !== null) {
        const s = String(v).trim()
        if (s) return s
      }
    }
  }
  const childEl = findOne(node, name)
  if (childEl) {
    const t = elementText(childEl)
    if (t) return t
  }
  return undefined
}

/** Concatenated plain text of an element node (all descendant #text). */
function elementText(node: OrderedNode | undefined): string {
  if (!node) return ''
  const parts: string[] = []
  const walk = (n: OrderedNode): void => {
    if (isTextNode(n)) {
      const t = n['#text']
      if (t !== undefined && t !== null) parts.push(String(t))
      return
    }
    for (const c of elemChildren(n)) walk(c)
  }
  walk(node)
  return parts.join('').trim()
}

/* ------------------------------------------------------------------ *
 * XHTML re-serialisation (order-preserving)
 * ------------------------------------------------------------------ */

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;')
}

/**
 * Serialise one XHTML ordered node back to an HTML string. Mixed content is
 * emitted in document order (text and child elements interleaved). XML
 * prefixes (`xhtml:`, `reqif-xhtml:`) are stripped so the result is plain,
 * browser-renderable HTML — the same shape the app stores descriptions in.
 */
function serialiseXhtmlNode(node: OrderedNode): string {
  if (isTextNode(node)) {
    const t = node['#text']
    return escapeText(t === undefined || t === null ? '' : String(t))
  }
  const tag = elemTag(node)
  if (tag === undefined) return ''
  const local = localName(tag)
  const attrs = elemAttrs(node)
  let attrStr = ''
  for (const [k, v] of Object.entries(attrs)) {
    if (!k.startsWith('@_')) continue
    const name = localName(k.slice(2))
    if (name === 'xmlns' || name.startsWith('xmlns')) continue
    attrStr += ` ${name}="${escapeAttr(String(v ?? ''))}"`
  }
  const inner = elemChildren(node).map(serialiseXhtmlNode).join('')
  if (VOID_ELEMENTS.has(local.toLowerCase()) && !inner) {
    return `<${local}${attrStr} />`
  }
  return `<${local}${attrStr}>${inner}</${local}>`
}

/**
 * Convert the children of a `THE-VALUE` element (an ATTRIBUTE-VALUE-XHTML's
 * payload) to an HTML string, preserving the inner markup verbatim.
 */
function xhtmlChildrenToHtml(theValueEl: OrderedNode | undefined): string {
  if (!theValueEl) return ''
  return elemChildren(theValueEl).map(serialiseXhtmlNode).join('').trim()
}

/* ------------------------------------------------------------------ *
 * Datatype + type dictionaries (pass 1)
 * ------------------------------------------------------------------ */

const DATATYPE_LOCAL: Record<string, DatatypeKind> = {
  'DATATYPE-DEFINITION-STRING': 'STRING',
  'DATATYPE-DEFINITION-XHTML': 'XHTML',
  'DATATYPE-DEFINITION-INTEGER': 'INTEGER',
  'DATATYPE-DEFINITION-REAL': 'REAL',
  'DATATYPE-DEFINITION-BOOLEAN': 'BOOLEAN',
  'DATATYPE-DEFINITION-DATE': 'DATE',
  'DATATYPE-DEFINITION-ENUMERATION': 'ENUMERATION',
}
const ATTR_DEF_LOCAL: Record<string, DatatypeKind> = {
  'ATTRIBUTE-DEFINITION-STRING': 'STRING',
  'ATTRIBUTE-DEFINITION-XHTML': 'XHTML',
  'ATTRIBUTE-DEFINITION-INTEGER': 'INTEGER',
  'ATTRIBUTE-DEFINITION-REAL': 'REAL',
  'ATTRIBUTE-DEFINITION-BOOLEAN': 'BOOLEAN',
  'ATTRIBUTE-DEFINITION-DATE': 'DATE',
  'ATTRIBUTE-DEFINITION-ENUMERATION': 'ENUMERATION',
}
const ATTR_VALUE_LOCAL: Record<string, DatatypeKind> = {
  'ATTRIBUTE-VALUE-STRING': 'STRING',
  'ATTRIBUTE-VALUE-XHTML': 'XHTML',
  'ATTRIBUTE-VALUE-INTEGER': 'INTEGER',
  'ATTRIBUTE-VALUE-REAL': 'REAL',
  'ATTRIBUTE-VALUE-BOOLEAN': 'BOOLEAN',
  'ATTRIBUTE-VALUE-DATE': 'DATE',
  'ATTRIBUTE-VALUE-ENUMERATION': 'ENUMERATION',
}

/** First child whose local tag name ends with `-REF`, returning its text. */
function firstRefText(node: OrderedNode | undefined): string | undefined {
  if (!node) return undefined
  for (const c of elemChildren(node)) {
    const t = elemTag(c)
    if (t && localName(t).endsWith('-REF')) {
      const v = elementText(c)
      if (v) return v
    }
  }
  return undefined
}

function parseDatatypes(content: OrderedNode | undefined): Datatype[] {
  const datatypes: Datatype[] = []
  const dtRoot = findOne(content, 'DATATYPES')
  const searchRoots = dtRoot ? [dtRoot] : content ? [content] : []
  for (const root of searchRoots) {
    for (const [tag, kind] of Object.entries(DATATYPE_LOCAL)) {
      for (const el of findAll(root, tag)) {
        const identifier = attr(el, 'IDENTIFIER')
        if (!identifier) continue
        const dt: Datatype = {
          identifier,
          kind,
          longName: attr(el, 'LONG-NAME'),
          lastChange: attr(el, 'LAST-CHANGE'),
          maxLength: attr(el, 'MAX-LENGTH'),
          min: attr(el, 'MIN'),
          max: attr(el, 'MAX'),
          accuracy: attr(el, 'ACCURACY'),
        }
        if (kind === 'ENUMERATION') {
          const enumValues: EnumValue[] = []
          const specValues = findOne(el, 'SPECIFIED-VALUES') ?? el
          for (const ev of findAll(specValues, 'ENUM-VALUE')) {
            const evId = attr(ev, 'IDENTIFIER')
            if (!evId) continue
            const props = findOne(ev, 'PROPERTIES')
            const embedded = findOne(props, 'EMBEDDED-VALUE')
            enumValues.push({
              identifier: evId,
              longName: attr(ev, 'LONG-NAME'),
              key: attr(embedded, 'KEY'),
            })
          }
          dt.enumValues = enumValues
        }
        datatypes.push(dt)
      }
    }
  }
  return datatypes
}

function parseSpecObjectTypes(content: OrderedNode | undefined): SpecObjectType[] {
  const out: SpecObjectType[] = []
  const specTypes = findOne(content, 'SPEC-TYPES')
  const searchRoots = specTypes ? [specTypes] : content ? [content] : []
  for (const root of searchRoots) {
    for (const el of findAll(root, 'SPEC-OBJECT-TYPE')) {
      const identifier = attr(el, 'IDENTIFIER')
      if (!identifier) continue
      const attributeDefinitions: AttributeDefinition[] = []
      const specAttrs = findOne(el, 'SPEC-ATTRIBUTES') ?? el
      for (const [tag, kind] of Object.entries(ATTR_DEF_LOCAL)) {
        for (const def of findAll(specAttrs, tag)) {
          const defId = attr(def, 'IDENTIFIER')
          if (!defId) continue
          const typeNode = findOne(def, 'TYPE')
          attributeDefinitions.push({
            identifier: defId,
            kind,
            longName: attr(def, 'LONG-NAME'),
            lastChange: attr(def, 'LAST-CHANGE'),
            datatypeRef: firstRefText(typeNode),
          })
        }
      }
      out.push({
        identifier,
        longName: attr(el, 'LONG-NAME'),
        lastChange: attr(el, 'LAST-CHANGE'),
        attributeDefinitions,
      })
    }
  }
  return out
}

function parseSpecRelationTypes(content: OrderedNode | undefined): SpecRelationType[] {
  const out: SpecRelationType[] = []
  const specTypes = findOne(content, 'SPEC-TYPES')
  const searchRoots = specTypes ? [specTypes] : content ? [content] : []
  for (const root of searchRoots) {
    for (const el of findAll(root, 'SPEC-RELATION-TYPE')) {
      const identifier = attr(el, 'IDENTIFIER')
      if (!identifier) continue
      out.push({
        identifier,
        longName: attr(el, 'LONG-NAME'),
        lastChange: attr(el, 'LAST-CHANGE'),
      })
    }
  }
  return out
}

function parseSpecificationTypes(content: OrderedNode | undefined): SpecificationType[] {
  const out: SpecificationType[] = []
  const specTypes = findOne(content, 'SPEC-TYPES')
  const searchRoots = specTypes ? [specTypes] : content ? [content] : []
  for (const root of searchRoots) {
    for (const el of findAll(root, 'SPECIFICATION-TYPE')) {
      const identifier = attr(el, 'IDENTIFIER')
      if (!identifier) continue
      out.push({
        identifier,
        longName: attr(el, 'LONG-NAME'),
        lastChange: attr(el, 'LAST-CHANGE'),
      })
    }
  }
  return out
}

/* ------------------------------------------------------------------ *
 * SPEC-OBJECT attribute value resolution (pass 2)
 * ------------------------------------------------------------------ */

/**
 * The IDENTIFIER of the ATTRIBUTE-DEFINITION a value is bound to. Handles the
 * standard `<DEFINITION><ATTRIBUTE-DEFINITION-*-REF>id</...>` shape and the
 * legacy `<DEFINITION><IDENTIFIER>id</IDENTIFIER></DEFINITION>` shape.
 */
function definitionRefOf(valueEl: OrderedNode): string | undefined {
  const def = findOne(valueEl, 'DEFINITION')
  if (!def) {
    return firstRefText(valueEl)
  }
  const ref = firstRefText(def)
  if (ref) return ref
  // Legacy: <DEFINITION><IDENTIFIER>id</IDENTIFIER></DEFINITION>
  const ident = findOne(def, 'IDENTIFIER')
  if (ident) {
    const t = elementText(ident)
    if (t) return t
  }
  return elementText(def) || undefined
}

/** Resolve the value of an ATTRIBUTE-VALUE-* element. */
function resolveValue(
  valueEl: OrderedNode,
  kind: DatatypeKind,
  enumIndex: Map<string, EnumValue>,
): { value: string; isXhtml: boolean } {
  if (kind === 'XHTML') {
    const theValue = findOne(valueEl, 'THE-VALUE')
    return { value: xhtmlChildrenToHtml(theValue), isXhtml: true }
  }
  if (kind === 'ENUMERATION') {
    const valuesNode = findOne(valueEl, 'VALUES') ?? valueEl
    const refs: string[] = []
    for (const ref of findAll(valuesNode, 'ENUM-VALUE-REF')) {
      const r = elementText(ref)
      if (r) refs.push(r)
    }
    if (refs.length === 0) {
      const direct = attr(valueEl, 'THE-VALUE')
      if (direct) return { value: direct, isXhtml: false }
    }
    const labels = refs.map((id) => enumIndex.get(id)?.longName ?? id)
    return { value: labels.join(', '), isXhtml: false }
  }
  // STRING / INTEGER / REAL / BOOLEAN / DATE.
  const direct = attr(valueEl, 'THE-VALUE')
  if (direct !== undefined) return { value: direct, isXhtml: false }
  const tv = findOne(valueEl, 'THE-VALUE')
  if (tv) return { value: elementText(tv), isXhtml: false }
  return { value: elementText(valueEl), isXhtml: false }
}

function parseSpecObjects(
  content: OrderedNode | undefined,
  enumIndex: Map<string, EnumValue>,
): SpecObject[] {
  const root = findOne(content, 'SPEC-OBJECTS') ?? content
  const elements = findAll(root, 'SPEC-OBJECT')
  if (elements.length > MAX_SPEC_OBJECTS) {
    throw new ReqIFLimitError(
      `ReqIF payload exceeds SPEC-OBJECT limit (${MAX_SPEC_OBJECTS} max, got ${elements.length})`,
    )
  }
  const out: SpecObject[] = []
  for (const el of elements) {
    const identifier = attr(el, 'IDENTIFIER')
    if (!identifier) continue
    const typeRef = firstRefText(findOne(el, 'TYPE'))
    const valuesRoot = findOne(el, 'VALUES') ?? el
    const values: AttributeValue[] = []
    for (const [tag, kind] of Object.entries(ATTR_VALUE_LOCAL)) {
      for (const valueEl of findAll(valuesRoot, tag)) {
        const definitionRef = definitionRefOf(valueEl)
        const resolved = resolveValue(valueEl, kind, enumIndex)
        values.push({
          definitionRef: definitionRef ?? '',
          kind,
          value: resolved.value,
          isXhtml: resolved.isXhtml,
        })
      }
    }
    // Generic <ATTRIBUTE-VALUE> (legacy fixture shape) — treat as STRING.
    for (const valueEl of findAll(valuesRoot, 'ATTRIBUTE-VALUE')) {
      const definitionRef = definitionRefOf(valueEl)
      const resolved = resolveValue(valueEl, 'STRING', enumIndex)
      values.push({
        definitionRef: definitionRef ?? '',
        kind: 'STRING',
        value: resolved.value,
        isXhtml: false,
      })
    }
    out.push({
      identifier,
      longName: attr(el, 'LONG-NAME'),
      lastChange: attr(el, 'LAST-CHANGE'),
      typeRef,
      values,
    })
  }
  return out
}

/* ------------------------------------------------------------------ *
 * SPEC-RELATION + SPEC-HIERARCHY (pass 2)
 * ------------------------------------------------------------------ */

/** The SPEC-OBJECT IDENTIFIER referenced by a SOURCE / TARGET / OBJECT node. */
function endpointRef(node: OrderedNode | undefined): string | undefined {
  if (!node) return undefined
  const refAttr = attr(node, 'REF')
  if (refAttr) return refAttr
  const ref = firstRefText(node)
  if (ref) return ref
  return elementText(node) || undefined
}

function parseSpecRelations(content: OrderedNode | undefined): SpecRelation[] {
  const root = findOne(content, 'SPEC-RELATIONS') ?? content
  const elements = findAll(root, 'SPEC-RELATION')
  if (elements.length > MAX_SPEC_RELATIONS) {
    throw new ReqIFLimitError(
      `ReqIF payload exceeds SPEC-RELATION limit (${MAX_SPEC_RELATIONS} max, got ${elements.length})`,
    )
  }
  const out: SpecRelation[] = []
  for (const el of elements) {
    const sourceRef = endpointRef(findOne(el, 'SOURCE'))
    const targetRef = endpointRef(findOne(el, 'TARGET'))
    if (!sourceRef || !targetRef) continue
    out.push({
      identifier: attr(el, 'IDENTIFIER') ?? `${sourceRef}->${targetRef}`,
      longName: attr(el, 'LONG-NAME'),
      lastChange: attr(el, 'LAST-CHANGE'),
      typeRef: firstRefText(findOne(el, 'TYPE')),
      sourceRef,
      targetRef,
    })
  }
  return out
}

let hierarchyNodeBudget = 0

function parseHierarchyNode(el: OrderedNode): SpecHierarchy {
  hierarchyNodeBudget++
  if (hierarchyNodeBudget > MAX_HIERARCHY_NODES) {
    throw new ReqIFLimitError(
      `ReqIF payload exceeds SPEC-HIERARCHY node limit (${MAX_HIERARCHY_NODES} max)`,
    )
  }
  const objNode = findOne(el, 'OBJECT')
  const childrenRoot = findOne(el, 'CHILDREN') ?? el
  return {
    identifier: attr(el, 'IDENTIFIER') ?? '',
    lastChange: attr(el, 'LAST-CHANGE'),
    objectRef: objNode ? endpointRef(objNode) : undefined,
    children: findAll(childrenRoot, 'SPEC-HIERARCHY').map(parseHierarchyNode),
  }
}

function parseSpecifications(content: OrderedNode | undefined): Specification[] {
  hierarchyNodeBudget = 0
  const root = findOne(content, 'SPECIFICATIONS') ?? content
  const elements = findAll(root, 'SPECIFICATION')
  const out: Specification[] = []
  for (const el of elements) {
    const identifier = attr(el, 'IDENTIFIER')
    if (!identifier) continue
    const childrenRoot = findOne(el, 'CHILDREN') ?? el
    out.push({
      identifier,
      longName: attr(el, 'LONG-NAME'),
      lastChange: attr(el, 'LAST-CHANGE'),
      typeRef: firstRefText(findOne(el, 'TYPE')),
      children: findAll(childrenRoot, 'SPEC-HIERARCHY').map(parseHierarchyNode),
    })
  }
  return out
}

/* ------------------------------------------------------------------ *
 * Header
 * ------------------------------------------------------------------ */

function parseHeader(reqifRoot: OrderedNode): ReqIFHeader {
  const headerWrap = findOne(reqifRoot, 'THE-HEADER') ?? findOne(reqifRoot, 'HEADER')
  const h = findOne(headerWrap, 'REQ-IF-HEADER') ?? headerWrap
  return {
    identifier: attr(h, 'IDENTIFIER'),
    creationTime: attr(h, 'CREATION-TIME'),
    reqIfVersion: attr(h, 'REQ-IF-VERSION'),
    sourceToolId: attr(h, 'SOURCE-TOOL-ID'),
    toolId: attr(h, 'TOOL-ID'),
    title: attr(h, 'TITLE'),
    comment: attr(h, 'COMMENT'),
  }
}

/* ------------------------------------------------------------------ *
 * Public entry point
 * ------------------------------------------------------------------ */

/**
 * Parse a ReqIF 1.x XML document into the typed `ReqIFModel`.
 *
 * @throws {ReqIFStructureError} when the XML is not a recognisable ReqIF doc.
 * @throws {ReqIFLimitError}     when a structural DoS cap is exceeded.
 * @throws {Error}               (via parseXmlSafely) on malformed XML / DOCTYPE.
 */
export function parseReqIFDocument(xml: string): ReqIFModel {
  // Guard: rejects DOCTYPE (XXE) and malformed XML — throws on failure.
  parseXmlSafely(xml)

  // Re-parse in preserveOrder mode so XHTML mixed content keeps document order.
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    preserveOrder: true,
    processEntities: false,
    htmlEntities: false,
    textNodeName: '#text',
    parseTagValue: false,
    parseAttributeValue: false,
    // Keep XHTML whitespace verbatim (table layout, indentation).
    trimValues: false,
  })
  let raw: unknown
  try {
    raw = parser.parse(xml)
  } catch (e) {
    throw new ReqIFStructureError(`Malformed ReqIF XML: ${(e as Error).message}`)
  }

  // The document is an ordered array of single-key top-level nodes.
  const topNodes = Array.isArray(raw) ? (raw as OrderedNode[]) : []
  const reqifRoot = findOne(topNodes, 'REQ-IF')
  if (!reqifRoot) {
    throw new ReqIFStructureError('Not a ReqIF document: missing REQ-IF root element')
  }

  // CORE-CONTENT > REQ-IF-CONTENT (some exporters omit the CORE-CONTENT wrap).
  const coreContent = findOne(reqifRoot, 'CORE-CONTENT')
  const content =
    findOne(coreContent ?? reqifRoot, 'REQ-IF-CONTENT') ?? coreContent ?? reqifRoot

  const warnings: string[] = []

  const header = parseHeader(reqifRoot)
  const datatypes = parseDatatypes(content)
  const specObjectTypes = parseSpecObjectTypes(content)
  const specRelationTypes = parseSpecRelationTypes(content)
  const specificationTypes = parseSpecificationTypes(content)

  const enumIndex = new Map<string, EnumValue>()
  for (const dt of datatypes) {
    for (const ev of dt.enumValues ?? []) enumIndex.set(ev.identifier, ev)
  }

  const specObjects = parseSpecObjects(content, enumIndex)
  const specRelations = parseSpecRelations(content)
  const specifications = parseSpecifications(content)

  if (specObjects.length === 0 && specifications.length === 0 && specRelations.length === 0) {
    warnings.push('ReqIF document contained no SPEC-OBJECTs, SPECIFICATIONs or SPEC-RELATIONs')
  }

  return {
    header,
    datatypes,
    specObjectTypes,
    specRelationTypes,
    specificationTypes,
    specObjects,
    specRelations,
    specifications,
    warnings,
  }
}
