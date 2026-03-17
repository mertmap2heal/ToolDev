import { useState } from 'react'
import { ShoppingBag, Users, Package, Truck } from 'lucide-react'
import InventoryNavigation from '../../../components/inventory/InventoryNavigation'
import CustomersTab from '../../../components/inventory/sales/CustomersTab'
import SalesOrdersTab from '../../../components/inventory/sales/SalesOrdersTab'
import ShipmentsTab from '../../../components/inventory/sales/ShipmentsTab'

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<'customers' | 'sales-orders' | 'shipments'>('sales-orders')

  return (
    <div className="p-6">
      <InventoryNavigation />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ShoppingBag className="w-6 h-6" />
          Sales & Fulfillment
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage customers, sales orders, and shipments
        </p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('customers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'customers'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Customers
        </button>
        <button
          onClick={() => setActiveTab('sales-orders')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'sales-orders'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Sales Orders
        </button>
        <button
          onClick={() => setActiveTab('shipments')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'shipments'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Truck className="w-4 h-4 inline mr-2" />
          Shipments
        </button>
      </div>

      {activeTab === 'customers' && <CustomersTab />}
      {activeTab === 'sales-orders' && <SalesOrdersTab />}
      {activeTab === 'shipments' && <ShipmentsTab />}
    </div>
  )
}
