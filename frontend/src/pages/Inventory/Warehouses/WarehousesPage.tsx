import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Warehouse, MapPin, Edit, Trash2, Eye } from 'lucide-react'
import InventoryNavigation from '../../../components/inventory/InventoryNavigation'
import { inventoryService } from '../../../services/inventory.service'
import CreateWarehouseModal from '../../../components/inventory/CreateWarehouseModal'
import WarehouseDetailDrawer from '../../../components/inventory/WarehouseDetailDrawer'

export default function WarehousesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => inventoryService.getWarehouses(),
  })

  const deleteMutation = useMutation({
    mutationFn: (warehouseId: string) => inventoryService.deleteWarehouse(warehouseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    },
  })

  const handleViewWarehouse = (warehouse: any) => {
    setSelectedWarehouse(warehouse)
    setIsDetailDrawerOpen(true)
  }

  const handleDeleteWarehouse = async (warehouse: any) => {
    if (window.confirm(`Are you sure you want to delete warehouse ${warehouse.name}?`)) {
      try {
        await deleteMutation.mutateAsync(warehouse.id)
      } catch (error: any) {
        alert(error.response?.data?.error || 'Failed to delete warehouse')
      }
    }
  }

  const warehouses = data?.data || []

  return (
    <div className="p-6">
      <InventoryNavigation />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Warehouse className="w-6 h-6" />
            Warehouses & Locations
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage warehouses and their location structures
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Warehouse
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading warehouses...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            Error loading warehouses: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      ) : warehouses.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <Warehouse className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">No warehouses found</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create First Warehouse
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses.map((warehouse: any) => (
            <div
              key={warehouse.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {warehouse.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Code: {warehouse.code}</p>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    warehouse.isActive
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                  }`}
                >
                  {warehouse.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {warehouse.address && (
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  {warehouse.address}
                  {warehouse.city && `, ${warehouse.city}`}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleViewWarehouse(warehouse)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                  title="View details"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteWarehouse(warehouse)}
                  className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isCreateModalOpen && (
        <CreateWarehouseModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['warehouses'] })
          }}
        />
      )}

      {isDetailDrawerOpen && selectedWarehouse && (
        <WarehouseDetailDrawer
          warehouse={selectedWarehouse}
          isOpen={isDetailDrawerOpen}
          onClose={() => {
            setIsDetailDrawerOpen(false)
            setSelectedWarehouse(null)
          }}
        />
      )}
    </div>
  )
}
