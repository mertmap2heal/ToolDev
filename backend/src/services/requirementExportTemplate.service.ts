import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export type RequirementExportTemplateFormat = 'csv' | 'excel' | 'pdf' | 'word' | 'reqif'
export type TemplateVisibility = 'private' | 'project' | 'org'

function normalizeFormat(input: unknown): RequirementExportTemplateFormat {
  const v = String(input ?? '').toLowerCase()
  if (v === 'csv' || v === 'excel' || v === 'pdf' || v === 'word' || v === 'reqif') return v
  return 'pdf'
}

function normalizeVisibility(input: unknown): TemplateVisibility {
  const v = String(input ?? '').toLowerCase()
  if (v === 'private' || v === 'project' || v === 'org') return v
  return 'project'
}

export async function list(projectId: string) {
  return prisma.requirementExportTemplate.findMany({
    where: { projectId, deletedAt: null },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function listDeleted(projectId: string) {
  return prisma.requirementExportTemplate.findMany({
    where: { projectId, deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
  })
}

export async function getOne(projectId: string, id: string) {
  return prisma.requirementExportTemplate.findFirst({
    where: { projectId, id, deletedAt: null },
  })
}

export async function create(
  projectId: string,
  dto: { name: string; format: RequirementExportTemplateFormat; payload: unknown; visibility?: string },
  userId?: string
) {
  const name = (dto.name ?? '').trim().slice(0, 80)
  if (!name) {
    const err = new Error('Template name is required')
    ;(err as any).code = 'VALIDATION'
    throw err
  }
  const format = normalizeFormat(dto.format)
  const payload = (dto.payload ?? {}) as unknown
  const visibility = normalizeVisibility(dto.visibility)

  try {
    return await prisma.requirementExportTemplate.create({
      data: {
        projectId,
        name,
        format,
        payload: payload as any,
        visibility,
        createdById: userId ?? null,
      },
    })
  } catch (e: any) {
    // Prisma unique constraint violation
    if (e?.code === 'P2002') {
      const err = new Error('A template with this name already exists in this project')
      ;(err as any).code = 'DUPLICATE_NAME'
      throw err
    }
    throw e
  }
}

export async function update(
  projectId: string,
  id: string,
  dto: { name?: string; format?: RequirementExportTemplateFormat; payload?: unknown; visibility?: string }
) {
  const patch: Record<string, unknown> = {}
  if (dto.name !== undefined) {
    const name = dto.name.trim().slice(0, 80)
    if (!name) {
      const err = new Error('Template name is required')
      ;(err as any).code = 'VALIDATION'
      throw err
    }
    patch.name = name
  }
  if (dto.format !== undefined) patch.format = normalizeFormat(dto.format)
  if (dto.payload !== undefined) patch.payload = dto.payload as any
  if (dto.visibility !== undefined) patch.visibility = normalizeVisibility(dto.visibility)

  try {
    return await prisma.requirementExportTemplate.update({
      where: { id },
      data: patch,
    })
  } catch (e: any) {
    if (e?.code === 'P2025') return null
    if (e?.code === 'P2002') {
      const err = new Error('A template with this name already exists in this project')
      ;(err as any).code = 'DUPLICATE_NAME'
      throw err
    }
    throw e
  }
}

/** Soft-delete: sets deletedAt/deletedById, template becomes invisible in list/getOne. */
export async function remove(projectId: string, id: string, userId?: string) {
  const existing = await getOne(projectId, id)
  if (!existing) return null
  return prisma.requirementExportTemplate.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: userId ?? null },
  })
}

/** Restore a soft-deleted template back to the active list. */
export async function restore(projectId: string, id: string, userId?: string) {
  const existing = await prisma.requirementExportTemplate.findFirst({
    where: { projectId, id, deletedAt: { not: null } },
  })
  if (!existing) return null
  return prisma.requirementExportTemplate.update({
    where: { id },
    data: { deletedAt: null, deletedById: null },
  })
}

/** Permanently destroy an already-archived template. */
export async function permanentDelete(projectId: string, id: string) {
  const existing = await prisma.requirementExportTemplate.findFirst({
    where: { projectId, id, deletedAt: { not: null } },
  })
  if (!existing) return null
  await prisma.requirementExportTemplate.delete({ where: { id } })
  return { id }
}
