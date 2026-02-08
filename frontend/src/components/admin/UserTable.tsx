import type { AdminUser } from '../../types/admin.types'

interface UserTableProps {
  users: AdminUser[]
  roleNames: Record<string, string>
  projectNames: Record<string, string>
  onEdit: (user: AdminUser) => void
  onResetPassword: (user: AdminUser) => void
  onToggleStatus: (user: AdminUser) => void
}

function formatDate(iso: string | undefined): string {
  if (!iso) return 'Never'
  try {
    const d = new Date(iso)
    const date = d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    return `${date} ${time}`
  } catch {
    return '—'
  }
}

export default function UserTable({
  users,
  roleNames,
  projectNames,
  onEdit,
  onResetPassword,
  onToggleStatus,
}: UserTableProps) {
  if (users.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
        No users match the current filters.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Username (email)</th>
            <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Name</th>
            <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Roles</th>
            <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Projects</th>
            <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Status</th>
            <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Last Login</th>
            <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.id}
              className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
            >
              <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                {user.username}
              </td>
              <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                {user.name ?? '—'}
              </td>
              <td className="py-3 px-4">
                {user.roles
                  .map((id) => roleNames[id] || id)
                  .filter(Boolean)
                  .join(', ') || '—'}
              </td>
              <td className="py-3 px-4">
                {user.projects
                  .map((id) => projectNames[id] || id)
                  .filter(Boolean)
                  .join(', ') || '—'}
              </td>
              <td className="py-3 px-4">
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    user.status === 'active'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {user.status}
                </span>
              </td>
              <td className="py-3 px-4">{formatDate(user.lastLoginAt)}</td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(user)}
                    className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onResetPassword(user)}
                    className="text-gray-600 dark:text-gray-400 hover:underline text-sm"
                  >
                    Reset Password
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleStatus(user)}
                    className="text-gray-600 dark:text-gray-400 hover:underline text-sm"
                  >
                    {user.status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
