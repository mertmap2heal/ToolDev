import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Eye, CheckCircle, Package } from 'lucide-react'
import { inventoryService } from '../../../services/inventory.service'
import CreatePurchaseOrderModal from './CreatePurchaseOrderModal'
import PurchaseOrderDetailDrawer from './PurchaseOrderDetailDrawer'

export default function PurchaseOrdersTab() {
  const [selectedPO, setSelectedPO] = useState<any>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => inventoryService.getPurchaseOrders({ page: 1, limit: 50 }),
  })

  const approveMutation = useMutation({
    mutationFn: (poId: string) => inventoryService.approvePurchaseOrder(poId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
  })

  const handleViewPO = (po: any) => {
    setSelectedPO(po)
    setIsDetailDrawerOpen(true)
  }

  const handleApprove = async (po: any) => {
    if (window.confirm(`Approve purchase order ${po.number}?`)) {
      try {
        await approveMutation.mutateAsync(po.id)
      } catch (error: any) {
        alert(error.response?.data?.error || 'Failed to approve purchase order')
      }
    }
  }

  const orders = data?.data?.orders || []

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Draft: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
      Approved: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
      Sent: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
      PartiallyReceived: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
      Received: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      Closed: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
      Cancelled: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    }
    return colors[status] || colors.Draft
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Purchase Orders</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Purchase Order
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">Error loading purchase orders</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">No purchase orders found</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create First Purchase Order
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Ordered Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {orders.map((po: any) => (
                <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {po.number}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {po.supplier?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(po.status)}`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(po.orderedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleViewPO(po)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {po.status === 'Draft' && (
                        <button
                          onClick={() => handleApprove(po)}
                          className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                          title="Approve"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isCreateModalOpen && (
        <CreatePurchaseOrderModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
          }}
        />
      )}

      {isDetailDrawerOpen && selectedPO && (
        <PurchaseOrderDetailDrawer
          purchaseOrder={selectedPO}
          isOpen={isDetailDrawerOpen}
          onClose={() => {
            setIsDetailDrawerOpen(false)
            setSelectedPO(null)
          }}
        />
      )}
    </div>
  )
}
