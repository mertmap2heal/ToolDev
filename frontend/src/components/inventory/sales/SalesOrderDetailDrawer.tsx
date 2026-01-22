import { useState } from 'react'
import { X, Package, Plus, CheckCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryService } from '../../../services/inventory.service'
import CreateShipmentModal from './CreateShipmentModal'

interface SalesOrderDetailDrawerProps {
  salesOrder: any
  isOpen: boolean
  onClose: () => void
}

export default function SalesOrderDetailDrawer({
  salesOrder,
  isOpen,
  onClose,
}: SalesOrderDetailDrawerProps) {
  const [isCreateShipmentModalOpen, setIsCreateShipmentModalOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: soData, isLoading } = useQuery({
    queryKey: ['sales-order', salesOrder.id],
    queryFn: () => inventoryService.getSalesOrder(salesOrder.id),
    enabled: isOpen,
  })

  const allocateMutation = useMutation({
    mutationFn: (soId: string) => inventoryService.allocateSalesOrder(soId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-order', salesOrder.id] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
    },
  })

  const handleAllocate = async () => {
    if (window.confirm(`Allocate reservations for sales order ${so?.number}?`)) {
      try {
        await allocateMutation.mutateAsync(so.id)
        alert('Reservations allocated successfully!')
      } catch (error: any) {
        alert(error.response?.data?.error || 'Failed to allocate sales order')
      }
    }
  }

  if (!isOpen) return null

  const so = soData?.data || salesOrder

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 w-full max-w-4xl h-full shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Package className="w-6 h-6" />
                {so.number}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Customer: {so.customer?.name || '-'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {so.status === 'Approved' && (
                <button
                  onClick={handleAllocate}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Allocate
                </button>
              )}
              {so.status === 'Allocated' && (
                <button
                  onClick={() => setIsCreateShipmentModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Shipment
                </button>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Sales Order Details
                </h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Number</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{so.number}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                    <dd className="mt-1">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        {so.status}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Customer</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {so.customer?.name || '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Ordered Date</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {new Date(so.orderedAt).toLocaleDateString()}
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Line Items</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Item
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Qty Ordered
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Qty Allocated
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Qty Shipped
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Unit Price
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {so.lines?.map((line: any) => (
                        <tr key={line.id}>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {line.item?.sku} - {line.item?.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            {Number(line.qtyOrdered).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            {Number(line.qtyAllocated).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            {Number(line.qtyShipped).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            ${Number(line.unitPrice).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isCreateShipmentModalOpen && (
        <CreateShipmentModal
          isOpen={isCreateShipmentModalOpen}
          onClose={() => setIsCreateShipmentModalOpen(false)}
          salesOrderId={so.id}
          onSuccess={() => {
            setIsCreateShipmentModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['shipments'] })
            queryClient.invalidateQueries({ queryKey: ['sales-order', so.id] })
          }}
        />
      )}
    </div>
  )
}
