import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, UserMinus, Users, Shield } from 'lucide-react'
import clsx from 'clsx'
import * as stakeholderRolesService from '../../../services/stakeholderRoles.service'
import type { EngineeringRole, StakeholderUser } from '../../../types/admin.types'

const QK = (projectId: string) => ({
  engineeringRoles: ['project', projectId, 'engineeringRoles'] as const,
  usersWithRoles: ['project', projectId, 'usersWithRoles'] as const,
})

interface EngineeringRolesManagementTabProps {
  projectId: string
  canEdit: boolean
  onShowToast: (msg: string) => void
}

export default function EngineeringRolesManagementTab({
  projectId,
  canEdit,
  onShowToast,
}: EngineeringRolesManagementTabProps) {
  const queryClient = useQueryClient()
  const keys = QK(projectId)
  const [assignRoleId, setAssignRoleId] = useState<string | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())

  const { data: roles = [], isLoading: rolesLoading, isError: rolesError } = useQuery({
    queryKey: keys.engineeringRoles,
    queryFn: () => stakeholderRolesService.getProjectEngineeringRoles(projectId),
    enabled: !!projectId,
  })

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: keys.usersWithRoles,
    queryFn: () => stakeholderRolesService.getProjectUsersWithRoles(projectId),
    enabled: !!projectId,
  })

  const assignMutation = useMutation({
    mutationFn: async ({ roleId, userIds }: { roleId: string; userIds: string[] }) => {
      await stakeholderRolesService.assignProjectEngineeringRole(projectId, roleId, userIds)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.engineeringRoles })
      await queryClient.invalidateQueries({ queryKey: keys.usersWithRoles })
      onShowToast('Role assignments updated.')
      setAssignRoleId(null)
      setSelectedUserIds(new Set())
    },
    onError: (e: Error) => onShowToast(e.message ?? 'Assign failed'),
  })

  const unassignMutation = useMutation({
    mutationFn: async ({ roleId, userIds }: { roleId: string; userIds: string[] }) => {
      await stakeholderRolesService.unassignProjectEngineeringRole(projectId, roleId, userIds)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.engineeringRoles })
      await queryClient.invalidateQueries({ queryKey: keys.usersWithRoles })
      onShowToast('Removed from role.')
    },
    onError: (e: Error) => onShowToast(e.message ?? 'Unassign failed'),
  })

  const assignRole = roles.find((r) => r.id === assignRoleId)
  const usersWithoutRole: StakeholderUser[] = assignRoleId
    ? users.filter((u) => !u.engineeringRoles.some((er) => er.id === assignRoleId))
    : []

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submitAssign = () => {
    if (!assignRoleId || selectedUserIds.size === 0) return
    assignMutation.mutate({ roleId: assignRoleId, userIds: [...selectedUserIds] })
  }

  if (!projectId) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Open this page from a project to manage roles.</p>
  }

  if (rolesLoading || usersLoading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading roles…</p>
  }

  if (rolesError) {
    return <p className="text-sm text-red-600 dark:text-red-400">Could not load engineering roles. Ensure you are signed in and have project access.</p>
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-start gap-3 mb-2">
          <Shield className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={22} />
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Role &amp; stakeholder management</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Discipline roles are the single source of truth for this project. Lifecycle transition rules consume the same
              catalog (by role id). Assignments are audited on the server.
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Role definitions (create/delete non-system roles) remain in the Admin Panel. Directory shows all project members
          and their project-scoped assignments.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {roles.map((role) => (
          <div
            key={role.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 flex flex-col"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{role.name}</h3>
                {role.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{role.description}</p>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {role.isSystem ? 'System role' : 'Custom role'} · {role.userCount} assigned
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setAssignRoleId(role.id)
                    setSelectedUserIds(new Set())
                  }}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  <Plus size={14} />
                  Assign
                </button>
              )}
            </div>
            <div className="flex-1 border-t border-gray-100 dark:border-gray-700 pt-3">
              {role.assignedUsers && role.assignedUsers.length > 0 ? (
                <ul className="space-y-2 max-h-40 overflow-y-auto">
                  {role.assignedUsers.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between gap-2 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <span className="truncate">
                        {u.name} <span className="text-gray-400 dark:text-gray-500">({u.email})</span>
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          title="Remove from role"
                          onClick={() => unassignMutation.mutate({ roleId: role.id, userIds: [u.id] })}
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          disabled={unassignMutation.isPending}
                        >
                          <UserMinus size={16} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Users size={16} className="opacity-50" />
                  No users assigned in this project.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {assignRoleId && assignRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-w-lg w-full max-h-[80vh] flex flex-col"
            role="dialog"
            aria-labelledby="assign-role-title"
          >
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 id="assign-role-title" className="font-semibold text-gray-900 dark:text-white">
                Assign to {assignRole.name}
              </h3>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm"
                onClick={() => {
                  setAssignRoleId(null)
                  setSelectedUserIds(new Set())
                }}
              >
                Close
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {usersWithoutRole.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">All project members already have this role.</p>
              ) : (
                <ul className="space-y-2">
                  {usersWithoutRole.map((u) => (
                    <li key={u.id}>
                      <label
                        className={clsx(
                          'flex items-center gap-3 p-2 rounded-lg border cursor-pointer',
                          selectedUserIds.has(u.id)
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(u.id)}
                          onChange={() => toggleUser(u.id)}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {u.name} <span className="text-gray-500">({u.email})</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg"
                onClick={() => {
                  setAssignRoleId(null)
                  setSelectedUserIds(new Set())
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedUserIds.size === 0 || assignMutation.isPending}
                className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                onClick={submitAssign}
              >
                Assign selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
