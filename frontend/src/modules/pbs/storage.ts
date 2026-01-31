/**
 * PBS persistence — localStorage only, project-scoped.
 * No backend interaction. Keys: pbs::<projectId> or pbs::default.
 */

import type { PBSNode, PBSChangeLogEntry } from './types'

const KEY_PREFIX = 'pbs::'

function storageKey(projectId: string | undefined): string {
  return projectId ? `${KEY_PREFIX}${projectId}` : `${KEY_PREFIX}default`
}

export interface PBSData {
  nodes: PBSNode[]
  changeLog: PBSChangeLogEntry[]
}

const DEFAULT_DATA: PBSData = {
  nodes: [],
  changeLog: [],
}

// Normalize node to ensure all fields exist (backward compatibility)
function normalizeNode(node: Partial<PBSNode>): PBSNode {
  return {
    id: node.id ?? '',
    parentId: node.parentId ?? null,
    name: node.name ?? '',
    pbsCode: node.pbsCode ?? '',
    type: node.type ?? 'System',
    status: node.status ?? 'Draft',
    description: node.description ?? '',
    tags: node.tags ?? [],
    attributes: node.attributes ?? [],
    relationships: node.relationships ?? [],
    attachments: node.attachments ?? [],
    orderIndex: node.orderIndex ?? 0,
    revision: node.revision ?? 1,
    createdAt: node.createdAt ?? new Date().toISOString(),
    updatedAt: node.updatedAt ?? new Date().toISOString(),
  }
}

export function loadPBS(projectId: string | undefined): PBSData {
  try {
    const key = storageKey(projectId)
    const raw = localStorage.getItem(key)
    if (!raw) return { ...DEFAULT_DATA }
    const parsed = JSON.parse(raw) as PBSData
    // Normalize nodes to ensure backward compatibility with old data
    const nodes = Array.isArray(parsed.nodes)
      ? parsed.nodes.map(normalizeNode)
      : DEFAULT_DATA.nodes
    return {
      nodes,
      changeLog: Array.isArray(parsed.changeLog) ? parsed.changeLog : DEFAULT_DATA.changeLog,
    }
  } catch {
    return { ...DEFAULT_DATA }
  }
}

export function savePBS(projectId: string | undefined, data: PBSData): void {
  try {
    const key = storageKey(projectId)
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // ignore
  }
}
