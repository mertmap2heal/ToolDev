// --- Enterprise Features ---
export const getProjectAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { id: projectId } = req.params;
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    // Verify the requesting user is a member (or owner) of the project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { userId },
          { teamMembers: { some: { userId, status: 'accepted' } } },
        ],
      },
      select: { id: true },
    });
    if (!project) return res.status(403).json({ success: false, error: 'Forbidden' });

    const logs = await prisma.auditLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
    res.json({ success: true, data: logs });
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

export const bulkUpdateProjects = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { ids, updates } = req.body;
    if (!Array.isArray(ids) || !updates) return res.status(400).json({ success: false, error: 'Invalid payload.' });
    // Verify the requesting user is owner or accepted member of every project ID
    const accessible = await prisma.project.findMany({
      where: {
        id: { in: ids },
        OR: [
          { userId },
          { teamMembers: { some: { userId, status: 'accepted' } } },
        ],
      },
      select: { id: true },
    });
    if (accessible.length !== ids.length) {
      return res.status(403).json({ success: false, error: 'Access denied to one or more projects.' });
    }
    const result = await prisma.project.updateMany({ where: { id: { in: ids } }, data: updates });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Bulk update failed.' });
  }
};

export const exportProjects = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { userId },
          { teamMembers: { some: { userId, status: 'accepted' } } },
        ],
      },
    });
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Export failed.' });
  }
};

export const importProjects = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })

    const { projects } = req.body
    if (!Array.isArray(projects)) return res.status(400).json({ success: false, error: 'Invalid payload.' })

    // Stamp the authenticated user's ID on every imported project so records
    // are always owned by the caller and cannot be assigned to arbitrary users.
    const projectsWithOwner = (projects as Record<string, unknown>[]).map(p => ({
      ...p,
      userId,
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await prisma.project.createMany({ data: projectsWithOwner as any })
    res.json({ success: true, data: created })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Import failed.' })
  }
}
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'


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
    const { name, description, domain, companyName, progress, status, deadline, strictLifecycleGates } = req.body

    // Admin view: Allow updating any project
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

    // Admin view: Allow deleting any project
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
