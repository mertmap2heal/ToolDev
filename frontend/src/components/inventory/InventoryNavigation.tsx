import { useNavigate, useLocation } from 'react-router-dom'
import { 
  Package, 
  Warehouse, 
  ShoppingCart, 
  Truck, 
  ArrowLeftRight, 
  FileText,
  BarChart3,
  Settings
} from 'lucide-react'
import clsx from 'clsx'

interface NavigationItem {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  route: string
}

const navigationItems: NavigationItem[] = [
  { id: 'items', label: 'Items', icon: Package, route: 'items' },
  { id: 'warehouses', label: 'Warehouses', icon: Warehouse, route: 'warehouses' },
  { id: 'purchasing', label: 'Purchasing', icon: ShoppingCart, route: 'purchasing' },
  { id: 'sales', label: 'Sales', icon: Truck, route: 'sales' },
  { id: 'operations', label: 'Operations', icon: ArrowLeftRight, route: 'operations' },
  { id: 'reports', label: 'Reports', icon: BarChart3, route: 'reports' },
]

export default function InventoryNavigation() {
  const navigate = useNavigate()
  const location = useLocation()

  const getCurrentSection = () => {
    const path = location.pathname
    const match = path.match(/\/inventory\/([^/]+)/)
    return match ? match[1] : null
  }

  const currentSection = getCurrentSection()

  const handleNavigation = (route: string) => {
    navigate(`/inventory/${route}`)
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Inventory Management</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = currentSection === item.route

          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.route)}
              className={clsx(
                'flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-200 min-h-[100px]',
                isActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md cursor-pointer'
              )}
            >
              <Icon 
                size={24} 
                className={clsx(
                  'mb-2',
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400'
                )} 
              />
              <span className={clsx(
                'text-xs font-medium text-center',
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400'
              )}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
