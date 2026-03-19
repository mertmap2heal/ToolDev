import { prisma } from '../lib/prisma'


export type TrackingPolicy = 'NONE' | 'LOT' | 'SERIAL'

/**
 * Validate tracking policy requirements
 */
export async function validateTrackingPolicy(
  itemId: string,
  trackingPolicy: TrackingPolicy,
  lotId?: string | null,
  serialId?: string | null,
  qty?: number
): Promise<void> {
  if (trackingPolicy === 'LOT' && !lotId) {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: { sku: true },
    })
    throw new Error(`Item ${item?.sku || itemId} requires lot tracking but no lot provided`)
  }

  if (trackingPolicy === 'SERIAL') {
    if (!serialId) {
      const item = await prisma.item.findUnique({
        where: { id: itemId },
        select: { sku: true },
      })
      throw new Error(`Item ${item?.sku || itemId} requires serial tracking but no serial provided`)
    }
    if (qty !== undefined && qty !== 1) {
      const item = await prisma.item.findUnique({
        where: { id: itemId },
        select: { sku: true },
      })
      throw new Error(`Serial-tracked items must have quantity of 1, got ${qty} for item ${item?.sku || itemId}`)
    }
  }
}

/**
 * Validate negative stock policy
 */
export async function validateNegativeStock(
  itemId: string,
  locationId: string,
  qtyDelta: number
): Promise<{ allowed: boolean; warning: boolean }> {
  if (qtyDelta >= 0) {
    return { allowed: true, warning: false }
  }

  const location = await prisma.location.findUnique({
    where: { id: locationId },
    include: {
      warehouse: {
        select: {
          negativeStockPolicy: true,
        },
      },
    },
  })

  if (!location) {
    throw new Error(`Location ${locationId} not found`)
  }

  const balance = await prisma.inventoryBalance.findUnique({
    where: {
      itemId_locationId: {
        itemId,
        locationId,
      },
    },
  })

  const currentQty = balance ? Number(balance.qtyOnHand) : 0
  const newQty = currentQty + qtyDelta // qtyDelta is negative

  if (newQty < 0) {
    if (location.warehouse.negativeStockPolicy === 'STRICT') {
      return { allowed: false, warning: false }
    } else {
      return { allowed: true, warning: true }
    }
  }

  return { allowed: true, warning: false }
}
