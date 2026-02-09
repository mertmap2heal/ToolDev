import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticateToken, requireSuperiorAdmin, type AuthRequest } from '../middleware/auth.middleware'

const router = Router()
const prisma = new PrismaClient()

/** All routes require auth + SUPERIOR_ADMIN */
router.use(authenticateToken)
router.use((req, res, next) => {
  requireSuperiorAdmin(req as AuthRequest, res, next).catch(next)
})

/** GET /platform-admin/companies - distinct company names from projects */
router.get('/companies', async (_req: AuthRequest, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: { companyName: { not: null } },
      select: { companyName: true },
      distinct: ['companyName'],
    })
    const companies = projects
      .map((p) => p.companyName)
      .filter((n): n is string => n != null && n !== '')
      .sort((a, b) => a.localeCompare(b))
    res.json({ success: true, data: companies })
  } catch (error) {
    console.error('Platform admin companies error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/** GET /platform-admin/audit-logs - placeholder for global audit logs */
router.get('/audit-logs', async (_req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: [] })
  } catch (error) {
    console.error('Platform admin audit logs error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
