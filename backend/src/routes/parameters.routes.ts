import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import {
  getParameters,
  getParameter,
  createParameter,
  updateParameter,
  deleteParameter,
  resolveParameter,
  resolveAllParameters,
  bulkUpdateParameters,
  getParameterImpact,
  getParameterVersions,
  exportParametersHandler,
  importParametersHandler,
  gitPublishSetupHandler,
  gitPublishSyncHandler,
  gitPublishStatusHandler,
  gitValidateTokenHandler,
} from '../controllers/parameter.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

router.get('/:projectId/resolve', resolveAllParameters)
router.get('/:projectId/resolve/:id', resolveParameter)
router.get('/:projectId/impact/:id', getParameterImpact)
router.get('/:projectId/versions/:id', getParameterVersions)
router.get('/:projectId/export/:format', exportParametersHandler)
router.get('/:projectId/git/status', gitPublishStatusHandler)
router.post('/:projectId/git/validate-token', gitValidateTokenHandler)
router.post('/:projectId/import', importParametersHandler)
router.post('/:projectId/git/setup', gitPublishSetupHandler)
router.post('/:projectId/git/sync', gitPublishSyncHandler)
router.get('/:projectId', getParameters)
router.get('/:projectId/:id', getParameter)
router.post('/:projectId', createParameter)
router.put('/:projectId/:id', updateParameter)
router.patch('/:projectId/bulk', bulkUpdateParameters)
router.delete('/:projectId/:id', deleteParameter)

export default router
