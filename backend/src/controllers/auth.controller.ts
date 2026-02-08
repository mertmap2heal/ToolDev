import { Request, Response } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import type { AuthRequest } from '../middleware/auth.middleware'
import { sendInviteEmail, sendForgotPasswordEmail } from '../services/email.service'

const prisma = new PrismaClient()

async function requireAdmin(req: AuthRequest, res: Response): Promise<{ email: string } | null> {
  const currentUserId = req.userId
  if (!currentUserId) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return null
  }
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { email: true },
  })
  if (!currentUser) {
    res.status(401).json({ success: false, error: 'User not found' })
    return null
  }
  const isAdmin = await resolveIsAdmin(currentUser.email)
  if (!isAdmin) {
    res.status(403).json({ success: false, error: 'Admin access required' })
    return null
  }
  return currentUser
}

function randomTempPassword(length = 14): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.randomBytes(length)
  let s = ''
  for (let i = 0; i < length; i++) s += chars[bytes[i]! % chars.length]
  return s
}

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, company } = req.body

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and name are required',
      })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists',
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        company,
      },
      select: {
        id: true,
        email: true,
        name: true,
        company: true,
        avatarUrl: true,
        createdAt: true,
      },
    })

    const token = generateToken(user.id)
    const isAdmin = await resolveIsAdmin(user.email)

    res.status(201).json({
      success: true,
      data: {
        user: { ...user, isAdmin },
        token,
      },
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      })
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      })
    }

    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const token = generateToken(user.id)
    const isAdmin = await resolveIsAdmin(user.email)

    const mustChange = (user as { mustChangePasswordOnFirstLogin?: boolean }).mustChangePasswordOnFirstLogin ?? false
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          company: user.company,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
          isAdmin,
          mustChangePassword: mustChange,
        },
        token,
      },
    })
  } catch (error) {
    const err = error as Error
    console.error('Login error:', err)
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    })
  }
}

const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for this login, you will receive an email with a temporary password.'

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : ''
    if (!email) {
      return res.status(200).json({ success: true, message: FORGOT_PASSWORD_MESSAGE })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, inviteEmail: true },
    })

    if (!user) {
      return res.status(200).json({ success: true, message: FORGOT_PASSWORD_MESSAGE })
    }

    const recipient = user.inviteEmail ?? user.email
    if (!recipient || !recipient.includes('@')) {
      return res.status(200).json({ success: true, message: FORGOT_PASSWORD_MESSAGE })
    }

    const tempPassword = randomTempPassword(14)
    const hashedPassword = await bcrypt.hash(tempPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, mustChangePasswordOnFirstLogin: true },
    })

    try {
      await sendForgotPasswordEmail({
        to: recipient,
        userName: user.email,
        tempPassword,
      })
    } catch (sendError) {
      console.error('Forgot password email error:', sendError)
    }

    return res.status(200).json({ success: true, message: FORGOT_PASSWORD_MESSAGE })
  } catch (error) {
    console.error('Forgot password error:', error)
    return res.status(200).json({ success: true, message: FORGOT_PASSWORD_MESSAGE })
  }
}

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        company: true,
        avatarUrl: true,
        createdAt: true,
        mustChangePasswordOnFirstLogin: true,
      },
    })

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const isAdmin = await resolveIsAdmin(user.email)
    const mustChange = user.mustChangePasswordOnFirstLogin ?? false
    const { mustChangePasswordOnFirstLogin: _omit, ...rest } = user
    res.json({
      success: true,
      data: { ...rest, isAdmin, mustChangePassword: mustChange },
    })
  } catch (error) {
    const err = error as Error
    console.error('Get current user error:', err)
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    })
  }
}

/** Authenticated user: change own password (e.g. after first login with temp password). */
export const changeMyPassword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { newPassword } = req.body
    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'newPassword is required',
      })
    }
    const trimmed = newPassword.trim()
    if (trimmed.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      })
    }

    const hashedPassword = await bcrypt.hash(trimmed, 10)
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, mustChangePasswordOnFirstLogin: false },
    })

    res.json({ success: true, message: 'Password updated' })
  } catch (error) {
    const err = error as Error
    console.error('Change my password error:', err)
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    })
  }
}

/** Admin only: set a new password for a user. */
export const resetUserPassword = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.userId
    if (!currentUserId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { email: true },
    })
    if (!currentUser) {
      return res.status(401).json({ success: false, error: 'User not found' })
    }

    const isAdmin = await resolveIsAdmin(currentUser.email)
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Admin access required' })
    }

    const { userId } = req.params
    const { newPassword } = req.body

    if (!userId || !newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'userId and newPassword are required',
      })
    }

    const trimmed = newPassword.trim()
    if (trimmed.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    })
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    const hashedPassword = await bcrypt.hash(trimmed, 10)
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    res.json({ success: true, message: 'Password updated' })
  } catch (error) {
    console.error('Reset password error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/** List users (id, name, email, inviteEmail, lastLoginAt) for invite dropdowns and admin. Requires authentication. */
export const getUsers = async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        inviteEmail: true,
        lastLoginAt: true,
      },
      orderBy: { name: 'asc' },
    })

    const data = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      inviteEmail: u.inviteEmail ?? null,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    }))

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/** Admin only: update a user's invite email. */
export const updateUserInviteEmail = async (req: AuthRequest, res: Response) => {
  try {
    const admin = await requireAdmin(req, res)
    if (!admin) return

    const { userId } = req.params
    const { inviteEmail } = req.body

    if (!userId) {
      res.status(400).json({ success: false, error: 'userId is required' })
      return
    }

    const value = inviteEmail === undefined ? undefined : (inviteEmail === null || inviteEmail === '' ? null : String(inviteEmail).trim() || null)
    if (value !== undefined && value !== null && !value.includes('@')) {
      res.status(400).json({ success: false, error: 'Invalid email format' })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' })
      return
    }

    await prisma.user.update({
      where: { id: userId },
      data: value === undefined ? {} : { inviteEmail: value },
    })

    res.json({ success: true, message: 'Invite email updated' })
  } catch (error: unknown) {
    const err = error as { code?: string; meta?: { target?: string[] }; message?: string }
    console.error('Update invite email error:', error)
    if (err.code === 'P2002' && err.meta?.target?.includes('inviteEmail')) {
      res.status(400).json({ success: false, error: 'This invite email is already used by another user.' })
      return
    }
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'development' ? (err.message ?? 'Internal server error') : 'Internal server error',
    })
  }
}

/** Admin only: send invite email with app URL and temporary password. */
export const sendUserInvite = async (req: AuthRequest, res: Response) => {
  try {
    const admin = await requireAdmin(req, res)
    if (!admin) return

    const { userId } = req.params
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId is required' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, inviteEmail: true, name: true },
    })
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' })
      return
    }

    const recipient = user.inviteEmail ?? user.email
    if (!recipient || !recipient.includes('@')) {
      res.status(400).json({
        success: false,
        error: 'User has no email set. Add an invite email first.',
      })
      return
    }

    const tempPassword = randomTempPassword(14)
    const hashedPassword = await bcrypt.hash(tempPassword, 10)
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, mustChangePasswordOnFirstLogin: true },
    })

    try {
      await sendInviteEmail({
        to: recipient,
        userName: user.email,
        tempPassword,
      })
    } catch (sendError: unknown) {
      const errMessage = sendError instanceof Error ? sendError.message : String(sendError)
      console.error('Send invite email error:', sendError)
      const isDev = process.env.NODE_ENV !== 'production'
      res.status(503).json({
        success: false,
        error: isDev
          ? `Failed to send invite email: ${errMessage}`
          : 'Failed to send invite email. Check SMTP configuration (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).',
      })
      return
    }

    res.json({ success: true, message: `Invite sent to ${recipient}` })
  } catch (error) {
    console.error('Send invite error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

/** Derive admin flag: comma-separated ADMIN_EMAILS env, or first user in DB (by createdAt). */
async function resolveIsAdmin(email: string | null): Promise<boolean> {
  if (!email) return false
  const list = process.env.ADMIN_EMAILS
  if (list) {
    const emails = list.split(',').map((e) => e.trim().toLowerCase())
    return emails.includes(email.toLowerCase())
  }
  const first = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { email: true },
  })
  return first?.email?.toLowerCase() === email.toLowerCase()
}

function generateToken(userId: string): string {
  const secret = process.env.JWT_SECRET
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'

  if (!secret) {
    throw new Error('JWT_SECRET is not defined')
  }

  return jwt.sign({ userId }, secret, { expiresIn })
}
