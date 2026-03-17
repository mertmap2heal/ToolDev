import { useState } from 'react'
import { X, Package, MapPin, History, TrendingUp } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { inventoryService, Item } from '../../services/inventory.service'

interface ItemDetailDrawerProps {
  item: Item
  isOpen: boolean
  onClose: () => void
}

export default function ItemDetailDrawer({ item, isOpen, onClose }: ItemDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'stock' | 'ledger'>('overview')

  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ['item-stock', item.id],
    queryFn: () => inventoryService.getItemStock(item.id),
    enabled: isOpen && activeTab === 'stock',
  })

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ['item-ledger', item.id],
    queryFn: () => inventoryService.getItemLedger(item.id, { limit: 50 }),
    enabled: isOpen && activeTab === 'ledger',
  })

  if (!isOpen) return null

  const stock = stockData?.data || []
  const ledger = ledgerData?.data || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 w-full max-w-4xl h-full shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Package className="w-6 h-6" />
                {item.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">SKU: {item.sku}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex gap-2 mt-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'stock'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <MapPin className="w-4 h-4 inline mr-1" />
              Stock
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'ledger'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <History className="w-4 h-4 inline mr-1" />
              Ledger
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Item Details
                </h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">SKU</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{item.sku}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{item.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Tracking Policy
                    </dt>
                    <dd className="mt-1">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        {item.trackingPolicy}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                    <dd className="mt-1">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          item.isActive
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </dd>
                  </div>
                  {item.uom && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">UOM</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {item.uom.code} - {item.uom.name}
                      </dd>
                    </div>
                  )}
                  {item.category && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Category
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {item.category.name}
                      </dd>
                    </div>
                  )}
                </dl>
                {item.description && (
                  <div className="mt-4">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Description
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {item.description}
                    </dd>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'stock' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Stock by Location
              </h3>
              {stockLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : stock.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No stock found for this item
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Warehouse
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Location
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          On Hand
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Reserved
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Available
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {stock.map((s) => (
                        <tr key={s.locationId}>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {s.warehouseName} ({s.warehouseCode})
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {s.locationCode}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            {s.qtyOnHand.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            {s.qtyReserved.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                            {s.qtyAvailable.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ledger' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Movement History
              </h3>
              {ledgerLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : ledger.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No ledger entries found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Event
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          From
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          To
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Quantity
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {ledger.map((entry) => (
                        <tr key={entry.id}>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {new Date(entry.occurredAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {entry.eventType}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {entry.fromLocation?.code || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {entry.toLocation?.code || '-'}
                          </td>
                          <td
                            className={`px-4 py-3 text-sm text-right font-medium ${
                              entry.qtyDelta >= 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {entry.qtyDelta >= 0 ? '+' : ''}
                            {entry.qtyDelta.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
