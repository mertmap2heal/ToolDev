import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import * as useCaseController from '../controllers/usecase.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

// Use Cases
router.get('/:projectId', useCaseController.getUseCases)
router.get('/:projectId/:useCaseId', useCaseController.getUseCase)
router.post('/:projectId', useCaseController.createUseCase)
router.put('/:projectId/:useCaseId', useCaseController.updateUseCase)
router.delete('/:projectId/:useCaseId', useCaseController.deleteUseCase)

// Actors
router.get('/:projectId/actors', useCaseController.getActors)
router.post('/:projectId/actors', useCaseController.createActor)
router.put('/:projectId/actors/:actorId', useCaseController.updateActor)
router.delete('/:projectId/actors/:actorId', useCaseController.deleteActor)

export default router
