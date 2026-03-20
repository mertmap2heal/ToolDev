import { useState, useRef } from 'react'
import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { inventoryService } from '../../services/inventory.service'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'

interface CreateLocationModalProps {
  isOpen: boolean
  onClose: () => void
  warehouseId: string
  onSuccess: () => void
}

export default function CreateLocationModal({
  isOpen,
  onClose,
  warehouseId,
  onSuccess,
}: CreateLocationModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, isOpen, () => onDiscardRef.current?.())
  const [formData, setFormDataBase] = useState({
    code: '',
    name: '',
    parentLocationId: '',
    locationType: 'BIN',
    pickingPriority: 0,
  })
  const setFormData = (v: typeof formData | ((prev: typeof formData) => typeof formData)) => { setFormDataBase(v as any); markDirty() }
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  onDiscardRef.current = () => {
    setFormDataBase({
      code: '',
      name: '',
      parentLocationId: '',
      locationType: 'BIN',
      pickingPriority: 0,
    })
    setError(null)
  }

  const { data: locationTreeData } = useQuery({
    queryKey: ['location-tree', warehouseId],
    queryFn: () => inventoryService.getLocationTree(warehouseId),
    enabled: isOpen,
  })

  const locationTree = locationTreeData?.data || []

  const flattenLocations = (locations: any[], result: any[] = []): any[] => {
    locations.forEach((loc) => {
      result.push(loc)
      if (loc.children && loc.children.length > 0) {
        flattenLocations(loc.children, result)
      }
    })
    return result
  }

  const allLocations = flattenLocations(locationTree)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    if (!formData.code) {
      setError('Please fill in the required field: Code')
      setIsSubmitting(false)
      return
    }

    try {
      await inventoryService.createLocation({
        warehouseId,
        code: formData.code,
        name: formData.name || undefined,
        parentLocationId: formData.parentLocationId || undefined,
        locationType: formData.locationType,
        pickingPriority: formData.pickingPriority,
      })
      resetDirty()
      onSuccess()
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create location'
      setError(errorMessage)
      console.error('Error creating location:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={(e) => { if (e.target === e.currentTarget) guardClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create New Location</h2>
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
              Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="A-01-01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Location name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Parent Location
            </label>
            <select
              value={formData.parentLocationId}
              onChange={(e) => setFormData({ ...formData, parentLocationId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">None (Root level)</option>
              {allLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code} {loc.name ? `- ${loc.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location Type
            </label>
            <select
              value={formData.locationType}
              onChange={(e) => setFormData({ ...formData, locationType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="BIN">Bin</option>
              <option value="ZONE">Zone</option>
              <option value="AISLE">Aisle</option>
              <option value="RACK">Rack</option>
              <option value="SHELF">Shelf</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Picking Priority
            </label>
            <input
              type="number"
              min="0"
              value={formData.pickingPriority}
              onChange={(e) =>
                setFormData({ ...formData, pickingPriority: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
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
              {isSubmitting ? 'Creating...' : 'Create Location'}
            </button>
          </div>
        </form>
      </div>
      {warningDialog}
    </div>
  )
}
