import { prisma } from '../../lib/prisma'


/**
 * FIFO (First In First Out) valuation service
 * Tracks cost layers and calculates COGS on shipments
 */
export class ValuationService {
  /**
   * Create cost layer on receipt
   * Called when posting a goods receipt
   */
  async createCostLayer(params: {
    itemId: string
    locationId: string
    lotId?: string | null
    qty: number
    unitCost: number
    receivedAt: Date
  }): Promise<void> {
    const { itemId, locationId, lotId, qty, unitCost, receivedAt } = params

    await prisma.inventoryCostLayer.create({
      data: {
        itemId,
        locationId,
        lotId: lotId || null,
        qty,
        unitCost,
        receivedAt,
        consumedQty: 0,
      },
    })
  }

  /**
   * Consume cost layers (FIFO) for shipment
   * Returns total COGS
   */
  async consumeLayersForShipment(params: {
    itemId: string
    locationId: string
    lotId?: string | null
    serialId?: string | null
    qty: number
  }): Promise<number> {
    const { itemId, locationId, lotId, serialId, qty } = params

    // Get layers for FIFO; Prisma cannot express consumedQty < qty in where — filter in memory
    const rawLayers = await prisma.inventoryCostLayer.findMany({
      where: {
        itemId,
        locationId,
        ...(lotId != null && lotId !== '' ? { lotId } : {}),
      },
      orderBy: {
        receivedAt: 'asc',
      },
    })
    const layers = rawLayers.filter(
      (layer) => Number(layer.consumedQty) < Number(layer.qty)
    )

    let remainingQty = qty
    let totalCost = 0

    for (const layer of layers) {
      if (remainingQty <= 0) break

      const availableQty = Number(layer.qty) - Number(layer.consumedQty)
      const consumeQty = Math.min(remainingQty, availableQty)

      if (consumeQty > 0) {
        const cost = Number(layer.unitCost) * consumeQty
        totalCost += cost

        await prisma.inventoryCostLayer.update({
          where: { id: layer.id },
          data: {
            consumedQty: {
              increment: consumeQty,
            },
          },
        })

        remainingQty -= consumeQty
      }
    }

    if (remainingQty > 0) {
      // Not enough layers - use average cost or throw error
      // For now, we'll use the most recent layer's cost
      const lastLayer = layers[layers.length - 1]
      if (lastLayer) {
        const cost = Number(lastLayer.unitCost) * remainingQty
        totalCost += cost
      } else {
        // No layers found - this shouldn't happen if inventory is correct
        throw new Error(`No cost layers found for item ${itemId} at location ${locationId}`)
      }
    }

    return totalCost
  }

  /**
   * Get current inventory valuation (FIFO)
   * Returns total value of on-hand inventory
   */
  async getInventoryValuation(params?: {
    itemId?: string
    locationId?: string
    warehouseId?: string
  }): Promise<{
    totalValue: number
    itemCount: number
    locationCount: number
    details: Array<{
      itemId: string
      itemSku: string
      locationId: string
      locationCode: string
      qtyOnHand: number
      averageCost: number
      totalValue: number
    }>
  }> {
    const where: any = {}

    if (params?.itemId) {
      where.itemId = params.itemId
    }

    if (params?.locationId) {
      where.locationId = params.locationId
    } else if (params?.warehouseId) {
      const locations = await prisma.location.findMany({
        where: { warehouseId: params.warehouseId },
        select: { id: true },
      })
      where.locationId = {
        in: locations.map((l) => l.id),
      }
    }

    // Get all balances
    const balances = await prisma.inventoryBalance.findMany({
      where,
      include: {
        item: {
          select: {
            id: true,
            sku: true,
            name: true,
          },
        },
        location: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    })

    const details: Array<{
      itemId: string
      itemSku: string
      locationId: string
      locationCode: string
      qtyOnHand: number
      averageCost: number
      totalValue: number
    }> = []

    let totalValue = 0

    for (const balance of balances) {
      if (Number(balance.qtyOnHand) <= 0) continue

      // Get cost layers for this item/location (filter available qty in memory)
      const rawLayers = await prisma.inventoryCostLayer.findMany({
        where: {
          itemId: balance.itemId,
          locationId: balance.locationId,
        },
        orderBy: {
          receivedAt: 'asc',
        },
      })
      const layers = rawLayers.filter(
        (layer) => Number(layer.consumedQty) < Number(layer.qty)
      )

      // Calculate average cost from available layers
      let totalCost = 0
      let totalQty = 0

      for (const layer of layers) {
        const availableQty = Number(layer.qty) - Number(layer.consumedQty)
        totalCost += Number(layer.unitCost) * availableQty
        totalQty += availableQty
      }

      const averageCost = totalQty > 0 ? totalCost / totalQty : 0
      const qtyOnHand = Number(balance.qtyOnHand)
      const itemValue = averageCost * qtyOnHand

      details.push({
        itemId: balance.itemId,
        itemSku: balance.item.sku,
        locationId: balance.locationId,
        locationCode: balance.location.code,
        qtyOnHand,
        averageCost,
        totalValue: itemValue,
      })

      totalValue += itemValue
    }

    return {
      totalValue,
      itemCount: new Set(details.map((d) => d.itemId)).size,
      locationCount: new Set(details.map((d) => d.locationId)).size,
      details,
    }
  }

  /**
   * Get cost layers for an item/location
   */
  async getCostLayers(params: {
    itemId: string
    locationId: string
    lotId?: string | null
  }): Promise<Array<{
    id: string
    qty: number
    consumedQty: number
    availableQty: number
    unitCost: number
    receivedAt: Date
    lotCode?: string | null
    lotId?: string | null
  }>> {
    const { itemId, locationId, lotId } = params

    const layers = await prisma.inventoryCostLayer.findMany({
      where: {
        itemId,
        locationId,
        ...(lotId != null && lotId !== '' ? { lotId } : {}),
      },
      orderBy: {
        receivedAt: 'asc',
      },
    })

    return layers.map((layer) => ({
      id: layer.id,
      qty: Number(layer.qty),
      consumedQty: Number(layer.consumedQty),
      availableQty: Number(layer.qty) - Number(layer.consumedQty),
      unitCost: Number(layer.unitCost),
      receivedAt: layer.receivedAt,
      lotId: layer.lotId ?? null,
      lotCode: null,
    }))
  }
}

export const valuationService = new ValuationService()
