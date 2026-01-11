import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { name, description, domain, companyName, deadline } = req.body

    if (!name || !domain) {
      return res.status(400).json({
        success: false,
        error: 'Name and domain are required',
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
    const userId = req.userId!

    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { userId },
          {
            teamMembers: {
              some: {
                userId,
              },
            },
          },
        ],
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
    const userId = req.userId!
    const { id } = req.params

    const project = await prisma.project.findFirst({
      where: {
        id,
        OR: [
          { userId },
          {
            teamMembers: {
              some: {
                userId,
              },
            },
          },
        ],
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
    const userId = req.userId!
    const { id } = req.params
    const { name, description, domain, companyName, progress, status, deadline } = req.body

    const project = await prisma.project.findFirst({
      where: {
        id,
        userId,
      },
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
    const userId = req.userId!
    const { id } = req.params

    const project = await prisma.project.findFirst({
      where: {
        id,
        userId,
      },
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
