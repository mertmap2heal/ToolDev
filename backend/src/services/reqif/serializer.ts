/**
 * ReqIF 1.x serializer (NX-1).
 *
 * Turns a typed `ReqIFModel` into a ReqIF XML string with a real
 * DATATYPES / SPEC-TYPES / SPEC-OBJECTS / SPEC-RELATIONS / SPECIFICATIONS
 * block, so a re-import of our own export reconstructs the same typed objects,
 * the same typed links, and the same SPEC-HIERARCHY tree.
 *
 * The serializer is package-neutral: the exporter builds the model; this file
 * only renders it. It mirrors the structural shape `parameterReqif.service.ts`
 * already uses for SPEC-TYPES / DATATYPES / SPEC-HIERARCHY.
 */
import { XMLBuilder } from 'fast-xml-parser'
import type {
  AttributeDefinition,
  AttributeValue,
  Datatype,
  ReqIFModel,
  SpecHierarchy,
  SpecObject,
  SpecObjectType,
} from './model'

/** Escape text for an XML attribute value. */
function escAttr(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** The XML element tag for a datatype kind. */
function datatypeTag(kind: Datatype['kind']): string {
  return `DATATYPE-DEFINITION-${kind}`
}
/** The XML element tag for an attribute-definition kind. */
function attrDefTag(kind: AttributeDefinition['kind']): string {
  return `ATTRIBUTE-DEFINITION-${kind}`
}
/** The XML element tag for an attribute-value kind. */
function attrValueTag(kind: AttributeValue['kind']): string {
  return `ATTRIBUTE-VALUE-${kind}`
}
/** The `*-REF` element name pointing at a datatype of this kind. */
function datatypeRefTag(kind: Datatype['kind']): string {
  return `DATATYPE-DEFINITION-${kind}-REF`
}

/**
 * Build the fast-xml-parser object for one DATATYPE-DEFINITION-*.
 */
function buildDatatype(dt: Datatype): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@_IDENTIFIER': dt.identifier,
  }
  if (dt.lastChange) node['@_LAST-CHANGE'] = dt.lastChange
  if (dt.longName) node['@_LONG-NAME'] = dt.longName
  if (dt.kind === 'STRING' && dt.maxLength) node['@_MAX-LENGTH'] = dt.maxLength
  if ((dt.kind === 'INTEGER' || dt.kind === 'REAL') && dt.min) node['@_MIN'] = dt.min
  if ((dt.kind === 'INTEGER' || dt.kind === 'REAL') && dt.max) node['@_MAX'] = dt.max
  if (dt.kind === 'REAL' && dt.accuracy) node['@_ACCURACY'] = dt.accuracy
  if (dt.kind === 'ENUMERATION' && dt.enumValues && dt.enumValues.length) {
    node['SPECIFIED-VALUES'] = {
      'ENUM-VALUE': dt.enumValues.map((ev) => {
        const evNode: Record<string, unknown> = { '@_IDENTIFIER': ev.identifier }
        if (ev.longName) evNode['@_LONG-NAME'] = ev.longName
        if (ev.key) {
          evNode['PROPERTIES'] = { 'EMBEDDED-VALUE': { '@_KEY': ev.key, '@_OTHER-CONTENT': '' } }
        }
        return evNode
      }),
    }
  }
  return node
}

/**
 * Build one ATTRIBUTE-DEFINITION-* node. The TYPE points at its datatype.
 */
function buildAttributeDefinition(def: AttributeDefinition): Record<string, unknown> {
  const node: Record<string, unknown> = { '@_IDENTIFIER': def.identifier }
  if (def.lastChange) node['@_LAST-CHANGE'] = def.lastChange
  if (def.longName) node['@_LONG-NAME'] = def.longName
  if (def.datatypeRef) {
    node['TYPE'] = { [datatypeRefTag(def.kind)]: def.datatypeRef }
  }
  return node
}

/**
 * Build one SPEC-OBJECT-TYPE node, grouping its attribute definitions by kind.
 */
function buildSpecObjectType(t: SpecObjectType): Record<string, unknown> {
  const node: Record<string, unknown> = { '@_IDENTIFIER': t.identifier }
  if (t.lastChange) node['@_LAST-CHANGE'] = t.lastChange
  if (t.longName) node['@_LONG-NAME'] = t.longName
  if (t.attributeDefinitions.length) {
    const specAttrs: Record<string, unknown[]> = {}
    for (const def of t.attributeDefinitions) {
      const tag = attrDefTag(def.kind)
      ;(specAttrs[tag] ??= []).push(buildAttributeDefinition(def))
    }
    node['SPEC-ATTRIBUTES'] = specAttrs
  }
  return node
}

/**
 * Build one ATTRIBUTE-VALUE-* node. XHTML values are emitted as a THE-VALUE
 * element carrying the raw HTML; the builder is told (via the unparsed marker)
 * to keep that markup verbatim.
 */
function buildAttributeValue(
  v: AttributeValue,
  defKindByRef: Map<string, AttributeDefinition['kind']>,
): { tag: string; node: Record<string, unknown> } {
  const kind = v.isXhtml ? 'XHTML' : (defKindByRef.get(v.definitionRef) ?? v.kind)
  const tag = attrValueTag(kind)
  const refTag = `ATTRIBUTE-DEFINITION-${kind}-REF`
  const node: Record<string, unknown> = {
    DEFINITION: { [refTag]: v.definitionRef },
  }
  if (kind === 'XHTML') {
    // THE-VALUE element carrying the HTML payload. fast-xml-parser would
    // escape raw markup, so we emit a sentinel <THE-VALUE> whose single
    // `XHTMLPAYLOAD` attribute holds the URI-encoded HTML, then splice the
    // real markup back in after the build (see serializeReqIFModel).
    node['THE-VALUE'] = { '@_XHTMLPAYLOAD': encodeURIComponent(v.value) }
  } else if (kind === 'ENUMERATION') {
    node['VALUES'] = { 'ENUM-VALUE-REF': v.value }
  } else {
    node['@_THE-VALUE'] = v.value
  }
  return { tag, node }
}

/**
 * Build one SPEC-OBJECT node.
 */
function buildSpecObject(
  so: SpecObject,
  defKindByRef: Map<string, AttributeDefinition['kind']>,
): Record<string, unknown> {
  const node: Record<string, unknown> = { '@_IDENTIFIER': so.identifier }
  if (so.lastChange) node['@_LAST-CHANGE'] = so.lastChange
  if (so.longName) node['@_LONG-NAME'] = so.longName
  if (so.typeRef) node['TYPE'] = { 'SPEC-OBJECT-TYPE-REF': so.typeRef }
  if (so.values.length) {
    const values: Record<string, unknown[]> = {}
    for (const v of so.values) {
      const { tag, node: vNode } = buildAttributeValue(v, defKindByRef)
      ;(values[tag] ??= []).push(vNode)
    }
    node['VALUES'] = values
  }
  return node
}

/** Recursively build a SPEC-HIERARCHY node. */
function buildHierarchy(h: SpecHierarchy): Record<string, unknown> {
  const node: Record<string, unknown> = { '@_IDENTIFIER': h.identifier }
  if (h.lastChange) node['@_LAST-CHANGE'] = h.lastChange
  if (h.objectRef) node['OBJECT'] = { 'SPEC-OBJECT-REF': h.objectRef }
  if (h.children.length) {
    node['CHILDREN'] = { 'SPEC-HIERARCHY': h.children.map(buildHierarchy) }
  }
  return node
}

const REQIF_NS = 'http://www.omg.org/spec/ReqIF/20110401/reqif.xsd'
const XHTML_NS = 'http://www.w3.org/1999/xhtml'

/**
 * Serialise a `ReqIFModel` to a ReqIF 1.x XML string.
 */
export function serializeReqIFModel(model: ReqIFModel): string {
  // Index attribute-definition kinds so a value's emitted element tag matches
  // its definition (a value carrying XHTML must emit ATTRIBUTE-VALUE-XHTML).
  const defKindByRef = new Map<string, AttributeDefinition['kind']>()
  for (const t of model.specObjectTypes) {
    for (const def of t.attributeDefinitions) {
      defKindByRef.set(def.identifier, def.kind)
    }
  }

  // DATATYPES — grouped by kind element.
  const datatypesBlock: Record<string, unknown[]> = {}
  for (const dt of model.datatypes) {
    ;(datatypesBlock[datatypeTag(dt.kind)] ??= []).push(buildDatatype(dt))
  }

  // SPEC-TYPES — object types + relation types + specification types.
  const specTypesBlock: Record<string, unknown> = {}
  if (model.specObjectTypes.length) {
    specTypesBlock['SPEC-OBJECT-TYPE'] = model.specObjectTypes.map(buildSpecObjectType)
  }
  if (model.specRelationTypes.length) {
    specTypesBlock['SPEC-RELATION-TYPE'] = model.specRelationTypes.map((t) => {
      const n: Record<string, unknown> = { '@_IDENTIFIER': t.identifier }
      if (t.lastChange) n['@_LAST-CHANGE'] = t.lastChange
      if (t.longName) n['@_LONG-NAME'] = t.longName
      return n
    })
  }
  if (model.specificationTypes.length) {
    specTypesBlock['SPECIFICATION-TYPE'] = model.specificationTypes.map((t) => {
      const n: Record<string, unknown> = { '@_IDENTIFIER': t.identifier }
      if (t.lastChange) n['@_LAST-CHANGE'] = t.lastChange
      if (t.longName) n['@_LONG-NAME'] = t.longName
      return n
    })
  }

  // SPEC-OBJECTS.
  const specObjectNodes = model.specObjects.map((so) => buildSpecObject(so, defKindByRef))

  // SPEC-RELATIONS.
  const specRelationNodes = model.specRelations.map((rel) => {
    const n: Record<string, unknown> = { '@_IDENTIFIER': rel.identifier }
    if (rel.lastChange) n['@_LAST-CHANGE'] = rel.lastChange
    if (rel.longName) n['@_LONG-NAME'] = rel.longName
    if (rel.typeRef) n['TYPE'] = { 'SPEC-RELATION-TYPE-REF': rel.typeRef }
    n['SOURCE'] = { 'SPEC-OBJECT-REF': rel.sourceRef }
    n['TARGET'] = { 'SPEC-OBJECT-REF': rel.targetRef }
    return n
  })

  // SPECIFICATIONS — each with its SPEC-HIERARCHY tree.
  const specificationNodes = model.specifications.map((spec) => {
    const n: Record<string, unknown> = { '@_IDENTIFIER': spec.identifier }
    if (spec.lastChange) n['@_LAST-CHANGE'] = spec.lastChange
    if (spec.longName) n['@_LONG-NAME'] = spec.longName
    if (spec.typeRef) n['TYPE'] = { 'SPECIFICATION-TYPE-REF': spec.typeRef }
    if (spec.children.length) {
      n['CHILDREN'] = { 'SPEC-HIERARCHY': spec.children.map(buildHierarchy) }
    }
    return n
  })

  const reqIfContent: Record<string, unknown> = {}
  if (Object.keys(datatypesBlock).length) reqIfContent['DATATYPES'] = datatypesBlock
  if (Object.keys(specTypesBlock).length) reqIfContent['SPEC-TYPES'] = specTypesBlock
  if (specObjectNodes.length) reqIfContent['SPEC-OBJECTS'] = { 'SPEC-OBJECT': specObjectNodes }
  if (specRelationNodes.length) {
    reqIfContent['SPEC-RELATIONS'] = { 'SPEC-RELATION': specRelationNodes }
  }
  if (specificationNodes.length) {
    reqIfContent['SPECIFICATIONS'] = { 'SPECIFICATION': specificationNodes }
  }

  const header: Record<string, unknown> = {
    '@_IDENTIFIER': model.header.identifier ?? `reqif-${Date.now()}`,
    'CREATION-TIME': model.header.creationTime ?? new Date().toISOString(),
    'REQ-IF-VERSION': model.header.reqIfVersion ?? '1.2',
  }
  if (model.header.sourceToolId) header['SOURCE-TOOL-ID'] = model.header.sourceToolId
  if (model.header.toolId) header['TOOL-ID'] = model.header.toolId
  if (model.header.title) header['TITLE'] = model.header.title
  if (model.header.comment) header['COMMENT'] = model.header.comment

  const doc: Record<string, unknown> = {
    'REQ-IF': {
      '@_xmlns': REQIF_NS,
      '@_xmlns:xhtml': XHTML_NS,
      'THE-HEADER': { 'REQ-IF-HEADER': header },
      'CORE-CONTENT': { 'REQ-IF-CONTENT': reqIfContent },
    },
  }

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true,
    suppressEmptyNode: true,
    processEntities: false,
  })
  let xml = builder.build(doc) as string

  // Splice the verbatim XHTML payloads back in. fast-xml-parser would escape
  // the HTML markup if we passed it as text; instead we marked each XHTML
  // THE-VALUE with an `XHTMLPAYLOAD` attribute holding the URI-encoded HTML
  // and replace the element here. URI-encoding sidesteps every XML / HTML
  // escaping interaction — the payload survives the builder byte-for-byte.
  // The payload is already wrapped in its own <div> by the exporter / parser,
  // so we do not add another wrapper.
  xml = xml.replace(
    /<THE-VALUE\s+XHTMLPAYLOAD="([^"]*)"\s*\/>/g,
    (_m, encoded: string) => {
      const html = decodeURIComponent(encoded)
      return `<THE-VALUE>${html}</THE-VALUE>`
    },
  )

  return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`
}
