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
  acceptProjectInvitation,
  declineProjectInvitation,
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
router.post('/:id/invitations/accept', acceptProjectInvitation)
router.post('/:id/invitations/decline', declineProjectInvitation)

export default router
