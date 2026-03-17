import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { inventoryService } from '../../../services/inventory.service'

interface CreateReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  purchaseOrderId?: string
  onSuccess: () => void
}

export default function CreateReceiptModal({
  isOpen,
  onClose,
  purchaseOrderId,
  onSuccess,
}: CreateReceiptModalProps) {
  const [formData, setFormData] = useState({
    purchaseOrderId: purchaseOrderId || '',
    receivedAt: new Date().toISOString().split('T')[0],
    notes: '',
    lines: [] as Array<{
      poLineId?: string
      itemId: string
      qtyReceived: number
      locationId: string
      lotId?: string
      serialId?: string
      unitCost?: number
    }>,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: poData } = useQuery({
    queryKey: ['purchase-order', purchaseOrderId],
    queryFn: () => inventoryService.getPurchaseOrder(purchaseOrderId!),
    enabled: isOpen && !!purchaseOrderId,
  })

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => inventoryService.getWarehouses(),
    enabled: isOpen,
  })

  const warehouses = warehousesData?.data || []
  const po = poData?.data

  useEffect(() => {
    if (po && po.lines) {
      setFormData({
        ...formData,
        purchaseOrderId: po.id,
        lines: po.lines.map((line: any) => ({
          poLineId: line.id,
          itemId: line.itemId,
          qtyReceived: Math.max(0, Number(line.qtyOrdered) - Number(line.qtyReceived)),
          locationId: line.locationId,
          unitCost: line.unitPrice,
        })),
      })
    }
  }, [po])

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...formData.lines]
    newLines[index] = { ...newLines[index], [field]: value }
    setFormData({ ...formData, lines: newLines })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    if (formData.lines.length === 0) {
      setError('Please add at least one receipt line')
      setIsSubmitting(false)
      return
    }

    const validLines = formData.lines.filter(
      (line) => line.itemId && line.qtyReceived > 0 && line.locationId
    )

    if (validLines.length === 0) {
      setError('Please fill in all required fields for at least one line item')
      setIsSubmitting(false)
      return
    }

    try {
      await inventoryService.createGoodsReceipt({
        purchaseOrderId: formData.purchaseOrderId || undefined,
        receivedAt: formData.receivedAt,
        notes: formData.notes || undefined,
        lines: validLines,
      })
      onSuccess()
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create receipt'
      setError(errorMessage)
      console.error('Error creating receipt:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const allLocations: any[] = []
  warehouses.forEach((wh: any) => {
    if (wh.locations) {
      wh.locations.forEach((loc: any) => {
        allLocations.push({ ...loc, warehouseName: wh.name, warehouseCode: wh.code })
      })
    }
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create Goods Receipt</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Received Date
            </label>
            <input
              type="date"
              value={formData.receivedAt}
              onChange={(e) => setFormData({ ...formData, receivedAt: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Receipt Lines</h3>
            {formData.lines.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                <p className="text-gray-500 dark:text-gray-400">
                  {po ? 'No lines to receive' : 'No lines added'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {formData.lines.map((line, index) => {
                  const poLine = po?.lines?.find((l: any) => l.id === line.poLineId)
                  const item = poLine?.item
                  const trackingPolicy = item?.trackingPolicy

                  return (
                    <div
                      key={index}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900"
                    >
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Item</label>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {item?.sku} - {item?.name}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Qty Received
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={line.qtyReceived}
                            onChange={(e) =>
                              updateLine(index, 'qtyReceived', parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Location</label>
                          <select
                            required
                            value={line.locationId}
                            onChange={(e) => updateLine(index, 'locationId', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                          >
                            <option value="">Select</option>
                            {allLocations.map((loc) => (
                              <option key={loc.id} value={loc.id}>
                                {loc.warehouseCode} - {loc.code}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Unit Cost</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitCost || ''}
                            onChange={(e) =>
                              updateLine(index, 'unitCost', parseFloat(e.target.value) || undefined)
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                          />
                        </div>
                      </div>

                      {trackingPolicy === 'LOT' && (
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Lot Code</label>
                          <input
                            type="text"
                            required
                            value={line.lotId || ''}
                            onChange={(e) => updateLine(index, 'lotId', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                            placeholder="Enter lot code"
                          />
                        </div>
                      )}

                      {trackingPolicy === 'SERIAL' && (
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Serial Number
                          </label>
                          <input
                            type="text"
                            required
                            value={line.serialId || ''}
                            onChange={(e) => updateLine(index, 'serialId', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                            placeholder="Enter serial number"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
