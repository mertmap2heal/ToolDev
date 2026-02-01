import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

    const project = await prisma.project.create({
      data: {
        name,
        description,
        domain,
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
    const projects = await prisma.project.findMany({
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
      orderBy: {
        updatedAt: 'desc',
      },
    })

    res.json({
      success: true,
      data: projects,
    })
  } catch (error) {
    console.error('Get projects error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const getProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // Admin view: Show any project by ID
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
    const { name, description, domain, companyName, progress, status, deadline } = req.body

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
    if (!isOwner) {
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

    const member = await prisma.projectMember.create({
      data: {
        projectId,
        userId: inviteUserId,
        role,
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
    if (!isOwner) {
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
