import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Eye, CheckCircle, Truck } from 'lucide-react'
import { inventoryService } from '../../../services/inventory.service'
import CreateShipmentModal from './CreateShipmentModal'
import ShipmentDetailDrawer from './ShipmentDetailDrawer'

export default function ShipmentsTab() {
  const [selectedShipment, setSelectedShipment] = useState<any>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['shipments'],
    queryFn: () => inventoryService.getShipments({ page: 1, limit: 50 }),
  })

  const postMutation = useMutation({
    mutationFn: (shipmentId: string) =>
      inventoryService.postShipment(shipmentId, `shipment-${shipmentId}-${Date.now()}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
    },
  })

  const handleViewShipment = (shipment: any) => {
    setSelectedShipment(shipment)
    setIsDetailDrawerOpen(true)
  }

  const handlePost = async (shipment: any) => {
    if (window.confirm(`Post shipment ${shipment.number} to inventory? This will decrease stock.`)) {
      try {
        await postMutation.mutateAsync(shipment.id)
        alert('Shipment posted successfully! Stock has been updated.')
      } catch (error: any) {
        alert(error.response?.data?.error || 'Failed to post shipment')
      }
    }
  }

  const shipments = data?.data?.shipments || []

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Draft: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
      Picked: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
      Packed: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
      Posted: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      Cancelled: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    }
    return colors[status] || colors.Draft
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Shipments</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Shipment
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">Error loading shipments</p>
        </div>
      ) : shipments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">No shipments found</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create First Shipment
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
                  Sales Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Shipped Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {shipments.map((shipment: any) => (
                <tr key={shipment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {shipment.number}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {shipment.salesOrder?.number || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(shipment.status)}`}>
                      {shipment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {shipment.shippedAt ? new Date(shipment.shippedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleViewShipment(shipment)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {shipment.status === 'Draft' && (
                        <button
                          onClick={() => handlePost(shipment)}
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
        <CreateShipmentModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['shipments'] })
          }}
        />
      )}

      {isDetailDrawerOpen && selectedShipment && (
        <ShipmentDetailDrawer
          shipment={selectedShipment}
          isOpen={isDetailDrawerOpen}
          onClose={() => {
            setIsDetailDrawerOpen(false)
            setSelectedShipment(null)
          }}
        />
      )}
    </div>
  )
}
