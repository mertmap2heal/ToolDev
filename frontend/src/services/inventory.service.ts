import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api/v1' : 'http://localhost:5000/api/v1')

export interface Item {
  id: string
  sku: string
  name: string
  description?: string
  trackingPolicy: 'NONE' | 'LOT' | 'SERIAL'
  uomId: string
  categoryId?: string
  projectId?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  uom?: {
    id: string
    code: string
    name: string
  }
  category?: {
    id: string
    name: string
  }
  project?: {
    id: string
    name: string
  }
}

export interface CreateItemInput {
  sku: string
  name: string
  description?: string
  trackingPolicy: 'NONE' | 'LOT' | 'SERIAL'
  uomId: string
  categoryId?: string
  projectId?: string
  isActive?: boolean
}

export interface UpdateItemInput {
  name?: string
  description?: string
  trackingPolicy?: 'NONE' | 'LOT' | 'SERIAL'
  uomId?: string
  categoryId?: string
  projectId?: string
  isActive?: boolean
}

export interface ItemStock {
  locationId: string
  locationCode: string
  locationName?: string
  warehouseId: string
  warehouseName: string
  warehouseCode: string
  qtyOnHand: number
  qtyReserved: number
  qtyAvailable: number
}

export interface ItemLedgerEntry {
  id: string
  occurredAt: string
  eventType: string
  referenceType?: string
  referenceId?: string
  qtyDelta: number
  unitCost?: number
  fromLocation?: {
    id: string
    code: string
    name?: string
  }
  toLocation?: {
    id: string
    code: string
    name?: string
  }
  lot?: {
    id: string
    lotCode: string
  }
  serial?: {
    id: string
    serialCode: string
  }
  uom?: {
    code: string
    name: string
  }
}

class InventoryService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token')
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  }

  // Items
  async getItems(filters?: {
    sku?: string
    name?: string
    categoryId?: string
    trackingPolicy?: 'NONE' | 'LOT' | 'SERIAL'
    projectId?: string
    isActive?: boolean
    page?: number
    limit?: number
  }) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
    }

    const response = await axios.get(
      `${API_BASE_URL}/inventory/items?${params.toString()}`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async getItem(itemId: string) {
    const response = await axios.get(
      `${API_BASE_URL}/inventory/items/${itemId}`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async createItem(input: CreateItemInput) {
    const response = await axios.post(
      `${API_BASE_URL}/inventory/items`,
      input,
      this.getAuthHeaders()
    )
    return response.data
  }

  async updateItem(itemId: string, input: UpdateItemInput) {
    const response = await axios.patch(
      `${API_BASE_URL}/inventory/items/${itemId}`,
      input,
      this.getAuthHeaders()
    )
    return response.data
  }

  async deleteItem(itemId: string) {
    const response = await axios.delete(
      `${API_BASE_URL}/inventory/items/${itemId}`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async getItemStock(itemId: string): Promise<{ success: boolean; data: ItemStock[] }> {
    const response = await axios.get(
      `${API_BASE_URL}/inventory/items/${itemId}/stock`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async getItemLedger(
    itemId: string,
    filters?: { fromDate?: string; toDate?: string; limit?: number }
  ): Promise<{ success: boolean; data: ItemLedgerEntry[] }> {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
    }

    const response = await axios.get(
      `${API_BASE_URL}/inventory/items/${itemId}/ledger?${params.toString()}`,
      this.getAuthHeaders()
    )
    return response.data
  }

  // Warehouses
  async getWarehouses() {
    const response = await axios.get(
      `${API_BASE_URL}/inventory/warehouses`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async getWarehouse(warehouseId: string) {
    const response = await axios.get(
      `${API_BASE_URL}/inventory/warehouses/${warehouseId}`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async createWarehouse(input: {
    name: string
    code: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
    negativeStockPolicy?: 'STRICT' | 'ALLOW_WITH_WARNING'
  }) {
    const response = await axios.post(
      `${API_BASE_URL}/inventory/warehouses`,
      input,
      this.getAuthHeaders()
    )
    return response.data
  }

  async deleteWarehouse(warehouseId: string) {
    const response = await axios.delete(
      `${API_BASE_URL}/inventory/warehouses/${warehouseId}`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async getLocationTree(warehouseId: string) {
    const response = await axios.get(
      `${API_BASE_URL}/inventory/warehouses/${warehouseId}/locations`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async createLocation(input: {
    warehouseId: string
    code: string
    name?: string
    parentLocationId?: string
    locationType?: string
    pickingPriority?: number
  }) {
    const response = await axios.post(
      `${API_BASE_URL}/inventory/warehouses/locations`,
      input,
      this.getAuthHeaders()
    )
    return response.data
  }

  // UOMs
  async getUoms() {
    const response = await axios.get(
      `${API_BASE_URL}/inventory/uoms`,
      this.getAuthHeaders()
    )
    return response.data
  }

  // Suppliers
  async getSuppliers() {
    const response = await axios.get(
      `${API_BASE_URL}/inventory/suppliers`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async getSupplier(supplierId: string) {
    const response = await axios.get(
      `${API_BASE_URL}/inventory/suppliers/${supplierId}`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async createSupplier(input: {
    code: string
    name: string
    contactName?: string
    email?: string
    phone?: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  }) {
    const response = await axios.post(
      `${API_BASE_URL}/inventory/suppliers`,
      input,
      this.getAuthHeaders()
    )
    return response.data
  }

  async deleteSupplier(supplierId: string) {
    const response = await axios.delete(
      `${API_BASE_URL}/inventory/suppliers/${supplierId}`,
      this.getAuthHeaders()
    )
    return response.data
  }

  // Purchase Orders
  async getPurchaseOrders(filters?: {
    supplierId?: string
    status?: string
    page?: number
    limit?: number
  }) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
    }

    const response = await axios.get(
      `${API_BASE_URL}/inventory/purchase-orders?${params.toString()}`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async getPurchaseOrder(poId: string) {
    const response = await axios.get(
      `${API_BASE_URL}/inventory/purchase-orders/${poId}`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async createPurchaseOrder(input: {
    supplierId: string
    orderedAt?: string
    expectedAt?: string
    notes?: string
    lines: Array<{
      itemId: string
      qtyOrdered: number
      unitPrice: number
      uomId: string
      locationId: string
    }>
  }) {
    const response = await axios.post(
      `${API_BASE_URL}/inventory/purchase-orders`,
      input,
      this.getAuthHeaders()
    )
    return response.data
  }

  async approvePurchaseOrder(poId: string) {
    const response = await axios.post(
      `${API_BASE_URL}/inventory/purchase-orders/${poId}/approve`,
      {},
      this.getAuthHeaders()
    )
    return response.data
  }

  // Goods Receipts
  async getGoodsReceipts(filters?: {
    purchaseOrderId?: string
    status?: string
    page?: number
    limit?: number
  }) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
    }

    const response = await axios.get(
      `${API_BASE_URL}/inventory/receipts?${params.toString()}`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async getGoodsReceipt(receiptId: string) {
    const response = await axios.get(
      `${API_BASE_URL}/inventory/receipts/${receiptId}`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async createGoodsReceipt(input: {
    purchaseOrderId?: string
    receivedAt?: string
    notes?: string
    lines: Array<{
      poLineId?: string
      itemId: string
      qtyReceived: number
      locationId: string
      lotId?: string
      serialId?: string
      unitCost?: number
    }>
  }) {
    const response = await axios.post(
      `${API_BASE_URL}/inventory/receipts`,
      input,
      this.getAuthHeaders()
    )
    return response.data
  }

  async postGoodsReceipt(receiptId: string, idempotencyKey?: string) {
    const response = await axios.post(
      `${API_BASE_URL}/inventory/receipts/${receiptId}/post`,
      { idempotencyKey: idempotencyKey || `receipt-${receiptId}-${Date.now()}` },
      this.getAuthHeaders()
    )
    return response.data
  }

  // Customers
  async getCustomers() {
    const response = await axios.get(
      `${API_BASE_URL}/inventory/customers`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async getCustomer(customerId: string) {
    const response = await axios.get(
      `${API_BASE_URL}/inventory/customers/${customerId}`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async createCustomer(input: {
    code: string
    name: string
    contactName?: string
    email?: string
    phone?: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  }) {
    const response = await axios.post(
      `${API_BASE_URL}/inventory/customers`,
      input,
      this.getAuthHeaders()
    )
    return response.data
  }

  async deleteCustomer(customerId: string) {
    const response = await axios.delete(
      `${API_BASE_URL}/inventory/customers/${customerId}`,
      this.getAuthHeaders()
    )
    return response.data
  }

  // Sales Orders
  async getSalesOrders(filters?: {
    customerId?: string
    status?: string
    page?: number
    limit?: number
  }) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
    }

    const response = await axios.get(
      `${API_BASE_URL}/inventory/sales-orders?${params.toString()}`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async getSalesOrder(soId: string) {
    const response = await axios.get(
      `${API_BASE_URL}/inventory/sales-orders/${soId}`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async createSalesOrder(input: {
    customerId: string
    orderedAt?: string
    requiredAt?: string
    notes?: string
    lines: Array<{
      itemId: string
      qtyOrdered: number
      unitPrice: number
      uomId: string
    }>
  }) {
    const response = await axios.post(
      `${API_BASE_URL}/inventory/sales-orders`,
      input,
      this.getAuthHeaders()
    )
    return response.data
  }

  async approveSalesOrder(soId: string) {
    const response = await axios.post(
      `${API_BASE_URL}/inventory/sales-orders/${soId}/approve`,
      {},
      this.getAuthHeaders()
    )
    return response.data
  }

  async allocateSalesOrder(soId: string) {
    const response = await axios.post(
      `${API_BASE_URL}/inventory/sales-orders/${soId}/allocate`,
      {},
      this.getAuthHeaders()
    )
    return response.data
  }

  // Shipments
  async getShipments(filters?: {
    salesOrderId?: string
    status?: string
    page?: number
    limit?: number
  }) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
    }

    const response = await axios.get(
      `${API_BASE_URL}/inventory/shipments?${params.toString()}`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async getShipment(shipmentId: string) {
    const response = await axios.get(
      `${API_BASE_URL}/inventory/shipments/${shipmentId}`,
      this.getAuthHeaders()
    )
    return response.data
  }

  async createShipment(input: {
    salesOrderId: string
    shippedAt?: string
    notes?: string
    lines: Array<{
      soLineId: string
      qtyShipped: number
      fromLocationId: string
      lotId?: string
      serialId?: string
    }>
  }) {
    const response = await axios.post(
      `${API_BASE_URL}/inventory/shipments`,
      input,
      this.getAuthHeaders()
    )
    return response.data
  }

  async postShipment(shipmentId: string, idempotencyKey?: string) {
    const response = await axios.post(
      `${API_BASE_URL}/inventory/shipments/${shipmentId}/post`,
      { idempotencyKey: idempotencyKey || `shipment-${shipmentId}-${Date.now()}` },
      this.getAuthHeaders()
    )
    return response.data
  }
}

export const inventoryService = new InventoryService()
