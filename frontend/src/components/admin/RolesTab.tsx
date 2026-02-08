import { useState } from 'react'
import { Shield, Plus } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as adminService from '../../services/admin.service'
import { authService, updateStoredAdminProfileRoles } from '../../services/auth.service'
import type { Role } from '../../types/admin.types'
import RoleEditorModal from './RoleEditorModal'

export default function RolesTab() {
  const queryClient = useQueryClient()
  const [editorRole, setEditorRole] = useState<Role | null | 'new'>(null)

  const { data: roles = [], isLoading } = useQuery({
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

  const handleSave = async (
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

  return (
    <div className="space-y-4">
      {usersError && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-red-700 dark:text-red-300">
            {usersErrorMessage instanceof Error
              ? usersErrorMessage.message
              : 'Failed to load users from server.'}
            {' '}
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
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditorRole('new')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          <Plus size={16} />
          Create Role
        </button>
      </div>
      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Loading roles...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Name</th>
                <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Users with this role</th>
                <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
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
                    {usersByRole(role.id).length > 0
                      ? usersByRole(role.id).join(', ')
                      : '—'}
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
      {editorRole && (
        <RoleEditorModal
          role={editorRole === 'new' ? null : editorRole}
          users={users}
          onClose={() => setEditorRole(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
