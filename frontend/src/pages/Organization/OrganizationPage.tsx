import { useState, useEffect } from 'react'
import { Loader2, Building2, Mail, FileText, Users, FolderOpen } from 'lucide-react'
import { getOrganizationMe, type OrganizationMeResponse } from '../../services/organization.service'

export default function OrganizationPage() {
  const [data, setData] = useState<OrganizationMeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getOrganizationMe()
      .then((res) => {
        if (res.success && res.data) {
          setData(res.data)
        } else {
          setError(res.error || 'Failed to load organization')
        }
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load organization')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-12">
        <Loader2 size={24} className="animate-spin" />
        <span>Loading organization…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-400">
        {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        No organization data available.
      </div>
    )
  }

  const { organization, userCount, projectCount, maxUsers } = data
  const displayName = organization.displayName || organization.name || '(No name)'

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        Organization
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-2">
        Your company profile and overview. Organization name and details are managed by the platform administrator and are reflected here.
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
        To change organization information, use Platform Admin → Companies.
      </p>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Building2 size={24} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {displayName}
              </h2>
              {organization.name && organization.name !== displayName && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{organization.name}</p>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {organization.description && (
            <div className="flex gap-3">
              <FileText size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {organization.description}
                </p>
              </div>
            </div>
          )}
          {organization.contactEmail && (
            <div className="flex gap-3">
              <Mail size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Contact</p>
                <a
                  href={`mailto:${organization.contactEmail}`}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {organization.contactEmail}
                </a>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <Users size={20} className="text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Users</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{userCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <FolderOpen size={20} className="text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Projects</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{projectCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <Building2 size={20} className="text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">User limit</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {maxUsers == null ? 'No limit' : `${maxUsers} max`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
