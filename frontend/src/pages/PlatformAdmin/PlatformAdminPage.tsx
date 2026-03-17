import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Building2, Users, FolderOpen, AlertTriangle } from 'lucide-react'
import { getPlatformStats } from '../../services/platformAdmin.service'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export default function PlatformAdminPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['platform-admin', 'stats'],
    queryFn: async () => {
      const res = await getPlatformStats()
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Failed to load stats')
      }
      return res.data
    },
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          Platform Admin
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Manage companies, company limits, and view global audit logs. Use the sidebar to switch company context.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-8">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading overview…</span>
        </div>
      ) : stats ? (
        <>
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Overview</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <Building2 size={18} />
                  <span className="text-sm">Companies</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats.totalCompanies}
                </p>
              </div>
              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <Users size={18} />
                  <span className="text-sm">Users</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats.totalUsers}
                </p>
              </div>
              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <FolderOpen size={18} />
                  <span className="text-sm">Projects</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats.totalProjects}
                </p>
              </div>
              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <AlertTriangle size={18} />
                  <span className="text-sm">At user limit</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats.companiesAtLimit}
                </p>
              </div>
            </div>
          </div>

          {stats.recentEvents.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Recent activity
              </h2>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                          Timestamp
                        </th>
                        <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                          Company
                        </th>
                        <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                          Action
                        </th>
                        <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                          Entity
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentEvents.map((e) => (
                        <tr
                          key={e.id}
                          className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/50"
                        >
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {formatDate(e.timestamp)}
                          </td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                            {e.companyName ?? '(No name)'}
                          </td>
                          <td className="py-3 px-4">{e.action}</td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                            {e.entityType}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                <Link
                  to="/platform-admin/audit-logs"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View full audit log →
                </Link>
              </p>
            </div>
          )}
        </>
      ) : null}

      <div>
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Quick links</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/platform-admin/companies"
          className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600"
        >
          <h2 className="font-medium text-gray-900 dark:text-white">Companies</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            View and manage companies
          </p>
        </Link>
        <Link
          to="/platform-admin/limits"
          className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600"
        >
          <h2 className="font-medium text-gray-900 dark:text-white">Company limits</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            User quota per company
          </p>
        </Link>
        <Link
          to="/platform-admin/audit-logs"
          className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600"
        >
          <h2 className="font-medium text-gray-900 dark:text-white">Global audit logs</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Platform-wide audit trail
          </p>
        </Link>
        </div>
      </div>
    </div>
  )
}
