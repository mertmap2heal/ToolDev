import { ChevronDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import * as adminService from '../../../services/admin.service'

interface RoleSwitcherProps {
  isOpen: boolean
  onToggle: () => void
  selectedRole: string
  onRoleChange: (role: string) => void
  className?: string
}

export default function RoleSwitcher({ isOpen, onToggle, selectedRole, onRoleChange, className }: RoleSwitcherProps) {
  const { data: engineeringRoles = [] } = useQuery({
    queryKey: ['admin', 'engineeringRoles'],
    queryFn: () => adminService.getEngineeringRoles(),
  })

  const handleSelect = (role: string) => {
    onRoleChange(role)
    onToggle()
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <span>Role: {selectedRole}</span>
        <ChevronDown size={16} />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-20 max-h-64 overflow-y-auto">
          <button
            type="button"
            onClick={() => handleSelect('All')}
            className={`w-full text-left px-4 py-2 text-sm ${selectedRole === 'All'
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
          >
            All
          </button>
          {engineeringRoles.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelect(r.name)}
              className={`w-full text-left px-4 py-2 text-sm ${selectedRole === r.name
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
