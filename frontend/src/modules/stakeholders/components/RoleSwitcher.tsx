import { ChevronDown } from 'lucide-react'
import type { StakeholderRole } from '../types'
import { useStakeholdersStore } from '../store'

const ROLES: { id: StakeholderRole; label: string }[] = [
  { id: 'Admin', label: 'Admin' },
  { id: 'ProgramManager', label: 'Program Manager' },
  { id: 'Auditor', label: 'Auditor' },
  { id: 'Engineer', label: 'Engineer' },
]

interface RoleSwitcherProps {
  isOpen: boolean
  onToggle: () => void
  className?: string
}

export default function RoleSwitcher({ isOpen, onToggle, className }: RoleSwitcherProps) {
  const { state, dispatch } = useStakeholdersStore()

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <span>Role: {state.role}</span>
        <ChevronDown size={16} />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-20">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                dispatch({ type: 'SET_ROLE', payload: r.id })
                onToggle()
              }}
              className={`w-full text-left px-4 py-2 text-sm ${
                state.role === r.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
