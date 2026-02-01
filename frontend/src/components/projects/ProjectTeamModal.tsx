import { useState, useEffect } from 'react'
import { X, UserPlus, Trash2, Loader2 } from 'lucide-react'
import type { Project, ProjectMember, User } from '../../../shared/types/project.types'
import { projectService } from '../../services/project.service'
import { authService } from '../../services/auth.service'
import { useAuthStore } from '../../store/authStore'

interface ProjectTeamModalProps {
  project: Project | null
  onClose: () => void
  onSuccess?: () => void
}

export default function ProjectTeamModal({ project, onClose, onSuccess }: ProjectTeamModalProps) {
  const { setUser } = useAuthStore()
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [users, setUsers] = useState<Pick<User, 'id' | 'name' | 'email'>[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'member' | 'viewer'>('member')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [removeLoading, setRemoveLoading] = useState<string | null>(null)

  const isOwner =
    !!project &&
    !!currentUserId &&
    members.some((m) => m.userId === currentUserId && m.role === 'owner')

  const showInviteSection = !loading && !!project

  useEffect(() => {
    if (!project) return

    let cancelled = false
    setCurrentUserId(null)

    async function load() {
      setLoading(true)
      try {
        const [membersRes, usersRes, meRes] = await Promise.all([
          projectService.getProjectMembers(project.id),
          authService.getUsers(),
          authService.getCurrentUser(),
        ])
        if (!cancelled && meRes.success && meRes.data) {
          setCurrentUserId(meRes.data.id)
          setUser(meRes.data)
        }
        if (!cancelled && membersRes.success && membersRes.data) {
          setMembers(membersRes.data)
        }
        if (!cancelled && usersRes.success && usersRes.data) {
          setUsers(usersRes.data)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [project?.id, setUser])

  const availableUsers = users.filter(
    (u) => !members.some((m) => m.userId === u.id)
  )

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!project || !selectedUserId) return
    setInviteError('')
    setInviteLoading(true)
    try {
      const res = await projectService.addProjectMember(project.id, selectedUserId, selectedRole)
      if (res.success && res.data) {
        setMembers((prev) => [...prev, res.data!])
        setInviteOpen(false)
        setSelectedUserId('')
        setSelectedRole('member')
        onSuccess?.()
      } else {
        setInviteError(res.error || 'Failed to add member')
      }
    } catch {
      setInviteError('Failed to add member')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleRemove = async (userId: string) => {
    if (!project) return
    setRemoveLoading(userId)
    try {
      const res = await projectService.removeProjectMember(project.id, userId)
      if (res.success) {
        setMembers((prev) => prev.filter((m) => m.userId !== userId))
        onSuccess?.()
      }
    } finally {
      setRemoveLoading(null)
    }
  }

  if (!project) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-modal-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="team-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            Team – {project.name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            aria-label="Close"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {members.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {member.user?.name || member.userId}
                      </span>
                      {member.user?.email && (
                        <span className="block text-sm text-gray-500 dark:text-gray-400">
                          {member.user.email}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                        {member.role}
                      </span>
                      {isOwner && member.role !== 'owner' && (
                        <button
                          type="button"
                          onClick={() => handleRemove(member.userId)}
                          disabled={removeLoading === member.userId}
                          className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          aria-label={`Remove ${member.user?.name || member.userId}`}
                        >
                          {removeLoading === member.userId ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {showInviteSection && (
                <div className="mt-4">
                  {!inviteOpen ? (
                    <button
                      type="button"
                      onClick={() => setInviteOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                    >
                      <UserPlus size={18} />
                      Invite to project
                    </button>
                  ) : (
                    <form onSubmit={handleInvite} className="space-y-3 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        Add member
                      </h3>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          User
                        </label>
                        <select
                          value={selectedUserId}
                          onChange={(e) => setSelectedUserId(e.target.value)}
                          required
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="">Select a user</option>
                          {availableUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.email})
                            </option>
                          ))}
                        </select>
                        {availableUsers.length === 0 && (
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            All users are already in this project.
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Role
                        </label>
                        <select
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value as 'member' | 'viewer')}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </div>
                      {inviteError && (
                        <p className="text-sm text-red-600 dark:text-red-400">{inviteError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={inviteLoading || !selectedUserId || availableUsers.length === 0}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {inviteLoading && <Loader2 size={16} className="animate-spin" />}
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInviteOpen(false)
                            setInviteError('')
                            setSelectedUserId('')
                          }}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
