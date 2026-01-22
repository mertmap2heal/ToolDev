import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShoppingCart, Package, Receipt, Users, Plus } from 'lucide-react'
import InventoryNavigation from '../../../components/inventory/InventoryNavigation'
import { inventoryService } from '../../../services/inventory.service'
import SuppliersTab from '../../../components/inventory/purchasing/SuppliersTab'
import PurchaseOrdersTab from '../../../components/inventory/purchasing/PurchaseOrdersTab'
import ReceiptsTab from '../../../components/inventory/purchasing/ReceiptsTab'

export default function PurchasingPage() {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'purchase-orders' | 'receipts'>('purchase-orders')

  return (
    <div className="p-6">
      <InventoryNavigation />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ShoppingCart className="w-6 h-6" />
          Purchasing
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage suppliers, purchase orders, and goods receipts
        </p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'suppliers'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Suppliers
        </button>
        <button
          onClick={() => setActiveTab('purchase-orders')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'purchase-orders'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Purchase Orders
        </button>
        <button
          onClick={() => setActiveTab('receipts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'receipts'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Receipt className="w-4 h-4 inline mr-2" />
          Receipts
        </button>
      </div>

      {activeTab === 'suppliers' && <SuppliersTab />}
      {activeTab === 'purchase-orders' && <PurchaseOrdersTab />}
      {activeTab === 'receipts' && <ReceiptsTab />}
    </div>
  )
}
