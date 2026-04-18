import { useState } from 'react'
import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Eye, CheckCircle, Package } from 'lucide-react'
import { inventoryService } from '../../../services/inventory.service'
import CreateSalesOrderModal from './CreateSalesOrderModal'
import SalesOrderDetailDrawer from './SalesOrderDetailDrawer'
import type { SalesOrderListRow } from './inventorySalesTypes'

export default function SalesOrdersTab() {
  const [selectedSO, setSelectedSO] = useState<SalesOrderListRow | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: () => inventoryService.getSalesOrders({ page: 1, limit: 50 }),
  })

  const approveMutation = useMutation({
    mutationFn: (soId: string) => inventoryService.approveSalesOrder(soId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
    },
  })

  const allocateMutation = useMutation({
    mutationFn: (soId: string) => inventoryService.allocateSalesOrder(soId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
    },
  })

  const handleViewSO = (so: SalesOrderListRow) => {
    setSelectedSO(so)
    setIsDetailDrawerOpen(true)
  }

  const handleApprove = async (so: SalesOrderListRow) => {
    if (window.confirm(`Approve sales order ${so.number}?`)) {
      try {
        await approveMutation.mutateAsync(so.id)
      } catch (err: unknown) {
        const msg = axios.isAxiosError(err)
          ? (err.response?.data as { error?: string } | undefined)?.error ?? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to approve sales order'
        alert(msg)
      }
    }
  }

  const handleAllocate = async (so: SalesOrderListRow) => {
    if (window.confirm(`Allocate reservations for sales order ${so.number}?`)) {
      try {
        await allocateMutation.mutateAsync(so.id)
        alert('Reservations allocated successfully!')
      } catch (err: unknown) {
        const msg = axios.isAxiosError(err)
          ? (err.response?.data as { error?: string } | undefined)?.error ?? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to allocate sales order'
        alert(msg)
      }
    }
  }

  const orders = (data?.data?.orders ?? []) as SalesOrderListRow[]

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Draft: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
      Approved: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
      Allocated: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      PartiallyShipped: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
      Shipped: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      Closed: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
      Cancelled: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    }
    return colors[status] || colors.Draft
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sales Orders</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Sales Order
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">Error loading sales orders</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">No sales orders found</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create First Sales Order
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
                  Customer
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
              {orders.map((so) => (
                <tr key={so.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {so.number}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {so.customer?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(so.status)}`}>
                      {so.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(so.orderedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleViewSO(so)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {so.status === 'Draft' && (
                        <button
                          onClick={() => handleApprove(so)}
                          className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                          title="Approve"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {so.status === 'Approved' && (
                        <button
                          onClick={() => handleAllocate(so)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                          title="Allocate"
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
        <CreateSalesOrderModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
          }}
        />
      )}

      {isDetailDrawerOpen && selectedSO && (
        <SalesOrderDetailDrawer
          salesOrder={selectedSO}
          isOpen={isDetailDrawerOpen}
          onClose={() => {
            setIsDetailDrawerOpen(false)
            setSelectedSO(null)
          }}
        />
      )}
    </div>
  )
}
