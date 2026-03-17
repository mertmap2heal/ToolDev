import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Eye, CheckCircle, Receipt } from 'lucide-react'
import { inventoryService } from '../../../services/inventory.service'
import CreateReceiptModal from './CreateReceiptModal'
import ReceiptDetailDrawer from './ReceiptDetailDrawer'

export default function ReceiptsTab() {
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['goods-receipts'],
    queryFn: () => inventoryService.getGoodsReceipts({ page: 1, limit: 50 }),
  })

  const postMutation = useMutation({
    mutationFn: (receiptId: string) =>
      inventoryService.postGoodsReceipt(receiptId, `receipt-${receiptId}-${Date.now()}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
    },
  })

  const handleViewReceipt = (receipt: any) => {
    setSelectedReceipt(receipt)
    setIsDetailDrawerOpen(true)
  }

  const handlePost = async (receipt: any) => {
    if (window.confirm(`Post goods receipt ${receipt.number} to inventory? This will increase stock.`)) {
      try {
        await postMutation.mutateAsync(receipt.id)
        alert('Receipt posted successfully! Stock has been updated.')
      } catch (error: any) {
        alert(error.response?.data?.error || 'Failed to post receipt')
      }
    }
  }

  const receipts = data?.data?.receipts || []

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Draft: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
      Posted: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      Cancelled: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    }
    return colors[status] || colors.Draft
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Goods Receipts</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Receipt
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">Error loading receipts</p>
        </div>
      ) : receipts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">No receipts found</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create First Receipt
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
                  Purchase Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Received Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {receipts.map((receipt: any) => (
                <tr key={receipt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {receipt.number}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {receipt.purchaseOrder?.number || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(receipt.status)}`}>
                      {receipt.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(receipt.receivedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleViewReceipt(receipt)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {receipt.status === 'Draft' && (
                        <button
                          onClick={() => handlePost(receipt)}
                          className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                          title="Post to inventory"
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
        <CreateReceiptModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['goods-receipts'] })
          }}
        />
      )}

      {isDetailDrawerOpen && selectedReceipt && (
        <ReceiptDetailDrawer
          receipt={selectedReceipt}
          isOpen={isDetailDrawerOpen}
          onClose={() => {
            setIsDetailDrawerOpen(false)
            setSelectedReceipt(null)
          }}
        />
      )}
    </div>
  )
}
