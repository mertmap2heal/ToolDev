import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'


// ── Types ────────────────────────────────────────────────────────────────────

export interface CommBusRecord {
  id: string
  projectId: string
  name: string
  description: string | null
  protocol: string
  config: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  _count?: { messages: number }
}

export interface CommMessageRecord {
  id: string
  busId: string
  name: string
  messageId: string | null
  direction: string | null
  description: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  _count?: { fields: number }
}

export interface CommFieldRecord {
  id: string
  messageId: string
  parameterId: string | null
  fieldName: string
  description: string | null
  dataType: string | null
  order: number
  config: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  parameter?: {
    id: string
    name: string
    dataType: string | null
    unit: string | null
    defaultValue: string | null
  } | null
}

// ── Buses ────────────────────────────────────────────────────────────────────

export async function listBuses(projectId: string): Promise<CommBusRecord[]> {
  const rows = await prisma.commBus.findMany({
    where: { projectId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { messages: true } } },
  })
  return rows.map(r => ({
    id: r.id,
    projectId: r.projectId,
    name: r.name,
    description: r.description,
    protocol: r.protocol,
    config: r.config as Record<string, unknown> | null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    _count: r._count,
  }))
}

export async function createBus(
  projectId: string,
  data: { name: string; description?: string; protocol: string; config?: Record<string, unknown> }
): Promise<CommBusRecord> {
  const row = await prisma.commBus.create({
    data: {
      projectId,
      name: data.name.trim(),
      description: data.description?.trim() ?? null,
      protocol: data.protocol,
      config: data.config as unknown as Prisma.InputJsonValue | undefined,
    },
    include: { _count: { select: { messages: true } } },
  })
  return {
    id: row.id, projectId: row.projectId, name: row.name, description: row.description,
    protocol: row.protocol, config: row.config as Record<string, unknown> | null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    _count: row._count,
  }
}

export async function updateBus(
  id: string,
  projectId: string,
  data: { name?: string; description?: string; protocol?: string; config?: Record<string, unknown> | null }
): Promise<CommBusRecord> {
  const row = await prisma.commBus.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.protocol !== undefined ? { protocol: data.protocol } : {}),
      ...(data.config !== undefined ? { config: data.config as unknown as Prisma.InputJsonValue | undefined } : {}),
    },
    include: { _count: { select: { messages: true } } },
  })
  if (row.projectId !== projectId) throw new Error('Not found')
  return {
    id: row.id, projectId: row.projectId, name: row.name, description: row.description,
    protocol: row.protocol, config: row.config as Record<string, unknown> | null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    _count: row._count,
  }
}

export async function deleteBus(id: string, projectId: string): Promise<void> {
  const row = await prisma.commBus.findUnique({ where: { id } })
  if (!row || row.projectId !== projectId) throw new Error('Not found')
  await prisma.commBus.delete({ where: { id } })
}

// ── Messages ─────────────────────────────────────────────────────────────────

export async function listMessages(busId: string): Promise<CommMessageRecord[]> {
  const rows = await prisma.commMessage.findMany({
    where: { busId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { fields: true } } },
  })
  return rows.map(r => ({
    id: r.id, busId: r.busId, name: r.name, messageId: r.messageId,
    direction: r.direction, description: r.description,
    metadata: r.metadata as Record<string, unknown> | null,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    _count: r._count,
  }))
}

export async function createMessage(
  busId: string,
  data: { name: string; messageId?: string; direction?: string; description?: string; metadata?: Record<string, unknown> }
): Promise<CommMessageRecord> {
  const row = await prisma.commMessage.create({
    data: {
      busId,
      name: data.name.trim(),
      messageId: data.messageId?.trim() || null,
      direction: data.direction || null,
      description: data.description?.trim() || null,
      metadata: data.metadata as unknown as Prisma.InputJsonValue | undefined,
    },
    include: { _count: { select: { fields: true } } },
  })
  return {
    id: row.id, busId: row.busId, name: row.name, messageId: row.messageId,
    direction: row.direction, description: row.description,
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    _count: row._count,
  }
}

export async function updateMessage(
  id: string,
  busId: string,
  data: { name?: string; messageId?: string | null; direction?: string | null; description?: string; metadata?: Record<string, unknown> | null }
): Promise<CommMessageRecord> {
  const row = await prisma.commMessage.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.messageId !== undefined ? { messageId: data.messageId?.trim() || null } : {}),
      ...(data.direction !== undefined ? { direction: data.direction || null } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.metadata !== undefined ? { metadata: data.metadata as unknown as Prisma.InputJsonValue | undefined } : {}),
    },
    include: { _count: { select: { fields: true } } },
  })
  if (row.busId !== busId) throw new Error('Not found')
  return {
    id: row.id, busId: row.busId, name: row.name, messageId: row.messageId,
    direction: row.direction, description: row.description,
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    _count: row._count,
  }
}

export async function deleteMessage(id: string): Promise<void> {
  await prisma.commMessage.delete({ where: { id } })
}

// ── Fields ────────────────────────────────────────────────────────────────────

export async function listFields(messageId: string): Promise<CommFieldRecord[]> {
  const rows = await prisma.commField.findMany({
    where: { messageId },
    orderBy: { order: 'asc' },
    include: {
      parameter: {
        select: { id: true, name: true, dataType: true, unit: true, defaultValue: true },
      },
    },
  })
  return rows.map(r => ({
    id: r.id, messageId: r.messageId, parameterId: r.parameterId,
    fieldName: r.fieldName, description: r.description,
    dataType: r.dataType, order: r.order,
    config: r.config as Record<string, unknown> | null,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    parameter: r.parameter,
  }))
}

export async function createField(
  messageId: string,
  data: { fieldName: string; parameterId?: string | null; description?: string; dataType?: string; order?: number; config?: Record<string, unknown> }
): Promise<CommFieldRecord> {
  const row = await prisma.commField.create({
    data: {
      messageId,
      fieldName: data.fieldName.trim(),
      parameterId: data.parameterId || null,
      description: data.description?.trim() || null,
      dataType: data.dataType?.trim() || null,
      order: data.order ?? 0,
      config: data.config as unknown as Prisma.InputJsonValue | undefined,
    },
    include: {
      parameter: { select: { id: true, name: true, dataType: true, unit: true, defaultValue: true } },
    },
  })
  return {
    id: row.id, messageId: row.messageId, parameterId: row.parameterId,
    fieldName: row.fieldName, description: row.description,
    dataType: row.dataType, order: row.order,
    config: row.config as Record<string, unknown> | null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    parameter: row.parameter,
  }
}

export async function updateField(
  id: string,
  data: { fieldName?: string; parameterId?: string | null; description?: string; dataType?: string | null; order?: number; config?: Record<string, unknown> | null }
): Promise<CommFieldRecord> {
  const row = await prisma.commField.update({
    where: { id },
    data: {
      ...(data.fieldName !== undefined ? { fieldName: data.fieldName.trim() } : {}),
      ...(data.parameterId !== undefined ? { parameterId: data.parameterId || null } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.dataType !== undefined ? { dataType: data.dataType?.trim() || null } : {}),
      ...(data.order !== undefined ? { order: data.order } : {}),
      ...(data.config !== undefined ? { config: data.config as unknown as Prisma.InputJsonValue | undefined } : {}),
    } as Prisma.CommFieldUncheckedUpdateInput,
    include: {
      parameter: { select: { id: true, name: true, dataType: true, unit: true, defaultValue: true } },
    },
  })
  return {
    id: row.id, messageId: row.messageId, parameterId: row.parameterId,
    fieldName: row.fieldName, description: row.description,
    dataType: row.dataType, order: row.order,
    config: row.config as Record<string, unknown> | null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    parameter: row.parameter,
  }
}

export async function deleteField(id: string): Promise<void> {
  await prisma.commField.delete({ where: { id } })
}

export async function reorderFields(messageId: string, orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, idx) =>
      prisma.commField.update({ where: { id }, data: { order: idx } })
    )
  )
}
