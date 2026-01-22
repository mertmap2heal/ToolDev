import { BarChart3, Package, TrendingUp, Calendar, AlertTriangle, FileText } from 'lucide-react'
import InventoryNavigation from '../../../components/inventory/InventoryNavigation'

export default function ReportsPage() {
  const reports = [
    { id: 'stock-on-hand', name: 'Stock On Hand', icon: Package, description: 'Current inventory by location' },
    { id: 'movement', name: 'Stock Movement', icon: TrendingUp, description: 'Ledger history and movements' },
    { id: 'valuation', name: 'Inventory Valuation', icon: BarChart3, description: 'FIFO valuation report' },
    { id: 'expiring-lots', name: 'Expiring Lots', icon: Calendar, description: 'Lots approaching expiration' },
    { id: 'stock-turns', name: 'Stock Turns', icon: TrendingUp, description: 'Inventory turnover analysis' },
    { id: 'backorders', name: 'Backorders', icon: AlertTriangle, description: 'Unfulfilled orders' },
    { id: 'shrinkage', name: 'Shrinkage Report', icon: FileText, description: 'Discrepancies and adjustments' },
  ]

  return (
    <div className="p-6">
      <InventoryNavigation />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Reports
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          View inventory reports and analytics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => {
          const Icon = report.icon
          return (
            <div
              key={report.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {report.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{report.description}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
