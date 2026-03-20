import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { inventoryService, CreateItemInput } from '../../services/inventory.service'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'

interface CreateItemModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreateItemModal({ isOpen, onClose, onSuccess }: CreateItemModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, isOpen, () => onDiscardRef.current?.())
  const [formData, setFormDataBase] = useState<CreateItemInput>({
    sku: '',
    name: '',
    description: '',
    trackingPolicy: 'NONE',
    uomId: '',
    categoryId: undefined,
    projectId: undefined,
    isActive: true,
  })
  const setFormData = (v: CreateItemInput | ((prev: CreateItemInput) => CreateItemInput)) => { setFormDataBase(v as any); markDirty() }
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  onDiscardRef.current = () => {
    setFormDataBase({
      sku: '',
      name: '',
      description: '',
      trackingPolicy: 'NONE',
      uomId: '',
      categoryId: undefined,
      projectId: undefined,
      isActive: true,
    })
    setError(null)
  }

  const { data: uomsData, isLoading: uomsLoading, error: uomsError } = useQuery({
    queryKey: ['uoms'],
    queryFn: () => inventoryService.getUoms(),
    enabled: isOpen,
  })

  const uoms = uomsData?.data || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    // Validate required fields
    if (!formData.sku || !formData.name || !formData.uomId) {
      setError('Please fill in all required fields: SKU, Name, and Unit of Measure')
      setIsSubmitting(false)
      return
    }

    try {
      await inventoryService.createItem(formData)
      resetDirty()
      onSuccess()
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create item'
      setError(errorMessage)
      console.error('Error creating item:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={(e) => { if (e.target === e.currentTarget) guardClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create New Item</h2>
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
              SKU <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="SKU-001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Item Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Item description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tracking Policy <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.trackingPolicy}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  trackingPolicy: e.target.value as 'NONE' | 'LOT' | 'SERIAL',
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="NONE">None</option>
              <option value="LOT">Lot</option>
              <option value="SERIAL">Serial</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Unit of Measure <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.uomId}
              onChange={(e) => setFormData({ ...formData, uomId: e.target.value })}
              disabled={uomsLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {uomsLoading ? 'Loading UOMs...' : uomsError ? 'Error loading UOMs' : 'Select UOM'}
              </option>
              {uoms.map((uom: any) => (
                <option key={uom.id} value={uom.id}>
                  {uom.code} - {uom.name}
                </option>
              ))}
            </select>
            {uomsError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                Failed to load units of measure. Please refresh the page.
              </p>
            )}
            {!uomsLoading && uoms.length === 0 && !uomsError && (
              <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400">
                No units of measure found. Please create one first.
              </p>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Active
            </label>
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
              {isSubmitting ? 'Creating...' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
      {warningDialog}
    </div>
  )
}
