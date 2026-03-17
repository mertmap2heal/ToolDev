import { useState } from 'react'
import { Settings, ArrowRightLeft, Edit, ClipboardCheck } from 'lucide-react'
import InventoryNavigation from '../../../components/inventory/InventoryNavigation'

export default function OperationsPage() {
  const [activeTab, setActiveTab] = useState<'transfers' | 'adjustments' | 'cycle-counts'>('transfers')

  return (
    <div className="p-6">
      <InventoryNavigation />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6" />
          Inventory Operations
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage transfers, adjustments, and cycle counts
        </p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('transfers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'transfers'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4 inline mr-2" />
          Transfers
        </button>
        <button
          onClick={() => setActiveTab('adjustments')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'adjustments'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Edit className="w-4 h-4 inline mr-2" />
          Adjustments
        </button>
        <button
          onClick={() => setActiveTab('cycle-counts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'cycle-counts'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <ClipboardCheck className="w-4 h-4 inline mr-2" />
          Cycle Counts
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          {activeTab === 'transfers' && 'Transfer management coming soon...'}
          {activeTab === 'adjustments' && 'Stock adjustment management coming soon...'}
          {activeTab === 'cycle-counts' && 'Cycle count management coming soon...'}
        </p>
      </div>
    </div>
  )
}
