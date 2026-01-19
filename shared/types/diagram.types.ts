/**
 * Diagram type definitions for MBSE diagrams
 * Used by both frontend and backend
 */

/**
 * Valid SysML/UML diagram types
 */
export type DiagramType =
  | 'req'      // Requirements Diagram
  | 'bdd'      // Block Definition Diagram
  | 'ibd'      // Internal Block Diagram
  | 'par'      // Parametric Diagram
  | 'par-req'  // Parameter-Requirement Diagram
  | 'act'      // Activity Diagram
  | 'seq'      // Sequence Diagram
  | 'stm'      // State Machine Diagram
  | 'uc'       // Use Case Diagram
  | 'pkg'      // Package Diagram

/**
 * Element types that can be sources for diagrams
 */
export type SourceElementType = 'requirement' | 'function' | 'useCase' | 'parameter'

/**
 * Diagram layout structure for persisting node positions
 */
export interface DiagramLayout {
  nodes?: Array<{
    id: string
    position: { x: number; y: number }
  }>
  viewport?: {
    x: number
    y: number
    zoom: number
  }
  customData?: Record<string, unknown>
}

/**
 * Diagram entity as stored in the database
 */
export interface Diagram {
  id: string
  projectId: string
  diagramType: DiagramType
  name: string
  description?: string
  sourceElementId?: string
  sourceElementType?: SourceElementType
  layout?: DiagramLayout
  createdAt: string
  updatedAt: string
}

/**
 * DTO for creating a new diagram
 */
export interface CreateDiagramDto {
  diagramType: DiagramType
  name: string
  description?: string
  sourceElementId?: string
  sourceElementType?: SourceElementType
  layout?: DiagramLayout
  createTraceLink?: boolean
}

/**
 * DTO for updating an existing diagram
 */
export interface UpdateDiagramDto {
  name?: string
  description?: string
  layout?: DiagramLayout
}

/**
 * Diagram with linked element information
 */
export interface DiagramWithSource extends Diagram {
  sourceElement?: {
    id: string
    name: string
    type: SourceElementType
  }
}
