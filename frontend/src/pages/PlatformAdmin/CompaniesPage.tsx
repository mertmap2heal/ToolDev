import { useState, useEffect } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import {
  getOrganizations,
  updateOrganization,
  type PlatformAdminOrganizationItem,
} from '../../services/platformAdmin.service'

interface EditModalProps {
  item: PlatformAdminOrganizationItem
  onClose: () => void
  onSaved: () => void
}

function EditOrganizationModal({ item, onClose, onSaved }: EditModalProps) {
  const [name, setName] = useState(item.name)
  const [displayName, setDisplayName] = useState(item.displayName ?? '')
  const [description, setDescription] = useState(item.description ?? '')
  const [contactEmail, setContactEmail] = useState(item.contactEmail ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await updateOrganization(item.companyKey, {
        name: name.trim() || item.name,
        displayName: displayName.trim() || null,
        description: description.trim() || null,
        contactEmail: contactEmail.trim() || null,
      })
      if (res.success) {
        onSaved()
        onClose()
      } else {
        setError(res.error || 'Failed to save')
      }
    } catch (err) {
      setError((err as Error)?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Edit organization
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {item.displayName || item.name}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="(No name)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contact email
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CompaniesPage() {
  const [organizations, setOrganizations] = useState<PlatformAdminOrganizationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<PlatformAdminOrganizationItem | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getOrganizations()
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setOrganizations(res.data)
        } else {
          setError(res.error || 'Failed to load organizations')
        }
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load organizations')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        Companies
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Organization profiles (name, description, contact) and stats. Edit to set company information visible in the Organization menu.
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-8">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading…</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Name
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Description
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Users
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Projects
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Max users
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 w-20">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {organizations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                      No organizations found.
                    </td>
                  </tr>
                ) : (
                  organizations.map((org) => (
                    <tr
                      key={org.companyKey}
                      className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {org.displayName || org.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {org.description || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {org.contactEmail || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {org.userCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {org.projectCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {org.maxUsers == null ? '—' : org.maxUsers}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setEditing(org)}
                          className="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          title="Edit organization"
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <EditOrganizationModal
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
