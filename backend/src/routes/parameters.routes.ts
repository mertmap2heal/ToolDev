import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'
import {
  getParameterTypes,
  createParameterTypeHandler,
  updateParameterTypeHandler,
  deleteParameterTypeHandler,
  getParameterTypeUsage,
} from '../controllers/parameterType.controller'
import {
  getProjectUnits,
  createProjectUnitHandler,
  updateProjectUnitHandler,
  deleteProjectUnitHandler,
  getProjectUnitUsage,
} from '../controllers/projectUnit.controller'
import {
  getParameters,
  getParameterFacets,
  getParameter,
  createParameter,
  updateParameter,
  deleteParameter,
  resolveParameter,
  resolveAllParameters,
  bulkUpdateParameters,
  bulkDeleteParameters,
  getParameterImpact,
  getParameterVersions,
  exportParametersHandler,
  importParametersHandler,
  gitPublishSetupHandler,
  gitPublishSyncHandler,
  gitPublishStatusHandler,
  gitValidateTokenHandler,
  gitPullHandler,
  restoreParameterVersionHandler,
} from '../controllers/parameter.controller'
import {
  getFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  reorderFolders,
  moveParameterToFolder,
} from '../controllers/parameterFolder.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)
router.use('/:projectId', requireProjectMember)

// Parameter type registry
router.get('/:projectId/types', getParameterTypes)
router.post('/:projectId/types', createParameterTypeHandler)
router.patch('/:projectId/types/:id', updateParameterTypeHandler)
router.delete('/:projectId/types/:id', deleteParameterTypeHandler)
router.get('/:projectId/types/:id/usage', getParameterTypeUsage)

// Project unit registry
router.get('/:projectId/units', getProjectUnits)
router.post('/:projectId/units', createProjectUnitHandler)
router.patch('/:projectId/units/:id', updateProjectUnitHandler)
router.delete('/:projectId/units/:id', deleteProjectUnitHandler)
router.get('/:projectId/units/:symbol/usage', getProjectUnitUsage)

// Parameter folders
router.get('/:projectId/folders', getFolders)
router.post('/:projectId/folders', createFolder)
router.patch('/:projectId/folders/reorder', reorderFolders)
router.patch('/:projectId/folders/:folderId', updateFolder)
router.delete('/:projectId/folders/:folderId', deleteFolder)

router.get('/:projectId/resolve', resolveAllParameters)
router.get('/:projectId/resolve/:id', resolveParameter)
router.get('/:projectId/impact/:id', getParameterImpact)
router.get('/:projectId/versions/:id', getParameterVersions)
router.get('/:projectId/export/:format', exportParametersHandler)
router.post('/:projectId/git/status', gitPublishStatusHandler)
router.post('/:projectId/git/validate-token', gitValidateTokenHandler)
router.post('/:projectId/git/pull', gitPullHandler)
router.post('/:projectId/import', importParametersHandler)
router.post('/:projectId/git/setup', gitPublishSetupHandler)
router.post('/:projectId/git/sync', gitPublishSyncHandler)
router.post('/:projectId/:id/restore/:versionId', restoreParameterVersionHandler)
router.get('/:projectId/facets', getParameterFacets)
router.get('/:projectId', getParameters)
router.get('/:projectId/:id', getParameter)
router.post('/:projectId', createParameter)
router.put('/:projectId/:id', updateParameter)
router.patch('/:projectId/bulk', bulkUpdateParameters)
router.delete('/:projectId/bulk', bulkDeleteParameters)
router.patch('/:projectId/:id/folder', moveParameterToFolder)
router.delete('/:projectId/:id', deleteParameter)

export default router
