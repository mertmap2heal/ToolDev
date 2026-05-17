import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'
import * as useCaseController from '../controllers/usecase.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)
router.use('/:projectId', requireProjectMember)

// Actors — MUST come before `/:useCaseId` routes; otherwise Express
// matches the literal string "actors" as a `:useCaseId` and the
// actors GET 404s as "use case not found".
router.get('/:projectId/actors', useCaseController.getActors)
router.post('/:projectId/actors', useCaseController.createActor)
router.put('/:projectId/actors/:actorId', useCaseController.updateActor)
router.delete('/:projectId/actors/:actorId', useCaseController.deleteActor)

// Use Cases
router.get('/:projectId', useCaseController.getUseCases)
router.get('/:projectId/:useCaseId', useCaseController.getUseCase)
router.post('/:projectId', useCaseController.createUseCase)
router.put('/:projectId/:useCaseId', useCaseController.updateUseCase)
router.delete('/:projectId/:useCaseId', useCaseController.deleteUseCase)

export default router
