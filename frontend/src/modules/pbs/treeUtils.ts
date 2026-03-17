/**
 * PBS tree helpers — build tree from flat list, filter, get path.
 */

import type { PBSNode } from './types'

export interface TreeNode extends PBSNode {
  children: TreeNode[]
}

export function buildTree(nodes: PBSNode[]): TreeNode[] {
  const byParent = new Map<string | null, PBSNode[]>()
  nodes.forEach((n) => {
    const key = n.parentId ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(n)
  })
  byParent.forEach((list) => list.sort((a, b) => a.orderIndex - b.orderIndex))

  function children(parentId: string | null): TreeNode[] {
    return (byParent.get(parentId) ?? []).map((n) => ({
      ...n,
      children: children(n.id),
    }))
  }
  return children(null)
}

export interface TreeFilter {
  query: string
  type: string | null
  status: string | null
}

export function filterTree(tree: TreeNode[], filter: TreeFilter | string): TreeNode[] {
  // Support both old string-only API and new filter object
  const { query, type, status } = typeof filter === 'string'
    ? { query: filter, type: null, status: null }
    : filter

  const q = query.trim().toLowerCase()
  const hasFilters = q || type || status

  if (!hasFilters) return tree

  function matches(node: TreeNode): boolean {
    // Type filter
    if (type && node.type !== type) return false
    // Status filter
    if (status && node.status !== status) return false
    // Text search
    if (q) {
      const name = node.name.toLowerCase()
      const code = node.pbsCode.toLowerCase()
      const tags = node.tags.join(' ').toLowerCase()
      if (!name.includes(q) && !code.includes(q) && !tags.includes(q)) return false
    }
    return true
  }

  function includeNode(node: TreeNode): TreeNode | null {
    const childResults = node.children.map(includeNode).filter(Boolean) as TreeNode[]
    if (matches(node)) {
      return { ...node, children: childResults }
    }
    if (childResults.length > 0) {
      return { ...node, children: childResults }
    }
    return null
  }

  return tree.map(includeNode).filter(Boolean) as TreeNode[]
}

export function getNodePath(nodes: PBSNode[], nodeId: string): PBSNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const path: PBSNode[] = []
  let current = byId.get(nodeId)
  while (current) {
    path.unshift(current)
    current = current.parentId ? byId.get(current.parentId) ?? undefined : undefined
  }
  return path
}

export function isDescendant(nodes: PBSNode[], parentId: string, childId: string): boolean {
  let current = nodes.find((n) => n.id === childId)
  while (current) {
    if (current.id === parentId) return true
    current = current.parentId ? nodes.find((n) => n.id === current!.parentId) ?? undefined : undefined
  }
  return false
}

export function flattenTree(tree: TreeNode[]): PBSNode[] {
  const out: PBSNode[] = []
  function walk(nodes: TreeNode[]) {
    nodes.forEach((n) => {
      out.push(n)
      walk(n.children)
    })
  }
  walk(tree)
  return out
}

/** Flatten tree to list of (node, level) for virtualization. */
export function flattenTreeWithLevel(tree: TreeNode[], level = 0): { node: TreeNode; level: number }[] {
  const out: { node: TreeNode; level: number }[] = []
  function walk(nodes: TreeNode[], l: number) {
    nodes.forEach((n) => {
      out.push({ node: n, level: l })
      walk(n.children, l + 1)
    })
  }
  walk(tree, level)
  return out
}
