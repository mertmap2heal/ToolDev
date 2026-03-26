import { Response } from 'express'
import { Prisma } from '@prisma/client'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import { linkageAuditService } from '../services/linkageAudit.service'
import { traceabilityService } from '../services/traceability.service'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const issueUploadsDir = path.join(__dirname, '../../uploads/issues')
if (!fs.existsSync(issueUploadsDir)) {
  fs.mkdirSync(issueUploadsDir, { recursive: true })
}

// Helper to create system notes
const createSystemNote = async (
  issueId: string,
  projectId: string,
  action: string,
  oldValue: string | null | undefined,
  newValue: string | null | undefined,
  userId: string | undefined,
  userName: string | undefined
) => {
  return prisma.issueSystemNote.create({
    data: {
      issueId,
      projectId,
      action,
      oldValue: oldValue || null,
      newValue: newValue || null,
      userId: userId || null,
      userName: userName || null,
    },
  })
}

/** Highest numeric suffix among keys matching ISS-<digits> (issueKey is globally @unique). */
async function getMaxIssueSequenceNumber(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ max: number | null }>>`
    SELECT MAX(
      CAST(SUBSTRING("issueKey" FROM 'ISS-([0-9]+)') AS INTEGER)
    ) AS max
    FROM "Issue"
    WHERE "issueKey" IS NOT NULL
      AND "issueKey" ~ '^ISS-[0-9]+$'
  `
  const raw = rows[0]?.max
  if (raw == null) return 0
  const n = typeof raw === 'bigint' ? Number(raw) : Number(raw)
  return Number.isFinite(n) ? n : 0
}

function formatIssueKey(sequence: number): string {
  return `ISS-${sequence.toString().padStart(4, '0')}`
}

function isIssueKeyUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false
  }
  const target = error.meta?.target
  return Array.isArray(target) && (target as string[]).includes('issueKey')
}

export const createIssue = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const {
      title,
      description,
      priority,
      issueType,
      owner,
      assigneeId,
      relatedFunctionIds,
      relatedParameterIds,
      labelIds,
      startDate,
      dueDate,
      estimatedTime,
      sourceRequirementId
    } = req.body

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Title and description are required',
      })
    }

    // Generate unique issue key (ISS-0001). Use numeric MAX (not string sort: ISS-10000 < ISS-9999 lexically)
    // and retry on P2002 for concurrent creates.
    const maxAttempts = 12
    let issue: Awaited<ReturnType<typeof prisma.issue.create>> | null = null
    let lastKeyError: unknown
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const nextSeq = (await getMaxIssueSequenceNumber()) + 1
      const issueKey = formatIssueKey(nextSeq)
      try {
        issue = await prisma.issue.create({
          data: {
            projectId,
            issueKey,
            title,
            description,
            priority: priority || 'medium',
            issueType: issueType || null,
            owner: owner || '',
            assigneeId,
            createdBy: req.userId,
            updatedBy: req.userId,
            relatedFunctionIds: relatedFunctionIds || [],
            relatedParameterIds: relatedParameterIds || [],
            labelIds: labelIds || [],
            startDate: startDate ? new Date(startDate) : null,
            dueDate: dueDate ? new Date(dueDate) : null,
            estimatedTime,
          },
        })
        break
      } catch (e) {
        if (isIssueKeyUniqueViolation(e)) {
          lastKeyError = e
          continue
        }
        throw e
      }
    }
    if (!issue) {
      throw lastKeyError ?? new Error('Could not allocate a unique issue key')
    }

    // Subscribe creator automatically
    if (req.userId) {
      await prisma.issueSubscription.create({
        data: {
          issueId: issue.id,
          userId: req.userId,
        },
      }).catch(() => { }) // Ignore if already subscribed
    }

    // Auto-link to requirement if created from one (IssueLink for Issues module + TraceLink for requirements UI / LINKAGE_V1)
    if (sourceRequirementId) {
      const requirement = await prisma.requirement.findFirst({
        where: { id: sourceRequirementId, projectId },
        select: { requirementId: true, title: true },
      })

      if (requirement) {
        await prisma.issueLink.create({
          data: {
            issueId: issue.id,
            linkedType: 'requirement',
            linkedId: sourceRequirementId,
            linkType: 'related',
            linkedRequirementKey: requirement.requirementId || null,
            linkedRequirementTitle: requirement.title || null,
            createdBy: req.userId || null,
          },
        })

        // Mirror in TraceLink so requirement linked-items, matrix, and PBS trees see the edge
        await traceabilityService.createTraceLink(
          projectId,
          'requirement',
          sourceRequirementId,
          'issue',
          issue.id,
          'tracked_by',
          undefined,
          'Auto-linked when issue was created from requirement',
          req.userId || undefined
        )
      }

      const userName = req.userId ? (await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } }))?.name : undefined
      await createSystemNote(
        issue.id,
        projectId,
        'link_added',
        null,
        `Requirement: ${requirement?.requirementId || sourceRequirementId}`,
        req.userId || undefined,
        userName || 'Unknown'
      )

      await linkageAuditService.log({
        projectId,
        entityType: 'REQUIREMENT',
        entityId: sourceRequirementId,
        action: 'ISSUE_LINKED',
        newValue: {
          issueId: issue.id,
          issueKey: issue.issueKey,
          title: issue.title
        },
        performedByUserId: req.userId || undefined,
      })
    }

    res.status(201).json({
      success: true,
      data: issue,
    })
  } catch (error: any) {
    console.error('Create issue error:', error)

    let errorMessage = 'Internal server error'
    if (error?.message) {
      errorMessage = error.message
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
    })
  }
}

export const getIssues = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    const issues = await prisma.issue.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    res.json({
      success: true,
      data: issues,
    })
  } catch (error: any) {
    console.error('Get issues error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const getIssue = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const issue = await prisma.issue.findUnique({
      where: { id },
    })

    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found',
      })
    }

    // Fetch creator and assignee details
    let createdByUser = null
    let assignee = null

    if (issue.createdBy) {
      createdByUser = await prisma.user.findUnique({
        where: { id: issue.createdBy },
        select: { id: true, name: true, email: true, avatarUrl: true },
      })
    }

    if (issue.assigneeId) {
      assignee = await prisma.user.findUnique({
        where: { id: issue.assigneeId },
        select: { id: true, name: true, email: true, avatarUrl: true },
      })
    }

    // Fetch labels
    const labels = issue.labelIds.length > 0
      ? await prisma.issueLabel.findMany({
        where: { id: { in: issue.labelIds } },
      })
      : []

    // Fetch links
    const links = await prisma.issueLink.findMany({
      where: { issueId: id },
    })

    // Fetch attachments
    const attachments = await prisma.issueAttachment.findMany({
      where: { issueId: id },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch subscribers
    const subscriptions = await prisma.issueSubscription.findMany({
      where: { issueId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    })

    const subscribers = subscriptions.map((s: any) => s.user)

    // Fetch participants (users who commented or made changes)
    const comments = await prisma.issueComment.findMany({
      where: { issueId: id },
      distinct: ['authorId'],
      select: { authorId: true },
    })

    const systemNotes = await prisma.issueSystemNote.findMany({
      where: { issueId: id, userId: { not: null } },
      distinct: ['userId'],
      select: { userId: true },
    })

    const participantIds = new Set([
      ...comments.map((c: any) => c.authorId),
      ...systemNotes.filter((n: any) => n.userId).map((n: any) => n.userId),
    ])

    const participants = await prisma.user.findMany({
      where: { id: { in: Array.from(participantIds) } },
      select: { id: true, name: true, email: true, avatarUrl: true },
    })

    res.json({
      success: true,
      data: {
        ...issue,
        createdByUser,
        assignee,
        labels,
        links,
        attachments,
        subscribers,
        participants,
      },
    })
  } catch (error) {
    console.error('Get issue error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const getIssueActivity = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { filter, sort } = req.query

    const issue = await prisma.issue.findUnique({ where: { id } })
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' })
    }

    // Fetch comments
    let comments: any[] = []
    if (!filter || filter === 'all' || filter === 'comments') {
      comments = await prisma.issueComment.findMany({
        where: { issueId: id },
        orderBy: { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
      })

      // Fetch author details
      const authorIds = [...new Set(comments.map(c => c.authorId))]
      const authors = await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, name: true, email: true, avatarUrl: true },
      })
      const authorMap = new Map(authors.map(a => [a.id, a]))

      comments = comments.map(c => ({
        ...c,
        author: authorMap.get(c.authorId),
      }))
    }

    // Fetch system notes
    let systemNotes: any[] = []
    if (!filter || filter === 'all' || filter === 'history') {
      systemNotes = await prisma.issueSystemNote.findMany({
        where: { issueId: id },
        orderBy: { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
      })

      // Fetch user details
      const userIds = [...new Set(systemNotes.filter(n => n.userId).map(n => n.userId!))]
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, avatarUrl: true },
      })
      const userMap = new Map(users.map(u => [u.id, u]))

      systemNotes = systemNotes.map(n => ({
        ...n,
        user: n.userId ? userMap.get(n.userId) : null,
      }))
    }

    // Combine and sort
    const activity = [
      ...comments.map(c => ({ type: 'comment', data: c, createdAt: c.createdAt })),
      ...systemNotes.map(n => ({ type: 'system_note', data: n, createdAt: n.createdAt })),
    ].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime()
      const bTime = new Date(b.createdAt).getTime()
      return sort === 'oldest' ? aTime - bTime : bTime - aTime
    })

    res.json({ success: true, data: activity })
  } catch (error) {
    console.error('Get issue activity error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const updateIssue = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const {
      title,
      description,
      priority,
      status,
      owner,
      assigneeId,
      relatedFunctionIds,
      relatedParameterIds,
      labelIds,
      startDate,
      dueDate,
      estimatedTime,
      actualTime
    } = req.body

    const issue = await prisma.issue.findUnique({
      where: { id },
    })

    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found',
      })
    }

    const userName = req.user?.name || 'Unknown'
    const userId = req.user?.userId

    // Track changes for system notes
    const changes: Array<{ action: string; oldValue: string | null; newValue: string | null }> = []

    if (title !== undefined && title !== issue.title) {
      changes.push({ action: 'title_changed', oldValue: issue.title, newValue: title })
    }

    if (description !== undefined && description !== issue.description) {
      changes.push({ action: 'description_updated', oldValue: null, newValue: null })
    }

    if (status !== undefined && status !== issue.status) {
      changes.push({ action: 'status_changed', oldValue: issue.status, newValue: status })
    }

    if (priority !== undefined && priority !== issue.priority) {
      changes.push({ action: 'priority_changed', oldValue: issue.priority, newValue: priority })
    }

    if (assigneeId !== undefined && assigneeId !== issue.assigneeId) {
      changes.push({ action: 'assignee_changed', oldValue: issue.assigneeId || 'None', newValue: assigneeId || 'None' })
    }

    const updateData: any = {
      updatedBy: userId,
    }

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (priority !== undefined) updateData.priority = priority
    if (status !== undefined) {
      updateData.status = status
      if (status === 'closed' && !issue.closedAt) {
        updateData.closedAt = new Date()
        updateData.closedBy = userId
      } else if (status !== 'closed' && issue.closedAt) {
        updateData.closedAt = null
        updateData.closedBy = null
      }
    }
    if (owner !== undefined) updateData.owner = owner
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId || null
    if (relatedFunctionIds !== undefined) updateData.relatedFunctionIds = relatedFunctionIds
    if (relatedParameterIds !== undefined) updateData.relatedParameterIds = relatedParameterIds
    if (labelIds !== undefined) updateData.labelIds = labelIds
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
    if (estimatedTime !== undefined) updateData.estimatedTime = estimatedTime
    if (actualTime !== undefined) updateData.actualTime = actualTime

    const updatedIssue = await prisma.issue.update({
      where: { id },
      data: updateData,
    })

    // Create system notes for changes
    for (const change of changes) {
      await createSystemNote(
        id,
        issue.projectId,
        change.action,
        change.oldValue,
        change.newValue,
        userId,
        userName
      )
    }

    res.json({
      success: true,
      data: updatedIssue,
    })
  } catch (error) {
    console.error('Update issue error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const deleteIssue = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const issue = await prisma.issue.findUnique({
      where: { id },
    })

    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found',
      })
    }

    await prisma.issue.delete({
      where: { id },
    })

    res.json({
      success: true,
      message: 'Issue deleted successfully',
    })
  } catch (error) {
    console.error('Delete issue error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const createIssueComment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { content, parentCommentId } = req.body

    const issue = await prisma.issue.findUnique({ where: { id } })
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' })
    }

    const comment = await prisma.issueComment.create({
      data: {
        issueId: id,
        projectId: issue.projectId,
        content,
        authorId: req.user?.userId || '',
        authorName: req.user?.name || 'Unknown',
        parentCommentId,
      },
    })

    res.status(201).json({ success: true, data: comment })
  } catch (error) {
    console.error('Create comment error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const updateIssueComment = async (req: AuthRequest, res: Response) => {
  try {
    const { commentId } = req.params
    const { content } = req.body

    const comment = await prisma.issueComment.findUnique({ where: { id: commentId } })
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' })
    }

    // Check if user is author
    if (comment.authorId !== req.user?.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' })
    }

    const updated = await prisma.issueComment.update({
      where: { id: commentId },
      data: { content },
    })

    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update comment error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const deleteIssueComment = async (req: AuthRequest, res: Response) => {
  try {
    const { commentId } = req.params

    const comment = await prisma.issueComment.findUnique({ where: { id: commentId } })
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' })
    }

    // Check if user is author
    if (comment.authorId !== req.user?.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' })
    }

    await prisma.issueComment.delete({ where: { id: commentId } })

    res.json({ success: true, message: 'Comment deleted' })
  } catch (error) {
    console.error('Delete comment error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const subscribeToIssue = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const issue = await prisma.issue.findUnique({ where: { id } })
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' })
    }

    await prisma.issueSubscription.create({
      data: {
        issueId: id,
        userId: req.user?.userId || '',
      },
    })

    res.json({ success: true, message: 'Subscribed successfully' })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.json({ success: true, message: 'Already subscribed' })
    }
    console.error('Subscribe error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const unsubscribeFromIssue = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await prisma.issueSubscription.deleteMany({
      where: {
        issueId: id,
        userId: req.user?.userId || '',
      },
    })

    res.json({ success: true, message: 'Unsubscribed successfully' })
  } catch (error) {
    console.error('Unsubscribe error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const createIssueLink = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { linkedType, linkedId, linkType, linkedRequirementKey, linkedRequirementTitle } = req.body

    const issue = await prisma.issue.findUnique({ where: { id } })
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' })
    }

    const link = await prisma.issueLink.create({
      data: {
        issueId: id,
        linkedType,
        linkedId,
        linkType: linkType || 'relates_to',
        linkedRequirementKey,
        linkedRequirementTitle,
        createdBy: req.user?.userId,
      },
    })

    // Create system note
    await createSystemNote(
      id,
      issue.projectId,
      'link_added',
      null,
      `${linkedType}:${linkedId}`,
      req.user?.userId,
      req.user?.name
    )

    // Log linkage for Requirement version history if linked to a requirement
    if (linkedType === 'requirement') {
      await linkageAuditService.log({
        projectId: issue.projectId,
        entityType: 'REQUIREMENT',
        entityId: linkedId,
        action: 'ISSUE_LINKED',
        newValue: {
          issueId: id,
          issueKey: issue.issueKey,
          title: issue.title
        },
        performedByUserId: req.user?.userId,
      })
    }

    res.status(201).json({ success: true, data: link })
  } catch (error) {
    console.error('Create link error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const deleteIssueLink = async (req: AuthRequest, res: Response) => {
  try {
    const { linkId } = req.params

    const link = await prisma.issueLink.findUnique({ where: { id: linkId } })
    if (!link) {
      return res.status(404).json({ success: false, error: 'Link not found' })
    }

    const issue = await prisma.issue.findUnique({ where: { id: link.issueId } })

    await prisma.issueLink.delete({ where: { id: linkId } })

    // Create system note
    if (issue) {
      await createSystemNote(
        link.issueId,
        issue.projectId,
        'link_removed',
        `${link.linkedType}:${link.linkedId}`,
        null,
        req.user?.userId,
        req.user?.name
      )
    }

    if (
      issue &&
      link.linkedType &&
      String(link.linkedType).toLowerCase().replace(/-/g, '_') === 'requirement'
    ) {
      await linkageAuditService.log({
        projectId: issue.projectId,
        entityType: 'REQUIREMENT',
        entityId: link.linkedId,
        action: 'ISSUE_UNLINKED',
        oldValue: {
          issueId: link.issueId,
          issueKey: issue.issueKey,
          title: issue.title,
        },
        performedByUserId: req.user?.userId,
      })
    }

    res.json({ success: true, message: 'Link deleted' })
  } catch (error) {
    console.error('Delete link error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const getProjectLabels = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    const labels = await prisma.issueLabel.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    })

    res.json({ success: true, data: labels })
  } catch (error) {
    console.error('Get labels error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const createProjectLabel = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { name, color } = req.body

    const label = await prisma.issueLabel.create({
      data: {
        projectId,
        name,
        color: color || '#3b82f6',
      },
    })

    res.status(201).json({ success: true, data: label })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'Label already exists' })
    }
    console.error('Create label error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const uploadIssueAttachment = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id: issueId } = req.params
    const { fileName, fileData, mimeType } = req.body

    if (!fileName || !fileData) {
      return res.status(400).json({ success: false, error: 'fileName and fileData are required' })
    }

    const issue = await prisma.issue.findFirst({
      where: { id: issueId, projectId },
    })
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' })
    }

    let fileUrl: string
    let fileSize: number

    if (fileData.startsWith('data:')) {
      const base64Data = fileData.split(',')[1]
      const buffer = Buffer.from(base64Data, 'base64')
      fileSize = buffer.length
      if (fileSize > 1024 * 1024) {
        const fileExtension = path.extname(fileName)
        const uniqueFileName = `${issueId}-${Date.now()}${fileExtension}`
        const filePath = path.join(issueUploadsDir, uniqueFileName)
        fs.writeFileSync(filePath, buffer)
        fileUrl = `/uploads/issues/${uniqueFileName}`
      } else {
        fileUrl = fileData
      }
    } else {
      const buffer = Buffer.from(fileData, 'base64')
      fileSize = buffer.length
      const fileExtension = path.extname(fileName)
      const uniqueFileName = `${issueId}-${Date.now()}${fileExtension}`
      const filePath = path.join(issueUploadsDir, uniqueFileName)
      fs.writeFileSync(filePath, buffer)
      fileUrl = `/uploads/issues/${uniqueFileName}`
    }

    const user = req.userId ? await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } }) : null
    const attachment = await prisma.issueAttachment.create({
      data: {
        issueId,
        projectId,
        fileName,
        fileUrl,
        fileSize,
        mimeType: mimeType || 'application/octet-stream',
        uploadedBy: req.userId || null,
        uploadedByName: user?.name || null,
      },
    })

    res.status(201).json({ success: true, data: attachment })
  } catch (error: any) {
    console.error('Upload issue attachment error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const getIssueAttachments = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id: issueId } = req.params
    const attachments = await prisma.issueAttachment.findMany({
      where: { issueId, projectId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: attachments })
  } catch (error: any) {
    console.error('Get issue attachments error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const deleteIssueAttachment = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id: issueId, attachmentId } = req.params
    const attachment = await prisma.issueAttachment.findFirst({
      where: { id: attachmentId, issueId, projectId },
    })
    if (!attachment) {
      return res.status(404).json({ success: false, error: 'Attachment not found' })
    }
    if (attachment.fileUrl.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '../..', attachment.fileUrl)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    }
    await prisma.issueAttachment.delete({ where: { id: attachmentId } })
    res.json({ success: true })
  } catch (error: any) {
    console.error('Delete issue attachment error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
