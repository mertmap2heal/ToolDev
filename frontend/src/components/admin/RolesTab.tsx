import { useState } from 'react'
import { Shield, Plus, AlertTriangle } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as adminService from '../../services/admin.service'
import { authService, updateStoredAdminProfileRoles } from '../../services/auth.service'
import type { Role, EngineeringRole } from '../../types/admin.types'
import RoleEditorModal from './RoleEditorModal'
import EngineeringRoleCard from './EngineeringRoleCard'
import EngineeringRoleEditorModal from './EngineeringRoleEditorModal'

export default function RolesTab() {
  const queryClient = useQueryClient()

  // --- Permission roles (existing AdminRole) ---
  const [editorRole, setEditorRole] = useState<Role | null | 'new'>(null)

  const { data: permRoles = [], isLoading: permLoading } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => adminService.getRoles(),
  })

  const {
    data: users = [],
    isError: usersError,
    error: usersErrorMessage,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['admin', 'authUsers'],
    queryFn: () => authService.getUsersAsAdminUsers(),
  })

  const usersByRole = (roleId: string) =>
    users.filter((u) => u.roles.includes(roleId)).map((u) => u.username)

  const handlePermSave = async (
    name: string,
    defaultPermissions: Role['defaultPermissions'],
    selectedUserIds?: string[]
  ) => {
    if (editorRole === 'new') {
      await adminService.createRole(name, defaultPermissions)
    } else if (editorRole && editorRole.id) {
      await adminService.updateRole(editorRole.id, { name, defaultPermissions })
      if (selectedUserIds !== undefined) {
        for (const u of users) {
          const newRoles = u.roles.filter((r) => r !== editorRole.id)
          if (selectedUserIds.includes(u.id)) newRoles.push(editorRole.id)
          updateStoredAdminProfileRoles(u.id, newRoles)
        }
      }
    }
    queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'authUsers'] })
  }

  // --- Engineering roles ---
  const [engEditorRole, setEngEditorRole] = useState<EngineeringRole | null | 'new'>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<EngineeringRole | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const { data: engRoles = [], isLoading: engLoading } = useQuery({
    queryKey: ['admin', 'engineeringRoles'],
    queryFn: () => adminService.getEngineeringRoles(),
  })

  const handleEngSave = async (data: {
    name: string
    description: string
    selectedUserIds: string[]
  }) => {
    if (engEditorRole === 'new') {
      const created = await adminService.createEngineeringRole(data.name, data.description)
      if (data.selectedUserIds.length > 0) {
        await adminService.assignEngineeringRole(created.id, data.selectedUserIds)
      }
    } else if (engEditorRole && engEditorRole.id) {
      await adminService.updateEngineeringRole(engEditorRole.id, {
        name: data.name,
        description: data.description,
      })
      // Determine who to add and who to remove
      const prevIds = new Set(engEditorRole.assignedUsers?.map((u) => u.id) ?? [])
      const nextIds = new Set(data.selectedUserIds)
      const toAdd = data.selectedUserIds.filter((id) => !prevIds.has(id))
      const toRemove = Array.from(prevIds).filter((id) => !nextIds.has(id))
      if (toAdd.length > 0) {
        await adminService.assignEngineeringRole(engEditorRole.id, toAdd)
      }
      if (toRemove.length > 0) {
        await adminService.unassignEngineeringRole(engEditorRole.id, toRemove)
      }
    }
    queryClient.invalidateQueries({ queryKey: ['admin', 'engineeringRoles'] })
  }

  const handleEngDelete = async () => {
    if (!deleteConfirm) return
    setDeleteError('')
    try {
      await adminService.deleteEngineeringRole(deleteConfirm.id)
      queryClient.invalidateQueries({ queryKey: ['admin', 'engineeringRoles'] })
      setDeleteConfirm(null)
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete role')
    }
  }

  return (
    <div className="space-y-8">
      {usersError && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-red-700 dark:text-red-300">
            {usersErrorMessage instanceof Error
              ? usersErrorMessage.message
              : 'Failed to load users from server.'}{' '}
            Make sure you are logged in and the backend is running.
          </p>
          <button
            type="button"
            onClick={() => refetchUsers()}
            className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
          >
            Retry
          </button>
        </div>
      )}

      {/* ═══════════ Roles Section ═══════════ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield size={18} className="text-blue-600 dark:text-blue-400" />
              Roles
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Discipline-based roles assigned to users across projects
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEngEditorRole('new')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add Role
          </button>
        </div>

        {engLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
            Loading engineering roles...
          </p>
        ) : engRoles.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
            No engineering roles found. They will be seeded on first load.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {engRoles.map((role) => (
              <EngineeringRoleCard
                key={role.id}
                role={role}
                onEdit={(r) => setEngEditorRole(r)}
                onDelete={(r) => {
                  setDeleteError('')
                  setDeleteConfirm(r)
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* ═══════════ Permission Templates Section ═══════════ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Permission Templates
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Access-level roles that control what users can do in the system
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditorRole('new')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Create Permission Role
          </button>
        </div>

        {permLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Loading roles...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Name</th>
                  <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                    Users with this role
                  </th>
                  <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {permRoles.map((role) => (
                  <tr
                    key={role.id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  >
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                        <Shield size={14} className="text-gray-500" />
                        {role.name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                      {usersByRole(role.id).length > 0 ? usersByRole(role.id).join(', ') : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => setEditorRole(role)}
                        className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ═══════════ Modals ═══════════ */}
      {editorRole && (
        <RoleEditorModal
          role={editorRole === 'new' ? null : editorRole}
          users={users}
          onClose={() => setEditorRole(null)}
          onSave={handlePermSave}
        />
      )}

      {engEditorRole && (
        <EngineeringRoleEditorModal
          role={engEditorRole === 'new' ? null : engEditorRole}
          users={users}
          initialAssignedUserIds={
            engEditorRole !== 'new'
              ? engEditorRole.assignedUsers?.map((u) => u.id) ?? []
              : []
          }
          onClose={() => setEngEditorRole(null)}
          onSave={handleEngSave}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Delete Role
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Are you sure you want to delete{' '}
                  <strong className="text-gray-700 dark:text-gray-200">
                    {deleteConfirm.name}
                  </strong>
                  ? This action cannot be undone.
                </p>
              </div>
            </div>
            {deleteError && (
              <div className="mb-4 px-3 py-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEngDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
