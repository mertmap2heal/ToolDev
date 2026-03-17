import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export type ExportJobStatus = 'pending' | 'running' | 'done' | 'failed'
export type ExportJobFormat = 'csv' | 'excel' | 'pdf' | 'word' | 'reqif'

function normalizeFormat(input: unknown): ExportJobFormat {
  const v = String(input ?? '').toLowerCase()
  if (v === 'csv' || v === 'excel' || v === 'pdf' || v === 'word' || v === 'reqif') return v
  return 'pdf'
}

function normalizeStatus(input: unknown): ExportJobStatus {
  const v = String(input ?? '').toLowerCase()
  if (v === 'pending' || v === 'running' || v === 'done' || v === 'failed') return v
  return 'pending'
}

export async function list(projectId: string) {
  return prisma.exportJob.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function getOne(projectId: string, id: string) {
  return prisma.exportJob.findFirst({ where: { projectId, id } })
}

export async function create(
  projectId: string,
  dto: {
    format: ExportJobFormat
    totalCount: number
    label?: string
  },
  userId?: string
) {
  return prisma.exportJob.create({
    data: {
      projectId,
      createdById: userId ?? null,
      format: normalizeFormat(dto.format),
      status: 'pending',
      progress: 0,
      totalCount: dto.totalCount ?? 0,
      doneCount: 0,
      label: dto.label?.trim().slice(0, 120) ?? null,
    },
  })
}

export async function update(
  projectId: string,
  id: string,
  dto: {
    status?: ExportJobStatus
    progress?: number
    doneCount?: number
    error?: string
  }
) {
  const existing = await getOne(projectId, id)
  if (!existing) return null

  const patch: Record<string, unknown> = {}
  if (dto.status !== undefined) patch.status = normalizeStatus(dto.status)
  if (dto.progress !== undefined) patch.progress = Math.max(0, Math.min(100, dto.progress))
  if (dto.doneCount !== undefined) patch.doneCount = Math.max(0, dto.doneCount)
  if (dto.error !== undefined) patch.error = dto.error?.slice(0, 500) ?? null

  return prisma.exportJob.update({ where: { id }, data: patch })
}

export async function remove(projectId: string, id: string) {
  const existing = await getOne(projectId, id)
  if (!existing) return null
  await prisma.exportJob.delete({ where: { id } })
  return { id }
}

export async function clearCompleted(projectId: string) {
  const { count } = await prisma.exportJob.deleteMany({
    where: { projectId, status: { in: ['done', 'failed'] } },
  })
  return { count }
}
