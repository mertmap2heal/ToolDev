import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function ensureProjectExists(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  })
  if (!project) {
    throw new Error('Project not found')
  }
}

export const templateService = {
  async list(
    projectId: string,
    opts: { type?: 'TEST_CASE' | 'TEST_PLAN'; includeArchived?: boolean } = {}
  ) {
    await ensureProjectExists(projectId)

    const where: any = {
      projectId,
      deletedAt: null,
    }
    if (opts.type) {
      where.type = opts.type
    }
    if (!opts.includeArchived) {
      where.status = { not: 'ARCHIVED' }
    }

    const list = await prisma.verTemplate.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    })
    return list
  },

  async get(projectId: string, id: string) {
    await ensureProjectExists(projectId)

    const t = await prisma.verTemplate.findFirst({
      where: { id, projectId, deletedAt: null },
      include: {
        versions: { orderBy: { version: 'desc' } },
      },
    })
    if (!t) throw new Error('Template not found')
    return t
  },

  async create(projectId: string, data: { type: 'TEST_CASE' | 'TEST_PLAN'; name: string }) {
    await ensureProjectExists(projectId)

    const created = await prisma.verTemplate.create({
      data: {
        projectId,
        type: data.type,
        name: data.name,
        status: 'DRAFT',
        version: 1,
      },
    })
    return created
  },

  async update(
    projectId: string,
    id: string,
    data: { name?: string; contentJson?: any }
  ) {
    await ensureProjectExists(projectId)

    const existing = await prisma.verTemplate.findFirst({
      where: { id, projectId, deletedAt: null },
    })
    if (!existing) throw new Error('Template not found')
    if (existing.status !== 'DRAFT') {
      throw new Error('Only draft templates can be updated')
    }

    const updated = await prisma.verTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.contentJson !== undefined && { contentJson: data.contentJson }),
      },
    })
    return updated
  },

  async publish(projectId: string, id: string) {
    await ensureProjectExists(projectId)

    const existing = await prisma.verTemplate.findFirst({
      where: { id, projectId, deletedAt: null },
    })
    if (!existing) throw new Error('Template not found')

    const content = (existing.contentJson as object) || {}
    await prisma.verTemplateVersion.create({
      data: {
        templateId: id,
        version: existing.version,
        contentJson: content,
      },
    })

    const updated = await prisma.verTemplate.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        version: existing.version + 1,
      },
    })
    return updated
  },

  async duplicate(projectId: string, id: string) {
    await ensureProjectExists(projectId)

    const existing = await prisma.verTemplate.findFirst({
      where: { id, projectId, deletedAt: null },
    })
    if (!existing) throw new Error('Template not found')

    const duplicated = await prisma.verTemplate.create({
      data: {
        projectId,
        type: existing.type,
        name: `${existing.name} (copy)`,
        status: 'DRAFT',
        version: 1,
        contentJson: existing.contentJson ?? undefined,
      },
    })
    return duplicated
  },

  async archive(projectId: string, id: string) {
    await ensureProjectExists(projectId)

    const existing = await prisma.verTemplate.findFirst({
      where: { id, projectId, deletedAt: null },
    })
    if (!existing) throw new Error('Template not found')

    const updated = await prisma.verTemplate.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    })
    return updated
  },

  async softDelete(projectId: string, id: string) {
    await ensureProjectExists(projectId)

    const existing = await prisma.verTemplate.findFirst({
      where: { id, projectId, deletedAt: null },
    })
    if (!existing) throw new Error('Template not found')

    await prisma.verTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  },
}
