import { Package, TrendingUp, ArrowDown, ArrowUp, AlertCircle, Clock } from 'lucide-react'
import InventoryNavigation from '../../../components/inventory/InventoryNavigation'

export default function DashboardPage() {
  return (
    <div className="p-6">
      <InventoryNavigation />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Package className="w-6 h-6" />
          Inventory Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Overview of inventory metrics and alerts
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">On Hand</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">0</p>
            </div>
            <Package className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Available</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">0</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Inbound</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">0</p>
            </div>
            <ArrowDown className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Outbound</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">0</p>
            </div>
            <ArrowUp className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Alerts
          </h3>
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No alerts at this time
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Activity
          </h3>
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No recent activity
          </div>
        </div>
      </div>
    </div>
  )
}
