import { prisma } from '../lib/prisma'


export interface ProjectUnitRecord {
  id: string
  projectId: string
  name: string
  symbol: string
  description: string | null
  category: string | null
  createdAt: string
}

export async function listProjectUnits(projectId: string): Promise<ProjectUnitRecord[]> {
  const rows = await prisma.projectUnit.findMany({
    where: { projectId },
    orderBy: { symbol: 'asc' },
  })
  return rows.map(r => ({
    id: r.id,
    projectId: r.projectId,
    name: r.name,
    symbol: r.symbol,
    description: r.description,
    category: r.category,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function createProjectUnit(
  projectId: string,
  data: { name: string; symbol: string; description?: string; category?: string }
): Promise<ProjectUnitRecord> {
  const row = await prisma.projectUnit.create({
    data: {
      projectId,
      name: data.name.trim(),
      symbol: data.symbol.trim(),
      description: data.description?.trim() ?? null,
      category: data.category?.trim() ?? null,
    },
  })
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    symbol: row.symbol,
    description: row.description,
    category: row.category,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function updateProjectUnit(
  id: string,
  projectId: string,
  data: { name?: string; symbol?: string; description?: string; category?: string }
): Promise<ProjectUnitRecord> {
  const row = await prisma.projectUnit.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.symbol !== undefined ? { symbol: data.symbol.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
      ...(data.category !== undefined ? { category: data.category.trim() || null } : {}),
    },
  })
  if (row.projectId !== projectId) throw new Error('Not found')
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    symbol: row.symbol,
    description: row.description,
    category: row.category,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function getProjectUnit(projectId: string, id: string): Promise<ProjectUnitRecord | null> {
  const row = await prisma.projectUnit.findFirst({ where: { id, projectId } })
  if (!row) return null
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    symbol: row.symbol,
    description: row.description,
    category: row.category,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function deleteProjectUnit(id: string, projectId: string): Promise<void> {
  const row = await prisma.projectUnit.findUnique({ where: { id } })
  if (!row || row.projectId !== projectId) throw new Error('Not found')
  await prisma.projectUnit.delete({ where: { id } })
}

export async function countUnitUsage(projectId: string, symbol: string): Promise<number> {
  return prisma.parameter.count({ where: { projectId, unit: symbol } })
}
