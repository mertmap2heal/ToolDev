import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { getCompanies, type PlatformAdminCompanyItem } from '../../services/platformAdmin.service'

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<PlatformAdminCompanyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getCompanies()
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setCompanies(res.data)
        } else {
          setError(res.error || 'Failed to load companies')
        }
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load companies')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        Companies
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Companies (from user and project data). Unnamed company is shown as &quot;(No name)&quot;.
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-8">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading companies…</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Name
                </th>
                <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Users
                </th>
                <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Projects
                </th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                    No companies found.
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr
                    key={company.key ?? '__null__'}
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {company.displayName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {company.users.length} user{company.users.length !== 1 ? 's' : ''}
                      </span>
                      {company.users.length > 0 && (
                        <ul className="mt-1 text-sm text-gray-500 dark:text-gray-400 list-disc list-inside">
                          {company.users.map((u) => (
                            <li key={u.id}>
                              {u.email}
                              {u.name && u.name !== u.email ? ` (${u.name})` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {company.projectCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
