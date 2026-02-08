import { useState, useMemo, useEffect } from 'react'
import { Search, UserPlus } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as adminService from '../../services/admin.service'
import { authService } from '../../services/auth.service'
import type { AdminUser } from '../../types/admin.types'
import UserTable from './UserTable'
import UserCreateModal from './UserCreateModal'
import CreateUserCredentialsModal from './CreateUserCredentialsModal'
import UserEditDrawer from './UserEditDrawer'
import ResetPasswordModal from './ResetPasswordModal'

export default function UsersTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [credentialsModal, setCredentialsModal] = useState<{
    username: string
    generatedPassword: string
  } | null>(null)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<AdminUser | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const {
    data: authUsersResponse,
    isLoading: usersLoading,
    isError: usersError,
    error: usersErrorMessage,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['admin', 'authUsers'],
    queryFn: () => authService.getUsersAsAdminUsers(),
  })
  const rawUsers: AdminUser[] = authUsersResponse ?? []

  const { data: projects = [] } = useQuery({
    queryKey: ['admin', 'projects'],
    queryFn: () => adminService.getProjects(),
  })

  const users = useMemo(
    () =>
      rawUsers.map((u) => ({
        ...u,
        projects: projects.filter((p) => p.members.includes(u.id)).map((p) => p.id),
      })),
    [rawUsers, projects]
  )

  const { data: roles = [] } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => adminService.getRoles(),
  })

  const roleNames = useMemo(
    () => Object.fromEntries(roles.map((r) => [r.id, r.name])),
    [roles]
  )
  const projectNames = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.name])),
    [projects]
  )

  const filteredUsers = useMemo(() => {
    let list = users
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          (u.name && u.name.toLowerCase().includes(q))
      )
    }
    if (filterRole) {
      list = list.filter((u) => u.roles.includes(filterRole))
    }
    if (filterProject) {
      list = list.filter((u) => u.projects.includes(filterProject))
    }
    if (filterStatus) {
      list = list.filter((u) => u.status === filterStatus)
    }
    return list
  }, [users, search, filterRole, filterProject, filterStatus])

  const handleResetPassword = (user: AdminUser) => {
    setResetPasswordUser(user)
  }

  const handleSendInvite = async (user: AdminUser) => {
    const res = await authService.sendInvite(user.id)
    const successMessage = res.data?.message ?? (res as { message?: string }).message
    if (res.success && successMessage) {
      setToastMessage(successMessage)
    } else {
      setToastMessage(res.error ?? 'Failed to send invite.')
    }
    queryClient.invalidateQueries({ queryKey: ['admin', 'authUsers'] })
  }

  useEffect(() => {
    if (!toastMessage) return
    const t = setTimeout(() => setToastMessage(null), 4000)
    return () => clearTimeout(t)
  }, [toastMessage])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        >
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          <UserPlus size={16} />
          Create User
        </button>
      </div>

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
      {usersLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Loading users...</p>
      ) : (
        <UserTable
          users={filteredUsers}
          roleNames={roleNames}
          projectNames={projectNames}
          onEdit={setEditUser}
          onResetPassword={handleResetPassword}
          onSendInvite={handleSendInvite}
        />
      )}

      {createOpen && (
        <UserCreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={(username, generatedPassword) => {
            setCreateOpen(false)
            setCredentialsModal({ username, generatedPassword })
            queryClient.invalidateQueries({ queryKey: ['admin', 'authUsers'] })
          }}
        />
      )}

      {credentialsModal && (
        <CreateUserCredentialsModal
          username={credentialsModal.username}
          generatedPassword={credentialsModal.generatedPassword}
          onClose={() => setCredentialsModal(null)}
        />
      )}

      {editUser && (
        <UserEditDrawer
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null)
            queryClient.invalidateQueries({ queryKey: ['admin', 'authUsers'] })
            queryClient.invalidateQueries({ queryKey: ['admin', 'projects'] })
          }}
          onRefetchUsers={() => queryClient.invalidateQueries({ queryKey: ['admin', 'authUsers'] })}
        />
      )}

      {resetPasswordUser && (
        <ResetPasswordModal
          user={resetPasswordUser}
          onClose={() => setResetPasswordUser(null)}
          onSuccess={() => {
            setResetPasswordUser(null)
            queryClient.invalidateQueries({ queryKey: ['admin', 'authUsers'] })
          }}
        />
      )}

      {toastMessage && (
        <div
          className="fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg bg-gray-900 dark:bg-gray-700 text-white text-sm"
          role="alert"
        >
          {toastMessage}
        </div>
      )}
    </div>
  )
}
