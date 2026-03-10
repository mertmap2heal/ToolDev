/**
 * PBS persistence — localStorage only, project-scoped.
 * Supports versioning for migration, optional gzip compression for large data,
 * and no new external dependencies.
 */

import type { PBSNode, PBSChangeLogEntry } from './types'
import { componentService } from '../../services/component.service'

const KEY_PREFIX = 'pbs::'
const STORAGE_VERSION = 2
const COMPRESSION_THRESHOLD_BYTES = 50 * 1024 // 50 KB — use gzip above this

function storageKey(projectId: string | undefined): string {
  return projectId ? `${KEY_PREFIX}${projectId}` : `${KEY_PREFIX}default`
}

export interface PBSData {
  nodes: PBSNode[]
  changeLog: PBSChangeLogEntry[]
}

interface StoredPayload {
  version?: number
  nodes: PBSNode[]
  changeLog: PBSChangeLogEntry[]
}

const DEFAULT_DATA: PBSData = {
  nodes: [],
  changeLog: [],
}

// Normalize node to ensure all fields exist (backward compatibility / migration)
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

function migrateAndNormalize(parsed: StoredPayload): PBSData {
  const version = parsed.version ?? 1
  const nodes = Array.isArray(parsed.nodes)
    ? parsed.nodes.map(normalizeNode)
    : DEFAULT_DATA.nodes
  const changeLog = Array.isArray(parsed.changeLog) ? parsed.changeLog : DEFAULT_DATA.changeLog
  return { nodes, changeLog }
}

function parsePayload(raw: string): PBSData {
  const parsed = JSON.parse(raw) as StoredPayload
  return migrateAndNormalize(parsed)
}

// Compression Streams API (built-in in modern browsers)
const canCompress = typeof CompressionStream !== 'undefined'
const canDecompress = typeof DecompressionStream !== 'undefined'

async function gzipEncode(str: string): Promise<string> {
  const blob = new Blob([str], { type: 'application/json' })
  const stream = blob.stream().pipeThrough(new CompressionStream('gzip'))
  const buf = await new Response(stream).arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

async function gzipDecode(base64: string): Promise<string> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return await new Response(stream).text()
}

/** Load PBS data (sync). Handles plain JSON and version migration. Compressed data must be loaded via loadPBSAsync. */
export function loadPBS(projectId: string | undefined): PBSData {
  try {
    const key = storageKey(projectId)
    const raw = localStorage.getItem(key)
    if (!raw) return { ...DEFAULT_DATA }
    if (raw.startsWith('z:')) {
      // Compressed — cannot decode sync; return default and let async load handle it
      return { ...DEFAULT_DATA }
    }
    return parsePayload(raw)
  } catch {
    return { ...DEFAULT_DATA }
  }
}

/** Load PBS data (async). Supports compressed storage. Prefer this when initializing the page. */
export async function loadPBSAsync(projectId: string | undefined): Promise<PBSData> {
  try {
    const key = storageKey(projectId)
    const raw = localStorage.getItem(key)
    if (!raw) return { ...DEFAULT_DATA }
    if (raw.startsWith('z:') && canDecompress) {
      const decoded = await gzipDecode(raw.slice(2))
      return parsePayload(decoded)
    }
    if (raw.startsWith('z:')) return { ...DEFAULT_DATA }
    return parsePayload(raw)
  } catch {
    return { ...DEFAULT_DATA }
  }
}

/** Save PBS data (sync). Uses plain JSON. For large data use savePBSAsync to enable compression. */
export function savePBS(projectId: string | undefined, data: PBSData): void {
  try {
    const key = storageKey(projectId)
    const payload: StoredPayload = { version: STORAGE_VERSION, nodes: data.nodes, changeLog: data.changeLog }
    const json = JSON.stringify(payload)
    localStorage.setItem(key, json)
  } catch {
    // ignore
  }
}

/** Save PBS data (async). Compresses when payload exceeds COMPRESSION_THRESHOLD_BYTES. */
export async function savePBSAsync(projectId: string | undefined, data: PBSData): Promise<void> {
  try {
    const key = storageKey(projectId)
    const payload: StoredPayload = { version: STORAGE_VERSION, nodes: data.nodes, changeLog: data.changeLog }
    const json = JSON.stringify(payload)
    const byteLength = new Blob([json]).size

    if (byteLength >= COMPRESSION_THRESHOLD_BYTES && canCompress) {
      const encoded = await gzipEncode(json)
      localStorage.setItem(key, 'z:' + encoded)
    } else {
      localStorage.setItem(key, json)
    }
  } catch {
    // ignore
  }
}

/** Approximate bytes used by the current PBS key (for quota warning). */
export function estimatePBSStorageBytes(projectId: string | undefined): number {
  try {
    const key = storageKey(projectId)
    const raw = localStorage.getItem(key)
    return raw ? new Blob([raw]).size : 0
  } catch {
    return 0
  }
}

/**
 * Convert flat PBSNode[] into a nested ComponentTreeNode-shaped tree.
 * Single source of truth — used by PBSPage, RequirementsPBSTree, FunctionsPBSTree, and RequirementsPage export.
 */
export function buildPBSComponentTree(projectId: string, nodes: PBSNode[]): any[] {
  const nodeMap = new Map<string, any>()
  const rootNodes: any[] = []
  nodes.forEach((node) => {
    nodeMap.set(node.id, {
      id: node.id,
      projectId,
      parentId: node.parentId,
      name: node.name,
      pbsCode: node.pbsCode,
      description: node.description,
      sortOrder: node.orderIndex ?? 0,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      children: [],
    })
  })
  nodes.forEach((node) => {
    const component = nodeMap.get(node.id)
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId).children.push(component)
    } else {
      rootNodes.push(component)
    }
  })
  const sortNodes = (n: any[]) => {
    n.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    n.forEach((child: any) => {
      if (child.children?.length) sortNodes(child.children)
    })
  }
  sortNodes(rootNodes)
  return rootNodes
}

/**
 * Load PBS nodes from localStorage and build a component tree.
 * Falls back to componentService.getComponentTree when no local PBS data exists.
 * Shared queryFn for the ['pbs-nodes', projectId] React Query key.
 */
export async function loadPBSComponentTreeAsync(projectId: string): Promise<any[]> {
  const pbsData = await loadPBSAsync(projectId)
  if (pbsData.nodes.length > 0) {
    return buildPBSComponentTree(projectId, pbsData.nodes)
  }
  const response = await componentService.getComponentTree(projectId)
  return response.success && response.data ? response.data : []
}

/** Check if Storage API quota is available and return usage/quota in bytes; otherwise null. */
export async function getStorageQuota(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (navigator.storage && typeof navigator.storage.estimate === 'function') {
      const est = await navigator.storage.estimate()
      const usage = typeof est.usage === 'number' ? est.usage : 0
      const quota = typeof est.quota === 'number' ? est.quota : 0
      return { usage, quota }
    }
  } catch {
    // ignore
  }
  return null
}
