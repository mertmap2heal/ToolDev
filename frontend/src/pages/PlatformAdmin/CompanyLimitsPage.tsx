import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { getLimits, setCompanyLimit, type PlatformAdminLimitItem } from '../../services/platformAdmin.service'

export default function CompanyLimitsPage() {
  const [items, setItems] = useState<PlatformAdminLimitItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getLimits()
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setItems(res.data)
          setEditing({})
        } else {
          setError(res.error || 'Failed to load limits')
        }
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load limits')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
  }, [])

  const getEditValue = (item: PlatformAdminLimitItem): string => {
    if (item.companyKey in editing) return editing[item.companyKey]
    return item.maxUsers == null ? '' : String(item.maxUsers)
  }

  const setEditValue = (companyKey: string, value: string) => {
    setEditing((prev) => ({ ...prev, [companyKey]: value }))
  }

  const handleSave = async (item: PlatformAdminLimitItem) => {
    const raw = getEditValue(item)
    const maxUsers = raw.trim() === '' ? null : parseInt(raw, 10)
    if (raw.trim() !== '' && (Number.isNaN(maxUsers) || maxUsers === null || (maxUsers !== null && maxUsers < 0))) {
      setError('Max users must be a non-negative number or empty for no limit.')
      return
    }
    setSaving(item.companyKey)
    setError(null)
    try {
      const res = await setCompanyLimit(item.companyKey, maxUsers as number | null)
      if (res.success) {
        setEditing((prev) => {
          const next = { ...prev }
          delete next[item.companyKey]
          return next
        })
        load()
      } else {
        setError(res.error || 'Failed to save limit')
      }
    } catch (err) {
      setError((err as Error)?.message || 'Failed to save limit')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        Company limits
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Set the maximum number of users (excluding platform admin) that each company can have. Leave empty for no limit.
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-8">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading limits…</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {!loading && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Company
                </th>
                <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Current users
                </th>
                <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Max users
                </th>
                <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 w-24">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                    No companies found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.companyKey}
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {item.displayName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {item.currentUserCount}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        placeholder="No limit"
                        value={getEditValue(item)}
                        onChange={(e) => setEditValue(item.companyKey, e.target.value)}
                        className="w-28 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleSave(item)}
                        disabled={saving === item.companyKey}
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                      >
                        {saving === item.companyKey ? (
                          <Loader2 size={16} className="animate-spin inline" />
                        ) : (
                          'Save'
                        )}
                      </button>
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
