import { Router } from 'express'
import authRoutes from './auth.routes'
import projectRoutes from './projects.routes'
import workflowRoutes from './workflow.routes'
import requirementsRoutes from './requirements.routes'
import functionsRoutes from './functions.routes'
import architectureRoutes from './architecture.routes'
import verificationRoutes from './verification.routes'
import traceabilityRoutes from './traceability.routes'
import aiRoutes from './ai.routes'
import documentationRoutes from './documentation.routes'
import issuesRoutes from './issues.routes'
import parametersRoutes from './parameters.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/projects', projectRoutes)
router.use('/workflow', workflowRoutes)
router.use('/requirements', requirementsRoutes)
router.use('/functions', functionsRoutes)
router.use('/architecture', architectureRoutes)
router.use('/verification', verificationRoutes)
router.use('/traceability', traceabilityRoutes)
router.use('/ai', aiRoutes)
router.use('/documentation', documentationRoutes)
router.use('/issues', issuesRoutes)
router.use('/parameters', parametersRoutes)

export default router
