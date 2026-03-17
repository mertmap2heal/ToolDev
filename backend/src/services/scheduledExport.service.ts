import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function normalizeFormat(input: unknown): string {
  const v = String(input ?? '').toLowerCase()
  return ['csv', 'excel', 'pdf', 'word', 'reqif'].includes(v) ? v : 'pdf'
}

export async function list(projectId: string) {
  return prisma.scheduledExport.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getOne(projectId: string, id: string) {
  return prisma.scheduledExport.findFirst({ where: { projectId, id } })
}

export async function create(
  projectId: string,
  dto: {
    name: string
    description?: string
    templateId?: string
    scheduleExpr?: string
    format?: string
    enabled?: boolean
  },
  userId?: string
) {
  const name = (dto.name ?? '').trim().slice(0, 80)
  if (!name) {
    const err = new Error('Schedule name is required'); (err as any).code = 'VALIDATION'; throw err
  }
  try {
    return await prisma.scheduledExport.create({
      data: {
        projectId,
        name,
        description: dto.description?.trim().slice(0, 500) ?? null,
        templateId: dto.templateId ?? null,
        scheduleExpr: dto.scheduleExpr?.trim().slice(0, 100) ?? null,
        format: normalizeFormat(dto.format),
        enabled: dto.enabled ?? false,
        createdById: userId ?? null,
      },
    })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      const err = new Error('A schedule with this name already exists'); (err as any).code = 'DUPLICATE_NAME'; throw err
    }
    throw e
  }
}

export async function update(
  projectId: string,
  id: string,
  dto: {
    name?: string
    description?: string
    templateId?: string
    scheduleExpr?: string
    format?: string
    enabled?: boolean
  }
) {
  const existing = await getOne(projectId, id)
  if (!existing) return null
  const patch: Record<string, unknown> = {}
  if (dto.name !== undefined) {
    const name = dto.name.trim().slice(0, 80)
    if (!name) { const err = new Error('Schedule name is required'); (err as any).code = 'VALIDATION'; throw err }
    patch.name = name
  }
  if (dto.description !== undefined) patch.description = dto.description?.trim().slice(0, 500) ?? null
  if (dto.templateId !== undefined) patch.templateId = dto.templateId ?? null
  if (dto.scheduleExpr !== undefined) patch.scheduleExpr = dto.scheduleExpr?.trim().slice(0, 100) ?? null
  if (dto.format !== undefined) patch.format = normalizeFormat(dto.format)
  if (dto.enabled !== undefined) patch.enabled = Boolean(dto.enabled)

  try {
    return await prisma.scheduledExport.update({ where: { id }, data: patch })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      const err = new Error('A schedule with this name already exists'); (err as any).code = 'DUPLICATE_NAME'; throw err
    }
    throw e
  }
}

export async function remove(projectId: string, id: string) {
  const existing = await getOne(projectId, id)
  if (!existing) return null
  await prisma.scheduledExport.delete({ where: { id } })
  return { id }
}
