import { Requirement } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { sendRequirementUpdateEmail } from './email.service'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

const LONG_TEXT_FIELDS = new Set(['description', 'acceptanceCriteria'])
const ID_FIELDS = new Set(['parentId', 'componentId', 'statusId', 'lifecycleId'])

export function buildRequirementChangeSummary(
  before: Requirement,
  after: Requirement
): string[] {
  const changes: string[] = []

  const addValueChange = (label: string, from: unknown, to: unknown, field?: string) => {
    if (from === to) return
    if (field && LONG_TEXT_FIELDS.has(field)) {
      changes.push(`${label} updated`)
      return
    }
    changes.push(`${label}: ${formatValue(from, field)} -> ${formatValue(to, field)}`)
  }

  addValueChange('Title', before.title, after.title, 'title')
  addValueChange('Description', before.description, after.description, 'description')
  addValueChange('Status', before.status, after.status, 'status')
  addValueChange('Priority', before.priority, after.priority, 'priority')
  addValueChange('Owner', before.owner, after.owner, 'owner')
  addValueChange('Parent', before.parentId, after.parentId, 'parentId')
  addValueChange('Component', before.componentId, after.componentId, 'componentId')
  addValueChange('Acceptance Criteria', before.acceptanceCriteria, after.acceptanceCriteria, 'acceptanceCriteria')
  addValueChange('Verification Method', before.verificationMethod, after.verificationMethod, 'verificationMethod')
  addValueChange('Review Status', before.reviewStatus, after.reviewStatus, 'reviewStatus')

  return changes
}

export async function notifyRequirementSubscribers(params: {
  projectId: string
  requirementId: string
  changes: string[]
  actorUserId?: string
  action?: 'updated' | 'deleted'
  requirementSnapshot?: Pick<Requirement, 'id' | 'requirementId' | 'title'>
}): Promise<void> {
  try {
    const { projectId, requirementId, changes, actorUserId, action, requirementSnapshot } = params

    if (!changes || changes.length === 0) {
      return
    }

    const requirement = requirementSnapshot
      ? requirementSnapshot
      : await prisma.requirement.findUnique({
          where: { id: requirementId },
          select: { id: true, requirementId: true, title: true },
        })

    if (!requirement) {
      return
    }

    const subscriptions = await prisma.requirementSubscription.findMany({
      where: { requirementId: requirement.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    if (subscriptions.length === 0) {
      return
    }

    const actor = actorUserId
      ? await prisma.user.findUnique({
          where: { id: actorUserId },
          select: { name: true },
        })
      : null

    const actorName = actor?.name || 'System'
    const requirementKey = requirement.requirementId || requirement.id.substring(0, 8)
    const link = `${APP_URL}/projects/${projectId}/requirements?requirementId=${requirement.id}`

    const recipients = subscriptions.filter((sub) => {
      if (!sub.user.email) return false
      if (actorUserId && sub.userId === actorUserId) return false
      return true
    })

    if (recipients.length === 0) {
      return
    }

    await Promise.all(
      recipients.map((sub) =>
        sendRequirementUpdateEmail({
          to: sub.user.email,
          requirementKey,
          requirementTitle: requirement.title,
          actorName,
          timestamp: new Date().toISOString(),
          changes,
          link,
          action,
        })
      )
    )

    await prisma.requirementSubscription.updateMany({
      where: {
        requirementId: requirement.id,
        userId: { in: recipients.map((sub) => sub.userId) },
      },
      data: { lastNotifiedAt: new Date() },
    })
  } catch (error) {
    console.warn('Requirement notification failed:', error)
  }
}

function formatValue(value: unknown, field?: string): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—'
  if (field && ID_FIELDS.has(field)) {
    const asString = String(value)
    return asString.length > 8 ? asString.substring(0, 8) : asString
  }
  return String(value)
}
