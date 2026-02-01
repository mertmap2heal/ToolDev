import { Router } from 'express'
import {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
} from '../controllers/project.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticateToken)

router.post('/', createProject)
router.get('/', getProjects)
router.get('/:id', getProject)
router.put('/:id', updateProject)
router.delete('/:id', deleteProject)
router.get('/:id/members', getProjectMembers)
router.post('/:id/members', addProjectMember)
router.delete('/:id/members/:userId', removeProjectMember)

export default router
