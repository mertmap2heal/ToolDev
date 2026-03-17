/**
 * PBS page handlers — in .ts to avoid TSX parse ambiguity with typed arrow params.
 */

import type { Dispatch, SetStateAction } from 'react'
import type { PBSNode, PBSChangeLogEntry } from './types'
import { generateId, generatePbsCode, nowISO } from './utils'

type NullableString = string | null

const DEFAULT_NODE = {
  parentId: null as string | null,
  name: '',
  type: 'System' as const,
  status: 'Draft' as const,
  description: '',
  tags: [] as string[],
  attributes: [] as PBSNode['attributes'],
  relationships: [] as PBSNode['relationships'],
  attachments: [] as PBSNode['attachments'],
  revision: 1,
}

function addChangeLogEntry(
  changeLog: PBSChangeLogEntry[],
  nodeId: string,
  action: PBSChangeLogEntry['action'],
  details?: string
): PBSChangeLogEntry[] {
  return [
    ...changeLog,
    {
      id: generateId(),
      nodeId,
      action,
      timestamp: nowISO(),
      details,
    },
  ]
}

function createNewNode(parentId: string | null, nodes: PBSNode[]): PBSNode {
  const parent = parentId ? nodes.find((n) => n.id === parentId) ?? null : null
  const siblings = parentId
    ? nodes.filter((n) => n.parentId === parentId).sort((a, b) => a.orderIndex - b.orderIndex)
    : nodes.filter((n) => !n.parentId).sort((a, b) => a.orderIndex - b.orderIndex)
  const siblingCodes = siblings.map((n) => n.pbsCode)
  const pbsCode = generatePbsCode(parent?.pbsCode ?? null, siblingCodes)
  const orderIndex = siblings.length
  const existingIds = new Set(nodes.map((n) => n.id))
  let id = generateId()
  while (existingIds.has(id)) {
    id = generateId()
  }
  const now = nowISO()
  return {
    ...DEFAULT_NODE,
    id,
    parentId: parentId ?? null,
    name: parent ? 'New component' : 'New root',
    pbsCode,
    orderIndex,
    createdAt: now,
    updatedAt: now,
  }
}

export interface PBSHandlersContext {
  nodes: PBSNode[]
  setNodes: Dispatch<SetStateAction<PBSNode[]>>
  setChangeLog: Dispatch<SetStateAction<PBSChangeLogEntry[]>>
  selectedId: string | null
  setSelectedId: Dispatch<SetStateAction<string | null>>
  setRenameNodeId: Dispatch<SetStateAction<string | null>>
  setAddDropdownOpen: Dispatch<SetStateAction<boolean>>
  markUnsaved: () => void
}

export interface PBSHandlers {
  addNode: (parentId: NullableString) => void
  addRoot: () => void
  addChild: (parentId: string) => void
  addSibling: (nodeId: string) => void
  rename: (nodeId: string) => void
  duplicateNode: (nodeId: string) => void
  deleteNode: (nodeId: string) => void
  moveNode: (nodeId: string, targetParentId: NullableString, targetOrderIndex: number) => void
  updateNode: (updates: Partial<PBSNode>) => void
}

export function createPBSHandlers(ctx: PBSHandlersContext): PBSHandlers {
  const {
    nodes,
    setNodes,
    setChangeLog,
    selectedId,
    setSelectedId,
    setRenameNodeId,
    setAddDropdownOpen,
    markUnsaved,
  } = ctx

  function addNode(parentId: NullableString) {
    const newNode = createNewNode(parentId, nodes)
    setNodes((prev) => [...prev, newNode])
    setChangeLog((prev) => addChangeLogEntry(prev, newNode.id, 'created', 'Created node'))
    markUnsaved()
    setSelectedId(newNode.id)
    setAddDropdownOpen(false)
  }

  function addRoot() {
    addNode(null)
  }

  function addChild(parentId: string) {
    addNode(parentId)
  }

  function addSibling(nodeId: string) {
    const node = nodes.find((n) => n.id === nodeId)
    if (node) addNode(node.parentId)
  }

  function rename(nodeId: string) {
    setRenameNodeId(nodeId)
  }

  function duplicateNode(nodeId: string) {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    const parent = node.parentId ? nodes.find((n) => n.id === node.parentId) ?? null : null
    const siblings = node.parentId
      ? nodes.filter((n) => n.parentId === node.parentId).sort((a, b) => a.orderIndex - b.orderIndex)
      : nodes.filter((n) => !n.parentId).sort((a, b) => a.orderIndex - b.orderIndex)
    const pbsCode = generatePbsCode(parent?.pbsCode ?? null, siblings.map((n) => n.pbsCode))
    const orderIndex = siblings.length
    const id = generateId()
    const now = nowISO()
    const newNode: PBSNode = {
      ...node,
      id,
      pbsCode,
      orderIndex,
      createdAt: now,
      updatedAt: now,
      name: `${node.name} (copy)`,
    }
    setNodes((prev) => [...prev, newNode])
    setChangeLog((prev) => addChangeLogEntry(prev, id, 'created', `Duplicated from ${node.pbsCode}`))
    markUnsaved()
    setSelectedId(id)
  }

  function deleteNode(nodeId: string) {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    const children = nodes.filter((n) => n.parentId === nodeId)
    const message =
      children.length > 0
        ? `Delete "${node.name}" and its ${children.length} descendant(s)? This cannot be undone.`
        : `Delete "${node.name}"?`
    if (!window.confirm(message)) return
    const toRemove = new Set<string>()
    function collect(id: string) {
      toRemove.add(id)
      nodes.filter((n) => n.parentId === id).forEach((n) => collect(n.id))
    }
    collect(nodeId)
    setNodes((prev) => prev.filter((n) => !toRemove.has(n.id)))
    setChangeLog((prev) => {
      let next = prev
      toRemove.forEach((id) => {
        next = addChangeLogEntry(next, id, 'deleted')
      })
      return next
    })
    markUnsaved()
    if (selectedId === nodeId || toRemove.has(selectedId!)) setSelectedId(null)
  }

  function moveNode(nodeId: string, targetParentId: NullableString, targetOrderIndex: number) {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    if (targetParentId) {
      let cur: PBSNode | undefined = nodes.find((n) => n.id === targetParentId)
      while (cur) {
        if (cur.id === nodeId) return
        cur = cur.parentId ? nodes.find((n) => n.id === cur!.parentId) : undefined
      }
    }
    setNodes((prev) => {
      const without = prev.filter((n) => n.id !== nodeId)
      const siblings = targetParentId
        ? without.filter((n) => n.parentId === targetParentId).sort((a, b) => a.orderIndex - b.orderIndex)
        : without.filter((n) => !n.parentId).sort((a, b) => a.orderIndex - b.orderIndex)
      const parent = targetParentId ? without.find((n) => n.id === targetParentId) ?? null : null
      const newPbsCode = generatePbsCode(parent?.pbsCode ?? null, siblings.map((n) => n.pbsCode))
      const inserted: PBSNode = {
        ...node,
        parentId: targetParentId,
        orderIndex: targetOrderIndex,
        pbsCode: newPbsCode,
        updatedAt: nowISO(),
        revision: node.revision + 1,
      }
      const newSiblings = [...siblings.slice(0, targetOrderIndex), inserted, ...siblings.slice(targetOrderIndex)].map(
        (n, i) => ({ ...n, orderIndex: i })
      )
      const others = without.filter((n) => (n.parentId ?? null) !== targetParentId)
      return [...others, ...newSiblings]
    })
    setChangeLog((prev) => addChangeLogEntry(prev, nodeId, 'moved'))
    markUnsaved()
  }

  function updateNode(updates: Partial<PBSNode>) {
    if (!selectedId) return
    setNodes((prev) =>
      prev.map((n) =>
        n.id === selectedId
          ? { ...n, ...updates, updatedAt: nowISO(), revision: n.revision + 1 }
          : n
      )
    )
    setChangeLog((prev) => addChangeLogEntry(prev, selectedId, 'updated'))
    markUnsaved()
  }

  return {
    addNode,
    addRoot,
    addChild,
    addSibling,
    rename,
    duplicateNode,
    deleteNode,
    moveNode,
    updateNode,
  }
}

export { addChangeLogEntry }
