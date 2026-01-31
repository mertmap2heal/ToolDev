/**
 * PBS Validation - Check for structural and data issues
 */

import type { PBSNode } from './types'

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  id: string
  nodeId: string | null
  nodeName: string | null
  nodeCode: string | null
  severity: ValidationSeverity
  message: string
  suggestion?: string
}

export interface ValidationResult {
  issues: ValidationIssue[]
  errorCount: number
  warningCount: number
  infoCount: number
  isValid: boolean
}

const MAX_HIERARCHY_DEPTH = 10

export function validatePBS(nodes: PBSNode[]): ValidationResult {
  const issues: ValidationIssue[] = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  let issueCounter = 0

  function createIssue(
    nodeId: string | null,
    severity: ValidationSeverity,
    message: string,
    suggestion?: string
  ): ValidationIssue {
    const node = nodeId ? nodeMap.get(nodeId) : null
    return {
      id: `issue-${++issueCounter}`,
      nodeId,
      nodeName: node?.name ?? null,
      nodeCode: node?.pbsCode ?? null,
      severity,
      message,
      suggestion,
    }
  }

  // Check each node
  nodes.forEach((node) => {
    // 1. Empty name check
    if (!node.name || node.name.trim() === '') {
      issues.push(
        createIssue(
          node.id,
          'error',
          'Component has no name',
          'Add a descriptive name to this component'
        )
      )
    }

    // 2. Empty description warning (info level)
    if (!node.description || node.description.trim() === '') {
      issues.push(
        createIssue(
          node.id,
          'info',
          'Component has no description',
          'Consider adding a description for better documentation'
        )
      )
    }

    // 3. Check for orphaned nodes (parentId points to non-existent node)
    if (node.parentId && !nodeMap.has(node.parentId)) {
      issues.push(
        createIssue(
          node.id,
          'error',
          'Orphaned component - parent does not exist',
          'Move this component to an existing parent or make it a root component'
        )
      )
    }

    // 4. Check for circular references
    const visited = new Set<string>()
    let current: PBSNode | undefined = node
    while (current && current.parentId) {
      if (visited.has(current.id)) {
        issues.push(
          createIssue(
            node.id,
            'error',
            'Circular reference detected in hierarchy',
            'Check parent-child relationships for loops'
          )
        )
        break
      }
      visited.add(current.id)
      current = nodeMap.get(current.parentId)
    }

    // 5. Check hierarchy depth
    let depth = 1
    let parent = node.parentId ? nodeMap.get(node.parentId) : null
    while (parent) {
      depth++
      parent = parent.parentId ? nodeMap.get(parent.parentId) : null
    }
    if (depth > MAX_HIERARCHY_DEPTH) {
      issues.push(
        createIssue(
          node.id,
          'warning',
          `Hierarchy depth (${depth}) exceeds recommended limit of ${MAX_HIERARCHY_DEPTH}`,
          'Consider restructuring to reduce nesting depth'
        )
      )
    }

    // 6. Check for duplicate sibling names
    const siblings = nodes.filter(
      (n) => n.parentId === node.parentId && n.id !== node.id
    )
    const hasDuplicateName = siblings.some(
      (s) => s.name.toLowerCase() === node.name.toLowerCase()
    )
    if (hasDuplicateName && node.name.trim() !== '') {
      issues.push(
        createIssue(
          node.id,
          'warning',
          'Duplicate name among siblings',
          'Consider using unique names for clarity'
        )
      )
    }

    // 7. Check for broken relationships
    const relationships = node.relationships ?? []
    relationships.forEach((rel) => {
      if (!nodeMap.has(rel.targetId)) {
        issues.push(
          createIssue(
            node.id,
            'warning',
            `Relationship points to deleted component`,
            'Remove or update the broken relationship'
          )
        )
      }
    })

    // 8. Self-referencing relationship check
    relationships.forEach((rel) => {
      if (rel.targetId === node.id) {
        issues.push(
          createIssue(
            node.id,
            'error',
            'Component has a relationship to itself',
            'Remove the self-referencing relationship'
          )
        )
      }
    })
  })

  // Global checks

  // 9. Check for multiple root nodes (info - not necessarily bad)
  const rootNodes = nodes.filter((n) => !n.parentId)
  if (rootNodes.length > 3) {
    issues.push(
      createIssue(
        null,
        'info',
        `${rootNodes.length} root-level components found`,
        'Consider organizing under a single top-level system if appropriate'
      )
    )
  }

  // 10. Check for empty PBS
  if (nodes.length === 0) {
    issues.push(
      createIssue(
        null,
        'info',
        'No components defined',
        'Add components to build your product breakdown structure'
      )
    )
  }

  // Calculate counts
  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length
  const infoCount = issues.filter((i) => i.severity === 'info').length

  return {
    issues,
    errorCount,
    warningCount,
    infoCount,
    isValid: errorCount === 0,
  }
}
