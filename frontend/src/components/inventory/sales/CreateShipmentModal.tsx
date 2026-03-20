import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { inventoryService } from '../../../services/inventory.service'
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges'

interface CreateShipmentModalProps {
  isOpen: boolean
  onClose: () => void
  salesOrderId?: string
  onSuccess: () => void
}

export default function CreateShipmentModal({
  isOpen,
  onClose,
  salesOrderId,
  onSuccess,
}: CreateShipmentModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, isOpen, () => onDiscardRef.current?.())
  const [formData, setFormDataBase] = useState({
    salesOrderId: salesOrderId || '',
    shippedAt: new Date().toISOString().split('T')[0],
    notes: '',
    lines: [] as Array<{
      soLineId: string
      qtyShipped: number
      fromLocationId: string
      lotId?: string
      serialId?: string
    }>,
  })
  const setFormData = (v: typeof formData | ((prev: typeof formData) => typeof formData)) => { setFormDataBase(v as any); markDirty() }
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  onDiscardRef.current = () => {
    setFormDataBase({
      salesOrderId: salesOrderId || '',
      shippedAt: new Date().toISOString().split('T')[0],
      notes: '',
      lines: [],
    })
    setError(null)
  }

  const { data: soData } = useQuery({
    queryKey: ['sales-order', salesOrderId],
    queryFn: () => inventoryService.getSalesOrder(salesOrderId!),
    enabled: isOpen && !!salesOrderId,
  })

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => inventoryService.getWarehouses(),
    enabled: isOpen,
  })

  const warehouses = warehousesData?.data || []
  const so = soData?.data

  useEffect(() => {
    if (so && so.lines) {
      setFormData({
        ...formData,
        salesOrderId: so.id,
        lines: so.lines.map((line: any) => ({
          soLineId: line.id,
          qtyShipped: Math.max(0, Number(line.qtyOrdered) - Number(line.qtyShipped)),
          fromLocationId: '',
        })),
      })
    }
  }, [so])

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
      setError('Please add at least one shipment line')
      setIsSubmitting(false)
      return
    }

    const validLines = formData.lines.filter(
      (line) => line.soLineId && line.qtyShipped > 0 && line.fromLocationId
    )

    if (validLines.length === 0) {
      setError('Please fill in all required fields for at least one line item')
      setIsSubmitting(false)
      return
    }

    try {
      await inventoryService.createShipment({
        salesOrderId: formData.salesOrderId,
        shippedAt: formData.shippedAt,
        notes: formData.notes || undefined,
        lines: validLines,
      })
      resetDirty()
      onSuccess()
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create shipment'
      setError(errorMessage)
      console.error('Error creating shipment:', err)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={(e) => { if (e.target === e.currentTarget) guardClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create Shipment</h2>
          <div className="flex items-center gap-2">
            {draftBanner}
            <button
              onClick={guardClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Shipped Date
            </label>
            <input
              type="date"
              value={formData.shippedAt}
              onChange={(e) => setFormData({ ...formData, shippedAt: e.target.value })}
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
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Shipment Lines</h3>
            {formData.lines.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                <p className="text-gray-500 dark:text-gray-400">
                  {so ? 'No lines to ship' : 'No lines added'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {formData.lines.map((line, index) => {
                  const soLine = so?.lines?.find((l: any) => l.id === line.soLineId)
                  const item = soLine?.item

                  return (
                    <div
                      key={index}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900"
                    >
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Item</label>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {item?.sku} - {item?.name}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Qty Shipped
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={line.qtyShipped}
                            onChange={(e) =>
                              updateLine(index, 'qtyShipped', parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                            From Location
                          </label>
                          <select
                            required
                            value={line.fromLocationId}
                            onChange={(e) => updateLine(index, 'fromLocationId', e.target.value)}
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
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={guardClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Shipment'}
            </button>
          </div>
        </form>
      </div>
      {warningDialog}
    </div>
  )
}
