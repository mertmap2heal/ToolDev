import { prisma } from '../lib/prisma'


const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB base64-encoded limit

export async function list(projectId: string) {
  return prisma.corporateDocxTemplate.findMany({
    where: { projectId },
    select: { id: true, projectId: true, name: true, description: true, placeholders: true, createdById: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getOne(projectId: string, id: string) {
  return prisma.corporateDocxTemplate.findFirst({ where: { projectId, id } })
}

export async function create(
  projectId: string,
  dto: { name: string; description?: string; fileBase64: string; placeholders?: string[] },
  userId?: string
) {
  const name = (dto.name ?? '').trim().slice(0, 80)
  if (!name) {
    const err = new Error('Template name is required'); (err as any).code = 'VALIDATION'; throw err
  }
  if (!dto.fileBase64 || dto.fileBase64.length === 0) {
    const err = new Error('File content is required'); (err as any).code = 'VALIDATION'; throw err
  }
  if (dto.fileBase64.length > MAX_FILE_BYTES) {
    const err = new Error('File too large (max 5 MB)'); (err as any).code = 'FILE_TOO_LARGE'; throw err
  }

  try {
    return await prisma.corporateDocxTemplate.create({
      data: {
        projectId,
        name,
        description: dto.description?.trim().slice(0, 500) ?? null,
        fileBase64: dto.fileBase64,
        placeholders: dto.placeholders ? JSON.stringify(dto.placeholders) : null,
        createdById: userId ?? null,
      },
    })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      const err = new Error('A template with this name already exists'); (err as any).code = 'DUPLICATE_NAME'; throw err
    }
    throw e
  }
}

export async function remove(projectId: string, id: string) {
  const existing = await getOne(projectId, id)
  if (!existing) return null
  await prisma.corporateDocxTemplate.delete({ where: { id } })
  return { id }
}
