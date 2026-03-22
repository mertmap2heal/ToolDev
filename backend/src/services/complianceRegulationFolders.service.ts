import { prisma } from '../lib/prisma'

/** Walk parent chain from nodeId upward; return true if ancestorId is reached. */
export async function isAncestorOf(
  projectId: string,
  ancestorId: string,
  nodeId: string | null
): Promise<boolean> {
  if (!nodeId || nodeId === ancestorId) return nodeId === ancestorId
  const visited = new Set<string>()
  let current: string | null = nodeId
  while (current) {
    if (current === ancestorId) return true
    if (visited.has(current)) return false
    visited.add(current)
    const row: { parentId: string | null } | null = await prisma.complianceRegulationFolder.findFirst({
      where: { id: current, projectId },
      select: { parentId: true },
    })
    if (!row) return false
    current = row.parentId
  }
  return false
}

export async function assertFolderInProject(
  projectId: string,
  folderId: string
): Promise<{ id: string; parentId: string | null }> {
  const f = await prisma.complianceRegulationFolder.findFirst({
    where: { id: folderId, projectId },
    select: { id: true, parentId: true },
  })
  if (!f) {
    throw new Error('Folder not found or does not belong to this project')
  }
  return f
}

/** Returns normalized folderId or null when absent / empty. */
export async function resolveRuleFolderId(
  projectId: string,
  folderId: unknown
): Promise<string | null> {
  if (folderId === undefined || folderId === null || folderId === '') return null
  if (typeof folderId !== 'string') {
    throw new Error('folderId must be a string')
  }
  await assertFolderInProject(projectId, folderId)
  return folderId
}

export async function deleteRegulationFolder(projectId: string, folderId: string): Promise<void> {
  const folder = await prisma.complianceRegulationFolder.findFirst({
    where: { id: folderId, projectId },
    select: { id: true, parentId: true },
  })
  if (!folder) {
    throw new Error('Folder not found')
  }

  const promoteTo = folder.parentId

  await prisma.$transaction([
    prisma.complianceRegulationFolder.updateMany({
      where: { projectId, parentId: folderId },
      data: { parentId: promoteTo },
    }),
    prisma.complianceRule.updateMany({
      where: { projectId, folderId },
      data: { folderId: promoteTo },
    }),
    prisma.complianceRegulationFolder.delete({
      where: { id: folderId },
    }),
  ])
}
