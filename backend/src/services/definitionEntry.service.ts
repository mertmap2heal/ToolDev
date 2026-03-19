import { prisma } from '../lib/prisma'


export type DefinitionEntryType = 'glossary' | 'abbreviation'

export interface CreateDefinitionEntryDto {
  type: DefinitionEntryType
  term: string
  definition: string
  notes?: string | null
  source?: string | null
}

export interface UpdateDefinitionEntryDto {
  type?: DefinitionEntryType
  term?: string
  definition?: string
  notes?: string | null
  source?: string | null
}

export async function listDefinitionEntries(
  projectId: string,
  opts: { type?: DefinitionEntryType; search?: string } = {}
) {
  const where: { projectId: string; type?: string; OR?: Array<{ term?: { contains: string; mode: 'insensitive' }; definition?: { contains: string; mode: 'insensitive' } }> } = {
    projectId,
  }
  if (opts.type) where.type = opts.type
  if (opts.search?.trim()) {
    const s = opts.search.trim()
    where.OR = [
      { term: { contains: s, mode: 'insensitive' } },
      { definition: { contains: s, mode: 'insensitive' } },
      { notes: { contains: s, mode: 'insensitive' } },
      { source: { contains: s, mode: 'insensitive' } },
    ]
  }
  return prisma.definitionEntry.findMany({
    where,
    orderBy: [{ type: 'asc' }, { term: 'asc' }],
  })
}

export async function getDefinitionEntry(projectId: string, id: string) {
  return prisma.definitionEntry.findFirst({
    where: { id, projectId },
  })
}

export async function createDefinitionEntry(
  projectId: string,
  dto: CreateDefinitionEntryDto,
  createdById?: string | null
) {
  const existing = await prisma.definitionEntry.findUnique({
    where: {
      projectId_term: { projectId, term: dto.term },
    },
  })
  if (existing) {
    const err = new Error('DUPLICATE_TERM') as Error & { code?: string; term?: string }
    err.code = 'DUPLICATE_TERM'
    err.term = dto.term
    throw err
  }
  return prisma.definitionEntry.create({
    data: {
      projectId,
      type: dto.type,
      term: dto.term.trim(),
      definition: dto.definition,
      notes: dto.notes?.trim() || null,
      source: dto.source?.trim() || null,
      createdById: createdById || null,
    },
  })
}

export async function updateDefinitionEntry(
  projectId: string,
  id: string,
  dto: UpdateDefinitionEntryDto
) {
  const existing = await prisma.definitionEntry.findFirst({
    where: { id, projectId },
  })
  if (!existing) return null
  if (dto.term !== undefined && dto.term.trim() !== existing.term) {
    const duplicate = await prisma.definitionEntry.findUnique({
      where: {
        projectId_term: { projectId, term: dto.term.trim() },
      },
    })
    if (duplicate) {
      const err = new Error('DUPLICATE_TERM') as Error & { code?: string; term?: string }
      err.code = 'DUPLICATE_TERM'
      err.term = dto.term
      throw err
    }
  }
  return prisma.definitionEntry.update({
    where: { id },
    data: {
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.term !== undefined && { term: dto.term.trim() }),
      ...(dto.definition !== undefined && { definition: dto.definition }),
      ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
      ...(dto.source !== undefined && { source: dto.source?.trim() || null }),
    },
  })
}

export async function deleteDefinitionEntry(projectId: string, id: string) {
  const existing = await prisma.definitionEntry.findFirst({
    where: { id, projectId },
  })
  if (!existing) return null
  await prisma.definitionEntry.delete({ where: { id } })
  return existing
}

/** Returns requirement id, requirementId, title for requirements that contain this definition term (case-sensitive). */
export async function getDefinitionUsage(projectId: string, id: string) {
  const entry = await prisma.definitionEntry.findFirst({
    where: { id, projectId },
    select: { term: true },
  })
  if (!entry) return null
  const requirements = await prisma.requirement.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true, requirementId: true, title: true, description: true },
  })
  const term = entry.term
  return requirements
    .filter((r) => (r.description || '').includes(term))
    .map(({ id: reqId, requirementId, title }) => ({ id: reqId, requirementId, title }))
}
