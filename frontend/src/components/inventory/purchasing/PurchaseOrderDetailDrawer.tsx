import { useState } from 'react'
import { X, Package, Plus, CheckCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryService } from '../../../services/inventory.service'
import CreateReceiptModal from './CreateReceiptModal'

interface PurchaseOrderDetailDrawerProps {
  purchaseOrder: any
  isOpen: boolean
  onClose: () => void
}

export default function PurchaseOrderDetailDrawer({
  purchaseOrder,
  isOpen,
  onClose,
}: PurchaseOrderDetailDrawerProps) {
  const [isCreateReceiptModalOpen, setIsCreateReceiptModalOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: poData, isLoading } = useQuery({
    queryKey: ['purchase-order', purchaseOrder.id],
    queryFn: () => inventoryService.getPurchaseOrder(purchaseOrder.id),
    enabled: isOpen,
  })

  const approveMutation = useMutation({
    mutationFn: (poId: string) => inventoryService.approvePurchaseOrder(poId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', purchaseOrder.id] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
  })

  const handleApprove = async () => {
    if (window.confirm(`Approve purchase order ${po?.number}?`)) {
      try {
        await approveMutation.mutateAsync(po.id)
      } catch (error: any) {
        alert(error.response?.data?.error || 'Failed to approve purchase order')
      }
    }
  }

  if (!isOpen) return null

  const po = poData?.data || purchaseOrder

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Draft: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
      Approved: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
      Sent: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
      PartiallyReceived: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
      Received: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    }
    return colors[status] || colors.Draft
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-full max-w-4xl h-[calc(100%-1rem)] my-2 mr-2 rounded-2xl shadow-sm overflow-y-auto">
        <div className="sticky top-0 bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-700/50 p-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Package className="w-6 h-6" />
                {po.number}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Supplier: {po.supplier?.name || '-'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {po.status === 'Draft' && (
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </button>
              )}
              {po.status === 'Approved' && (
                <button
                  onClick={() => setIsCreateReceiptModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Receipt
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
                  Purchase Order Details
                </h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Number</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{po.number}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                    <dd className="mt-1">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(po.status)}`}>
                        {po.status}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Supplier</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {po.supplier?.name || '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Ordered Date</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {new Date(po.orderedAt).toLocaleDateString()}
                    </dd>
                  </div>
                  {po.expectedAt && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Expected Date</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {new Date(po.expectedAt).toLocaleDateString()}
                      </dd>
                    </div>
                  )}
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
                          Qty Received
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Unit Price
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {po.lines?.map((line: any) => (
                        <tr key={line.id}>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {line.item?.sku} - {line.item?.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            {line.qtyOrdered.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            {line.qtyReceived.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            ${line.unitPrice.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                            ${(line.qtyOrdered * line.unitPrice).toFixed(2)}
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

      {isCreateReceiptModalOpen && (
        <CreateReceiptModal
          isOpen={isCreateReceiptModalOpen}
          onClose={() => setIsCreateReceiptModalOpen(false)}
          purchaseOrderId={po.id}
          onSuccess={() => {
            setIsCreateReceiptModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['goods-receipts'] })
            queryClient.invalidateQueries({ queryKey: ['purchase-order', po.id] })
          }}
        />
      )}
    </div>
  )
}
