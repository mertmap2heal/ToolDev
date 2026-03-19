import { prisma } from '../lib/prisma'


export interface ColumnMappingEntry {
  systemField: string
  excelColumn: string
  namedRange?: string
}

export async function list(projectId: string) {
  return prisma.excelColumnMapping.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getOne(projectId: string, id: string) {
  return prisma.excelColumnMapping.findFirst({ where: { projectId, id } })
}

export async function create(
  projectId: string,
  dto: { name: string; description?: string; mappings: ColumnMappingEntry[] },
  userId?: string
) {
  const name = (dto.name ?? '').trim().slice(0, 80)
  if (!name) {
    const err = new Error('Mapping name is required'); (err as any).code = 'VALIDATION'; throw err
  }
  try {
    return await prisma.excelColumnMapping.create({
      data: {
        projectId,
        name,
        description: dto.description?.trim().slice(0, 500) ?? null,
        mappings: (dto.mappings ?? []) as any,
        createdById: userId ?? null,
      },
    })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      const err = new Error('A mapping with this name already exists'); (err as any).code = 'DUPLICATE_NAME'; throw err
    }
    throw e
  }
}

export async function update(
  projectId: string,
  id: string,
  dto: { name?: string; description?: string; mappings?: ColumnMappingEntry[] }
) {
  const existing = await getOne(projectId, id)
  if (!existing) return null
  const patch: Record<string, unknown> = {}
  if (dto.name !== undefined) {
    const name = dto.name.trim().slice(0, 80)
    if (!name) { const err = new Error('Mapping name is required'); (err as any).code = 'VALIDATION'; throw err }
    patch.name = name
  }
  if (dto.description !== undefined) patch.description = dto.description?.trim().slice(0, 500) ?? null
  if (dto.mappings !== undefined) patch.mappings = dto.mappings as any
  try {
    return await prisma.excelColumnMapping.update({ where: { id }, data: patch })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      const err = new Error('A mapping with this name already exists'); (err as any).code = 'DUPLICATE_NAME'; throw err
    }
    throw e
  }
}

export async function remove(projectId: string, id: string) {
  const existing = await getOne(projectId, id)
  if (!existing) return null
  await prisma.excelColumnMapping.delete({ where: { id } })
  return { id }
}
