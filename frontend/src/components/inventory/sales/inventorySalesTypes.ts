import type { Item } from '../../../services/inventory.service'

export type InventoryCustomerRow = {
  id: string
  code: string
  name: string
  contactName?: string
  email?: string
}

export type SalesOrderLineRow = {
  id: string
  qtyOrdered?: number | string
  qtyAllocated?: number | string
  qtyShipped?: number | string
  unitPrice?: number | string
  item?: Pick<Item, 'sku' | 'name'>
}

/** List row and minimum payload for the detail drawer before GET returns full detail. */
export type SalesOrderListRow = {
  id: string
  number: string
  status: string
  orderedAt: string
  customer?: { name?: string }
}

export type SalesOrderDetail = SalesOrderListRow & {
  lines?: SalesOrderLineRow[]
}

export type ShipmentListRow = {
  id: string
  number: string
  status: string
  shippedAt?: string | null
  salesOrder?: { number?: string }
}

export type ShipmentLineRow = {
  id: string
  qtyShipped?: number | string
  item?: Pick<Item, 'sku' | 'name'>
  fromLocation?: { code?: string }
  lot?: { lotCode?: string }
  serial?: { serialCode?: string }
}

export type ShipmentDetail = ShipmentListRow & {
  lines?: ShipmentLineRow[]
}
