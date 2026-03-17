import { useState, useEffect } from 'react'
import { Building2, ChevronDown, X } from 'lucide-react'
import { projectService } from '../../services/project.service'
import { usePlatformAdminStore } from '../../store/platformAdminStore'

export default function CompanySelector() {
  const [open, setOpen] = useState(false)
  const [companyNames, setCompanyNames] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const { activeCompanyName, setActiveCompanyName } = usePlatformAdminStore()

  useEffect(() => {
    setLoading(true)
    projectService
      .getProjects()
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const names = [...new Set(res.data.map((p) => p.companyName).filter(Boolean))] as string[]
          names.sort((a, b) => (a ?? '').localeCompare(b ?? ''))
          setCompanyNames(names)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Switch company context"
      >
        <Building2 size={18} />
        <span className="flex-1 text-left truncate">
          {activeCompanyName ? `Operating as: ${activeCompanyName}` : 'Switch company context'}
        </span>
        <ChevronDown size={16} className="flex-shrink-0" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            className="absolute left-0 right-0 mt-1 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto"
          >
            <li role="option">
              <button
                type="button"
                onClick={() => {
                  setActiveCompanyName(null)
                  setOpen(false)
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={16} />
                Clear context
              </button>
            </li>
            {loading ? (
              <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                Loading…
              </li>
            ) : (
              companyNames.map((name) => (
                <li key={name} role="option">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCompanyName(name)
                      setOpen(false)
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      activeCompanyName === name
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Building2 size={16} />
                    {name}
                  </button>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </div>
  )
}
