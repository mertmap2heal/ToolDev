import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Collect component ID and all descendant IDs for inclusive filtering.
 * Used for requirement filtering by PBS component (e.g. baselines, requirement list).
 */
export async function collectComponentIdAndDescendants(
  projectId: string,
  componentId: string
): Promise<string[]> {
  const components = await prisma.component.findMany({
    where: { projectId },
    select: { id: true, parentId: true },
  })
  const ids = new Set<string>()
  function addRecursive(id: string) {
    ids.add(id)
    components.filter((c) => c.parentId === id).forEach((c) => addRecursive(c.id))
  }
  const root = components.find((c) => c.id === componentId)
  if (root) addRecursive(root.id)
  return Array.from(ids)
}
