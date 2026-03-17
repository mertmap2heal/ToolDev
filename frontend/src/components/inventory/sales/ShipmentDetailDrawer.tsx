import { X, Truck, CheckCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryService } from '../../../services/inventory.service'

interface ShipmentDetailDrawerProps {
  shipment: any
  isOpen: boolean
  onClose: () => void
}

export default function ShipmentDetailDrawer({ shipment, isOpen, onClose }: ShipmentDetailDrawerProps) {
  const queryClient = useQueryClient()

  const { data: shipmentData, isLoading } = useQuery({
    queryKey: ['shipment', shipment.id],
    queryFn: () => inventoryService.getShipment(shipment.id),
    enabled: isOpen,
  })

  const postMutation = useMutation({
    mutationFn: (shipmentId: string) =>
      inventoryService.postShipment(shipmentId, `shipment-${shipmentId}-${Date.now()}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipment', shipment.id] })
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
    },
  })

  const handlePost = async () => {
    if (window.confirm(`Post shipment ${fullShipment.number} to inventory? This will decrease stock.`)) {
      try {
        await postMutation.mutateAsync(fullShipment.id)
        alert('Shipment posted successfully! Stock has been updated.')
      } catch (error: any) {
        alert(error.response?.data?.error || 'Failed to post shipment')
      }
    }
  }

  if (!isOpen) return null

  const fullShipment = shipmentData?.data || shipment

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 w-full max-w-4xl h-full shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Truck className="w-6 h-6" />
                {fullShipment.number}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                SO: {fullShipment.salesOrder?.number || '-'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {fullShipment.status === 'Draft' && (
                <button
                  onClick={handlePost}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Post to Inventory
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
                  Shipment Details
                </h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Number</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{fullShipment.number}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                    <dd className="mt-1">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          fullShipment.status === 'Posted'
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {fullShipment.status}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Sales Order</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {fullShipment.salesOrder?.number || '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Shipped Date</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {fullShipment.shippedAt
                        ? new Date(fullShipment.shippedAt).toLocaleDateString()
                        : '-'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Shipment Lines</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Item
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          From Location
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Qty Shipped
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Lot/Serial
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {fullShipment.lines?.map((line: any) => (
                        <tr key={line.id}>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {line.item?.sku} - {line.item?.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {line.fromLocation?.code}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            {Number(line.qtyShipped).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {line.lot?.lotCode || line.serial?.serialCode || '-'}
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
    </div>
  )
}
