/**
 * ReqIF 1.x typed model (NX-1).
 *
 * These structures are the single in-memory representation a ReqIF document
 * is parsed into and serialised from. They are deliberately package-neutral:
 * the Requirements importer/exporter consume them, and a future Parameters
 * unification co-ticket can consume the same `parser.ts` / `model.ts` with
 * no rewrite.
 *
 * The model mirrors the ReqIF 1.x element vocabulary (OMG ReqIF 1.0.1 / 1.2):
 *   DATATYPE-DEFINITION-*  -> Datatype
 *   SPEC-OBJECT-TYPE       -> SpecObjectType (+ AttributeDefinition[])
 *   SPEC-RELATION-TYPE     -> SpecRelationType
 *   SPEC-OBJECT            -> SpecObject (+ AttributeValue[])
 *   SPECIFICATION          -> Specification (+ SpecHierarchy tree)
 *   SPEC-HIERARCHY         -> SpecHierarchy (recursive)
 *   SPEC-RELATION          -> SpecRelation
 */

/** The five ReqIF datatype kinds NX-1 round-trips. */
export type DatatypeKind =
  | 'STRING'
  | 'XHTML'
  | 'INTEGER'
  | 'REAL'
  | 'BOOLEAN'
  | 'DATE'
  | 'ENUMERATION'

/** One `<ENUM-VALUE>` inside a `DATATYPE-DEFINITION-ENUMERATION`. */
export interface EnumValue {
  identifier: string
  longName?: string
  /** The OTHER-CONTENT/PROPERTIES key, when present. */
  key?: string
}

/** A `DATATYPE-DEFINITION-*` element. */
export interface Datatype {
  identifier: string
  kind: DatatypeKind
  longName?: string
  lastChange?: string
  /** STRING only. */
  maxLength?: string
  /** INTEGER / REAL. */
  min?: string
  max?: string
  /** REAL only. */
  accuracy?: string
  /** ENUMERATION only. */
  enumValues?: EnumValue[]
}

/** An `ATTRIBUTE-DEFINITION-*` element inside a SPEC-OBJECT-TYPE. */
export interface AttributeDefinition {
  identifier: string
  /** The ATTRIBUTE-DEFINITION-* kind (mirrors DatatypeKind). */
  kind: DatatypeKind
  longName?: string
  lastChange?: string
  /** IDENTIFIER of the referenced DATATYPE-DEFINITION-*. */
  datatypeRef?: string
}

/** A `SPEC-OBJECT-TYPE` element. */
export interface SpecObjectType {
  identifier: string
  longName?: string
  lastChange?: string
  attributeDefinitions: AttributeDefinition[]
}

/** A `SPEC-RELATION-TYPE` element. */
export interface SpecRelationType {
  identifier: string
  longName?: string
  lastChange?: string
}

/** A `SPECIFICATION-TYPE` element. */
export interface SpecificationType {
  identifier: string
  longName?: string
  lastChange?: string
}

/** A resolved attribute value on a SPEC-OBJECT. */
export interface AttributeValue {
  /** IDENTIFIER of the ATTRIBUTE-DEFINITION-* this value is bound to. */
  definitionRef: string
  /** The ATTRIBUTE-VALUE-* element kind. */
  kind: DatatypeKind
  /**
   * The value, as a string for all kinds except XHTML where it is the raw
   * (sanitised) inner HTML. ENUMERATION values are the resolved enum LONG-NAME(s).
   */
  value: string
  /** True when the value element was ATTRIBUTE-VALUE-XHTML. */
  isXhtml?: boolean
}

/** A `SPEC-OBJECT` element. */
export interface SpecObject {
  identifier: string
  longName?: string
  lastChange?: string
  /** IDENTIFIER of the SPEC-OBJECT-TYPE (resolved against the type dictionary). */
  typeRef?: string
  values: AttributeValue[]
}

/** A `SPEC-RELATION` element. */
export interface SpecRelation {
  identifier: string
  longName?: string
  lastChange?: string
  /** IDENTIFIER of the SPEC-RELATION-TYPE. */
  typeRef?: string
  /** IDENTIFIER of the source SPEC-OBJECT. */
  sourceRef: string
  /** IDENTIFIER of the target SPEC-OBJECT. */
  targetRef: string
}

/** A `SPEC-HIERARCHY` node — recursive, models the document tree. */
export interface SpecHierarchy {
  identifier: string
  lastChange?: string
  /** IDENTIFIER of the SPEC-OBJECT this node points at. */
  objectRef?: string
  /** Nested SPEC-HIERARCHY children. */
  children: SpecHierarchy[]
}

/** A `SPECIFICATION` element. */
export interface Specification {
  identifier: string
  longName?: string
  lastChange?: string
  /** IDENTIFIER of the SPECIFICATION-TYPE. */
  typeRef?: string
  /** Top-level SPEC-HIERARCHY children. */
  children: SpecHierarchy[]
}

/** The ReqIF header block. */
export interface ReqIFHeader {
  identifier?: string
  creationTime?: string
  reqIfVersion?: string
  sourceToolId?: string
  toolId?: string
  title?: string
  comment?: string
}

/**
 * The complete parsed ReqIF document — the typed model. Every `*-REF` in the
 * raw XML has been resolved against its `IDENTIFIER` dictionary by the parser,
 * so consumers never re-walk the tree.
 */
export interface ReqIFModel {
  header: ReqIFHeader
  datatypes: Datatype[]
  specObjectTypes: SpecObjectType[]
  specRelationTypes: SpecRelationType[]
  specificationTypes: SpecificationType[]
  specObjects: SpecObject[]
  specRelations: SpecRelation[]
  specifications: Specification[]
  /**
   * Non-fatal observations gathered while parsing — unknown datatype kinds,
   * dangling refs, etc. Surfaced to the user so lossy parsing is never silent.
   */
  warnings: string[]
}
