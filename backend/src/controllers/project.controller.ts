// --- Enterprise Features ---
/**
 * GET /projects/:id/audit-logs
 *
 * Returns the project's central AuditLog rows, newest-first.
 *
 * NX-8 (#463) extended this shared endpoint with two OPTIONAL query params:
 *   - `modules` — a comma-separated list of action-prefix tokens (e.g.
 *     `stakeholder,committee,raci`). A row matches if its `action` string
 *     starts with `<token>:` or `<token>.` for any requested token. The dot
 *     form keeps the legacy `stakeholder.role.assign` verbs visible alongside
 *     the new `committee:*` / `raci:*` colon-kebab verbs.
 *   - `page` / `pageSize` — 1-based pagination. When `page` is present the
 *     response carries a `pagination` object.
 *
 * Back-compat: with NEITHER `modules` NOR `page` the behaviour is
 * byte-identical to the original — every row, no pagination wrapper.
 */
export const getProjectAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { id: projectId } = req.params;

    const modulesRaw = typeof req.query.modules === 'string' ? req.query.modules : '';
    const modules = modulesRaw
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);

    const where: Prisma.AuditLogWhereInput = { projectId };
    if (modules.length > 0) {
      // A row matches if action begins with `<token>:` or `<token>.`.
      where.OR = modules.flatMap((m) => [
        { action: { startsWith: `${m}:` } },
        { action: { startsWith: `${m}.` } },
      ]);
    }

    const pageRaw = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : NaN;
    const paginated = !Number.isNaN(pageRaw) && pageRaw >= 1;

    if (!paginated) {
      // Original code path — unbounded, no wrapper. Preserved byte-for-byte
      // when no `modules` and no `page` are passed.
      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: SAFE_USER_SELECT } },
      });
      res.json({ success: true, data: logs });
      return;
    }

    const pageSizeRaw = typeof req.query.pageSize === 'string' ? parseInt(req.query.pageSize, 10) : NaN;
    const pageSize = !Number.isNaN(pageSizeRaw) && pageSizeRaw >= 1 ? Math.min(pageSizeRaw, 200) : 50;
    const page = pageRaw;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: SAFE_USER_SELECT } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs.' });
  }
};

export const getProjectAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const { id: projectId } = req.params;
    const analytics = await prisma.projectAnalytics.findUnique({ where: { projectId } });
    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch analytics.' });
  }
};

// Whitelist of fields accepted by bulkUpdateProjects.  Same mass-assignment
// risk as importProjects (#154): reject unknown top-level keys.
const BULK_UPDATE_ALLOWED_FIELDS = ['name', 'description', 'domain', 'companyName', 'status', 'progress'] as const

export const bulkUpdateProjects = async (req: AuthRequest, res: Response) => {
  try {
    const { ids, updates } = req.body;
    if (!Array.isArray(ids) || !updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({ success: false, error: 'Invalid payload.' });
    }

    const unknownKeys = Object.keys(updates).filter(
      (k) => !(BULK_UPDATE_ALLOWED_FIELDS as readonly string[]).includes(k)
    )
    if (unknownKeys.length > 0) {
      return res.status(400).json({
        success: false,
        error: `updates contains unknown field(s): ${unknownKeys.join(', ')}`,
      })
    }

    const safeUpdates: Record<string, unknown> = {}
    for (const key of BULK_UPDATE_ALLOWED_FIELDS) {
      if (key in updates) safeUpdates[key] = (updates as Record<string, unknown>)[key]
    }

    const result = await prisma.project.updateMany({ where: { id: { in: ids } }, data: safeUpdates });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Bulk update failed.' });
  }
};

export const exportProjects = async (req: AuthRequest, res: Response) => {
  try {
    const projects = await prisma.project.findMany();
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Export failed.' });
  }
};

// Whitelist of fields accepted from the importProjects payload.  Extending
// this list is a security-relevant change; review #154 before adding fields.
const IMPORT_PROJECT_ALLOWED_FIELDS = ['name', 'description', 'domain', 'companyName'] as const

export const importProjects = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { projects } = req.body
    if (!Array.isArray(projects)) {
      return res.status(400).json({ success: false, error: 'Invalid payload.' })
    }
    if (projects.length === 0) {
      return res.status(400).json({ success: false, error: 'No projects provided.' })
    }

    const cleaned: Array<{
      name: string
      description: string | null
      domain: string
      companyName: string | null
      slug: string
      userId: string
    }> = []

    for (let i = 0; i < projects.length; i++) {
      const p = projects[i]
      if (!p || typeof p !== 'object' || Array.isArray(p)) {
        return res.status(400).json({
          success: false,
          error: `projects[${i}] must be an object`,
        })
      }
      if (typeof (p as { name?: unknown }).name !== 'string' || !(p as { name: string }).name.trim()) {
        return res.status(400).json({
          success: false,
          error: `projects[${i}].name is required`,
        })
      }

      // Reject unknown top-level fields so mass-assignment attempts (e.g.
      // createdAt, updatedAt, userId, isTemplate) are surfaced to the caller
      // instead of silently dropped.
      const unknownKeys = Object.keys(p as Record<string, unknown>).filter(
        (k) => !(IMPORT_PROJECT_ALLOWED_FIELDS as readonly string[]).includes(k)
      )
      if (unknownKeys.length > 0) {
        return res.status(400).json({
          success: false,
          error: `projects[${i}] contains unknown field(s): ${unknownKeys.join(', ')}`,
        })
      }

      const typed = p as {
        name: string
        description?: string
        domain?: string
        companyName?: string
      }
      const domain = typed.domain ?? typed.name
      const baseSlug = slugFromName(domain)
      const slug = await ensureUniqueSlug(baseSlug)

      cleaned.push({
        name: typed.name,
        description: typed.description ?? null,
        domain,
        companyName: typed.companyName ?? null,
        slug,
        userId,
      })
    }

    const created = await prisma.project.createMany({ data: cleaned, skipDuplicates: true })
    res.json({ success: true, data: created })
  } catch (error) {
    console.error('Import projects error:', error)
    res.status(500).json({ success: false, error: 'Import failed.' })
  }
};
import { Response } from 'express'
import type { Prisma } from '@prisma/client'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import { SAFE_USER_SELECT } from '../lib/safeUserSelect'


function slugFromName(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '') || 'project'
  )
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug
  let n = 1
  while (await prisma.project.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++n}`
  }
  return slug
}

export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    const { name, description, domain, companyName, deadline } = req.body

    if (!name || !domain) {
      return res.status(400).json({
        success: false,
        error: 'Name and domain are required',
      })
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'You must be logged in to create a project.',
      })
    }

    const baseSlug = slugFromName(domain)
    const slug = await ensureUniqueSlug(baseSlug)

    const project = await prisma.project.create({
      data: {
        name,
        description,
        domain,
        slug,
        companyName,
        deadline: deadline ? new Date(deadline) : null,
        userId,
      },
    })

    // Add creator as project owner in ProjectMember
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId,
        role: 'owner',
      },
    })

    res.status(201).json({
      success: true,
      data: project,
    })
  } catch (error) {
    console.error('Create project error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.userId
    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      })
    }

    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { userId: currentUserId },
          {
            teamMembers: {
              some: {
                userId: currentUserId,
                status: 'accepted',
              },
            },
          },
        ],
      },
      include: {
        teamMembers: {
          where: { status: { in: ['accepted', 'pending'] } },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    res.json({
      success: true,
      data: projects,
    })
  } catch (error) {
    const err = error as Error
    console.error('Get projects error:', err)
    const message = err.message?.includes('reach database server') || err.message?.includes('localhost:5432')
      ? 'Database unavailable. Start PostgreSQL (e.g. docker-compose up -d).'
      : (process.env.NODE_ENV === 'development' ? err.message : 'Internal server error')
    res.status(500).json({
      success: false,
      error: message,
    })
  }
}

export const getProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const currentUserId = req.userId

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      })
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        teamMembers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        requirements: true,
        functions: true,
        architectures: true,
        verifications: true,
      },
    })

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }

    const canAccess =
      project.userId === currentUserId ||
      project.teamMembers.some(
        (m) => m.userId === currentUserId && (m as { status?: string }).status === 'accepted'
      )
    if (!canAccess) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }

    res.json({
      success: true,
      data: project,
    })
  } catch (error) {
    console.error('Get project error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, description, domain, companyName, progress, status, deadline, strictLifecycleGates, aiEnabled, aiSelfHostedUrl } = req.body

    // Ownership/admin enforcement is handled by requireProjectOwnerOrAdmin
    // middleware on the route (#152).  This findUnique is kept to return the
    // 404 with the standard error shape when the row vanished between auth
    // and update (race condition / concurrent delete).
    const project = await prisma.project.findUnique({
      where: { id },
    })

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        name,
        description,
        domain,
        companyName,
        progress,
        status,
        deadline: deadline ? new Date(deadline) : undefined,
        ...(strictLifecycleGates !== undefined ? { strictLifecycleGates: Boolean(strictLifecycleGates) } : {}),
        // AI per-project toggle (ai-ready-vision.md §5). Tracks who
        // flipped it + when, for audit.
        ...(aiEnabled !== undefined
          ? {
              aiEnabled: Boolean(aiEnabled),
              aiEnabledAt: Boolean(aiEnabled) ? new Date() : null,
              aiEnabledBy: Boolean(aiEnabled) ? req.user?.userId ?? null : null,
            }
          : {}),
        // Per-project self-hosted AI endpoint (air-gap / ITAR). Empty
        // string clears it; undefined leaves the existing value alone.
        ...(aiSelfHostedUrl !== undefined
          ? { aiSelfHostedUrl: aiSelfHostedUrl ? String(aiSelfHostedUrl).trim() : null }
          : {}),
      },
      include: {
        teamMembers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    })

    res.json({
      success: true,
      data: updatedProject,
    })
  } catch (error) {
    console.error('Update project error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // Ownership/admin enforcement is handled by requireProjectOwnerOrAdmin
    // middleware on the route (#152).
    const project = await prisma.project.findUnique({
      where: { id },
    })

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }

    await prisma.project.delete({
      where: { id },
    })

    res.json({
      success: true,
      message: 'Project deleted successfully',
    })
  } catch (error) {
    console.error('Delete project error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/** Ensure the current user is the project owner (ProjectMember role or legacy project.userId) */
async function requireProjectOwner(projectId: string, userId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  })
  if (project?.userId === userId) return true
  const member = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
  })
  return member?.role === 'owner'
}

/** Derive admin flag: ADMIN_EMAILS env or first user in DB (by createdAt). */
async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  if (!user?.email) return false
  const list = process.env.ADMIN_EMAILS
  if (list) {
    const emails = list.split(',').map((e) => e.trim().toLowerCase())
    return emails.includes(user.email.toLowerCase())
  }
  const first = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { email: true },
  })
  return first?.email?.toLowerCase() === user.email.toLowerCase()
}

export const getProjectMembers = async (req: AuthRequest, res: Response) => {
  try {
    const { id: projectId } = req.params

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        teamMembers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    })

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }

    // Include project owner in list if not already in teamMembers (backfill for legacy projects)
    let members = project.teamMembers
    const ownerInMembers = members.some((m) => m.userId === project.userId)
    if (!ownerInMembers && project.userId) {
      const ownerUser = await prisma.user.findUnique({
        where: { id: project.userId },
        select: { id: true, name: true, email: true, avatarUrl: true },
      })
      if (ownerUser) {
        members = [
          {
            id: `owner-${project.userId}`,
            projectId,
            userId: project.userId,
            role: 'owner',
            status: 'accepted',
            joinedAt: project.createdAt,
            user: ownerUser,
          },
          ...members,
        ]
      }
    }

    res.json({
      success: true,
      data: members,
    })
  } catch (error) {
    console.error('Get project members error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const addProjectMember = async (req: AuthRequest, res: Response) => {
  try {
    const { id: projectId } = req.params
    const { userId: inviteUserId, role } = req.body
    const currentUserId = req.userId

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      })
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }

    const isOwner = await requireProjectOwner(projectId, currentUserId)
    const isAdminUser = await isAdmin(currentUserId)
    if (!isOwner && !isAdminUser) {
      return res.status(403).json({
        success: false,
        error: 'Only the project owner can invite members',
      })
    }

    if (!inviteUserId || !role) {
      return res.status(400).json({
        success: false,
        error: 'userId and role (member or viewer) are required',
      })
    }

    if (role !== 'member' && role !== 'viewer') {
      return res.status(400).json({
        success: false,
        error: 'role must be "member" or "viewer"',
      })
    }

    const existing = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: inviteUserId },
      },
    })
    if (existing) {
      if (existing.status === 'pending') {
        await prisma.projectMember.update({
          where: {
            projectId_userId: { projectId, userId: inviteUserId },
          },
          data: { status: 'accepted' },
        })
        const updated = await prisma.projectMember.findUnique({
          where: {
            projectId_userId: { projectId, userId: inviteUserId },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        })
        return res.status(200).json({
          success: true,
          data: updated,
        })
      }
      return res.status(400).json({
        success: false,
        error: 'User is already a member of this project',
      })
    }

    const userExists = await prisma.user.findUnique({
      where: { id: inviteUserId },
    })
    if (!userExists) {
      return res.status(400).json({
        success: false,
        error: 'User not found',
      })
    }

    const inviter = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { name: true },
    })

    const [member] = await prisma.$transaction([
      prisma.projectMember.create({
        data: {
          projectId,
          userId: inviteUserId,
          role,
          status: 'accepted',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.notification.create({
        data: {
          userId: inviteUserId,
          type: 'project_invitation',
          title: 'Project invitation',
          message: `${inviter?.name || 'Someone'} invited you to the project "${project.name}".`,
          projectId,
        },
      }),
    ])

    res.status(201).json({
      success: true,
      data: member,
    })
  } catch (error) {
    console.error('Add project member error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const removeProjectMember = async (req: AuthRequest, res: Response) => {
  try {
    const { id: projectId, userId: targetUserId } = req.params
    const currentUserId = req.userId

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      })
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }

    const isOwner = await requireProjectOwner(projectId, currentUserId)
    const isAdminUser = await isAdmin(currentUserId)
    if (!isOwner && !isAdminUser) {
      return res.status(403).json({
        success: false,
        error: 'Only the project owner can remove members',
      })
    }

    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: targetUserId },
      },
    })

    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found in this project',
      })
    }

    if (member.role === 'owner') {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove the project owner',
      })
    }

    await prisma.projectMember.delete({
      where: {
        projectId_userId: { projectId, userId: targetUserId },
      },
    })

    res.json({
      success: true,
      message: 'Member removed',
    })
  } catch (error) {
    console.error('Remove project member error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const acceptProjectInvitation = async (req: AuthRequest, res: Response) => {
  try {
    const { id: projectId } = req.params
    const currentUserId = req.userId

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      })
    }

    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: currentUserId },
      },
    })

    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found',
      })
    }

    if (member.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Invitation was already accepted or declined',
      })
    }

    await prisma.$transaction([
      prisma.projectMember.update({
        where: {
          projectId_userId: { projectId, userId: currentUserId },
        },
        data: { status: 'accepted' },
      }),
      prisma.notification.updateMany({
        where: {
          userId: currentUserId,
          projectId,
          type: 'project_invitation',
        },
        data: { read: true },
      }),
    ])

    res.json({
      success: true,
      message: 'Invitation accepted',
    })
  } catch (error) {
    console.error('Accept project invitation error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const declineProjectInvitation = async (req: AuthRequest, res: Response) => {
  try {
    const { id: projectId } = req.params
    const currentUserId = req.userId

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      })
    }

    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: currentUserId },
      },
    })

    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found',
      })
    }

    if (member.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Invitation was already accepted or declined',
      })
    }

    await prisma.$transaction([
      prisma.projectMember.delete({
        where: {
          projectId_userId: { projectId, userId: currentUserId },
        },
      }),
      prisma.notification.updateMany({
        where: {
          userId: currentUserId,
          projectId,
          type: 'project_invitation',
        },
        data: { read: true },
      }),
    ])

    res.json({
      success: true,
      message: 'Invitation declined',
    })
  } catch (error) {
    console.error('Decline project invitation error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * PATCH /projects/:id/strict-mode — toggle the regulated-mode flag (ROADMAP
 * R-6). The dedicated, audited write path for Project.strictMode; the flag is
 * deliberately NOT settable via the general PUT /:id so there is exactly one
 * controlled write path.
 *
 * Authorisation is enforced by the route middleware chain
 * (resolveProjectParam -> requireProjectOwnerOrAdmin); req.params.id is a
 * canonical UUID by the time this handler runs.
 */
export const setProjectStrictMode = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { strictMode } = req.body as { strictMode?: unknown }

    if (typeof strictMode !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'strictMode (boolean) is required',
      })
    }

    // Kept to return the standard 404 shape when the row vanished between
    // auth and update (race / concurrent delete) — matches updateProject.
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, strictMode: true },
    })

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { strictMode },
      select: { id: true, strictMode: true },
    })

    // Audit the toggle. A no-op (setting strictMode to its current value)
    // still records a row — the act of re-confirming the posture is itself
    // auditable; details.previous captures whether it changed. The write is
    // wrapped so an audit failure never fails the toggle.
    try {
      await prisma.auditLog.create({
        data: {
          projectId: id,
          userId: req.userId ?? req.user?.userId ?? '',
          action: 'project:strict-mode-set',
          detailsJson: {
            strictMode: updated.strictMode,
            previous: project.strictMode,
          },
        },
      })
    } catch (auditError) {
      console.error('AuditLog write failed (project:strict-mode-set):', auditError)
    }

    res.json({
      success: true,
      data: { id: updated.id, strictMode: updated.strictMode },
    })
  } catch (error) {
    console.error('Set project strict mode error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
