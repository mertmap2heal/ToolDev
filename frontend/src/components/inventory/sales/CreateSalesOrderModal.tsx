import { useState, useRef } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { inventoryService } from '../../../services/inventory.service'
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges'

interface CreateSalesOrderModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreateSalesOrderModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateSalesOrderModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, isOpen, () => onDiscardRef.current?.())
  const [formData, setFormDataBase] = useState({
    customerId: '',
    orderedAt: new Date().toISOString().split('T')[0],
    requiredAt: '',
    notes: '',
    lines: [] as Array<{
      itemId: string
      qtyOrdered: number
      unitPrice: number
      uomId: string
    }>,
  })
  const setFormData = (v: typeof formData | ((prev: typeof formData) => typeof formData)) => { setFormDataBase(v as any); markDirty() }
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  onDiscardRef.current = () => {
    setFormDataBase({
      customerId: '',
      orderedAt: new Date().toISOString().split('T')[0],
      requiredAt: '',
      notes: '',
      lines: [],
    })
    setError(null)
  }

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => inventoryService.getCustomers(),
    enabled: isOpen,
  })

  const { data: itemsData } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => inventoryService.getItems({ page: 1, limit: 100 }),
    enabled: isOpen,
  })

  const { data: uomsData } = useQuery({
    queryKey: ['uoms'],
    queryFn: () => inventoryService.getUoms(),
    enabled: isOpen,
  })

  const customers = customersData?.data || []
  const items = itemsData?.data?.items || []
  const uoms = uomsData?.data || []

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [
        ...formData.lines,
        {
          itemId: '',
          qtyOrdered: 0,
          unitPrice: 0,
          uomId: '',
        },
      ],
    })
  }

  const removeLine = (index: number) => {
    setFormData({
      ...formData,
      lines: formData.lines.filter((_, i) => i !== index),
    })
  }

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...formData.lines]
    newLines[index] = { ...newLines[index], [field]: value }
    setFormData({ ...formData, lines: newLines })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    if (!formData.customerId || formData.lines.length === 0) {
      setError('Please select a customer and add at least one line item')
      setIsSubmitting(false)
      return
    }

    const validLines = formData.lines.filter(
      (line) => line.itemId && line.qtyOrdered > 0 && line.unitPrice > 0 && line.uomId
    )

    if (validLines.length === 0) {
      setError('Please fill in all required fields for at least one line item')
      setIsSubmitting(false)
      return
    }

    try {
      await inventoryService.createSalesOrder({
        customerId: formData.customerId,
        orderedAt: formData.orderedAt,
        requiredAt: formData.requiredAt || undefined,
        notes: formData.notes || undefined,
        lines: validLines,
      })
      resetDirty()
      onSuccess()
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create sales order'
      setError(errorMessage)
      console.error('Error creating sales order:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={(e) => { if (e.target === e.currentTarget) guardClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create Sales Order</h2>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Customer</option>
                {customers.map((customer: any) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.code} - {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ordered Date
              </label>
              <input
                type="date"
                value={formData.orderedAt}
                onChange={(e) => setFormData({ ...formData, orderedAt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Required Date
            </label>
            <input
              type="date"
              value={formData.requiredAt}
              onChange={(e) => setFormData({ ...formData, requiredAt: e.target.value })}
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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Line Items
              </label>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                <Plus className="w-4 h-4" />
                Add Line
              </button>
            </div>

            {formData.lines.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                <p className="text-gray-500 dark:text-gray-400">No line items. Click "Add Line" to add items.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {formData.lines.map((line, index) => (
                  <div
                    key={index}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900"
                  >
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Line {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Item</label>
                        <select
                          required
                          value={line.itemId}
                          onChange={(e) => updateLine(index, 'itemId', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                        >
                          <option value="">Select</option>
                          {items.map((item: any) => (
                            <option key={item.id} value={item.id}>
                              {item.sku} - {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Qty</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={line.qtyOrdered}
                          onChange={(e) => updateLine(index, 'qtyOrdered', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Unit Price</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={line.unitPrice}
                          onChange={(e) => updateLine(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">UOM</label>
                        <select
                          required
                          value={line.uomId}
                          onChange={(e) => updateLine(index, 'uomId', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                        >
                          <option value="">Select</option>
                          {uoms.map((uom: any) => (
                            <option key={uom.id} value={uom.id}>
                              {uom.code}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
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
              {isSubmitting ? 'Creating...' : 'Create Sales Order'}
            </button>
          </div>
        </form>
      </div>
      {warningDialog}
    </div>
  )
}
