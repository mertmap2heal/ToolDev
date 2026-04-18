import { useState } from 'react'
import { X, Warehouse, Plus } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { inventoryService } from '../../services/inventory.service'
import CreateLocationModal from './CreateLocationModal'

interface WarehouseSummary {
  id: string
  name: string
  code: string
  isActive?: boolean
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  negativeStockPolicy?: string
}

interface LocationTreeNode {
  id: string
  code: string
  name?: string
  locationType?: string
  children?: LocationTreeNode[]
}

interface WarehouseDetailDrawerProps {
  warehouse: WarehouseSummary
  isOpen: boolean
  onClose: () => void
}

export default function WarehouseDetailDrawer({ warehouse, isOpen, onClose }: WarehouseDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'locations'>('overview')
  const [isCreateLocationModalOpen, setIsCreateLocationModalOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: warehouseData, isLoading } = useQuery({
    queryKey: ['warehouse', warehouse.id],
    queryFn: () => inventoryService.getWarehouse(warehouse.id),
    enabled: isOpen,
  })

  const { data: locationTreeData } = useQuery({
    queryKey: ['location-tree', warehouse.id],
    queryFn: () => inventoryService.getLocationTree(warehouse.id),
    enabled: isOpen && activeTab === 'locations',
  })

  const locationTree = (locationTreeData?.data || []) as LocationTreeNode[]

  const renderLocationTree = (locations: LocationTreeNode[]) => {
    return locations.map((location) => (
      <div key={location.id} className="ml-4">
        <div className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
          <div className="flex-1">
            <div className="font-medium text-gray-900 dark:text-white">{location.code}</div>
            {location.name && (
              <div className="text-sm text-gray-500 dark:text-gray-400">{location.name}</div>
            )}
            {location.locationType && (
              <span className="text-xs text-gray-400">{location.locationType}</span>
            )}
          </div>
        </div>
        {location.children && location.children.length > 0 && (
          <div className="ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
            {renderLocationTree(location.children)}
          </div>
        )}
      </div>
    ))
  }

  if (!isOpen) return null

  const fullWarehouse = warehouseData?.data || warehouse

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-full max-w-4xl h-[calc(100%-1rem)] my-2 mr-2 rounded-2xl shadow-sm overflow-y-auto">
        <div className="sticky top-0 bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-700/50 p-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Warehouse className="w-6 h-6" />
                {fullWarehouse.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Code: {fullWarehouse.code}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex gap-2 mt-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('locations')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'locations'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Locations
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Warehouse Details
                </h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Code</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{fullWarehouse.code}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                    <dd className="mt-1">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          fullWarehouse.isActive
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {fullWarehouse.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </dd>
                  </div>
                  {fullWarehouse.address && (
                    <div className="col-span-2">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {fullWarehouse.address}
                        {fullWarehouse.city && `, ${fullWarehouse.city}`}
                        {fullWarehouse.state && `, ${fullWarehouse.state}`}
                        {fullWarehouse.zipCode && ` ${fullWarehouse.zipCode}`}
                        {fullWarehouse.country && `, ${fullWarehouse.country}`}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Negative Stock Policy
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {fullWarehouse.negativeStockPolicy === 'STRICT' ? 'Strict' : 'Allow with Warning'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {activeTab === 'locations' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Locations</h3>
                <button
                  onClick={() => setIsCreateLocationModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Location
                </button>
              </div>

              {isLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : locationTree.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No locations found. Create your first location.
                </div>
              ) : (
                <div className="space-y-2">{renderLocationTree(locationTree)}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {isCreateLocationModalOpen && (
        <CreateLocationModal
          isOpen={isCreateLocationModalOpen}
          onClose={() => setIsCreateLocationModalOpen(false)}
          warehouseId={warehouse.id}
          onSuccess={() => {
            setIsCreateLocationModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['location-tree', warehouse.id] })
            queryClient.invalidateQueries({ queryKey: ['warehouse', warehouse.id] })
          }}
        />
      )}
    </div>
  )
}
