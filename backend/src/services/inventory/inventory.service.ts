import { PrismaClient, Prisma } from '@prisma/client'
import { valuationService } from './valuation.service'

const prisma = new PrismaClient()

export type TrackingPolicy = 'NONE' | 'LOT' | 'SERIAL'
export type NegativeStockPolicy = 'STRICT' | 'ALLOW_WITH_WARNING'

export interface PostReceiptParams {
  receiptId: string
  idempotencyKey: string
}

export interface PostShipmentParams {
  shipmentId: string
  idempotencyKey: string
}

export interface PostTransferParams {
  transferId: string
  idempotencyKey: string
}

export interface PostAdjustmentParams {
  adjustmentId: string
  idempotencyKey: string
}

export interface PostCycleCountParams {
  cycleCountId: string
  idempotencyKey: string
}

/**
 * Core inventory service - handles all inventory transactions
 * All operations are atomic and write to the immutable ledger first
 */
export class InventoryService {
  /**
   * Post a goods receipt to inventory
   * Increases stock, writes ledger entry, updates PO status
   */
  async postReceipt(params: PostReceiptParams): Promise<void> {
    const { receiptId, idempotencyKey } = params

    // Check idempotency
    const existingLedger = await prisma.inventoryLedger.findUnique({
      where: { idempotencyKey },
    })

    if (existingLedger) {
      return // Already posted
    }

    // Get receipt with lines
    const receipt = await prisma.goodsReceipt.findUnique({
      where: { id: receiptId },
      include: {
        lines: {
          include: {
            item: true,
            location: {
              include: {
                warehouse: true,
              },
            },
            lot: true,
            serial: true,
          },
        },
        purchaseOrder: {
          include: {
            lines: true,
          },
        },
      },
    })

    if (!receipt) {
      throw new Error(`Goods receipt ${receiptId} not found`)
    }

    if (receipt.status === 'Posted') {
      throw new Error(`Goods receipt ${receiptId} already posted`)
    }

    if (receipt.status === 'Cancelled') {
      throw new Error(`Cannot post cancelled goods receipt ${receiptId}`)
    }

    // Begin transaction
    await prisma.$transaction(async (tx) => {
      const ledgerEntries: Prisma.InventoryLedgerCreateManyInput[] = []
      const balanceUpdates: Map<string, { itemId: string; locationId: string; qtyDelta: number }> = new Map()

      // Process each receipt line
      for (const line of receipt.lines) {
        const item = line.item
        const location = line.location
        const warehouse = location.warehouse

        // Validate tracking policy
        if (item.trackingPolicy === 'LOT' && !line.lotId) {
          throw new Error(`Item ${item.sku} requires lot tracking but no lot provided`)
        }

        if (item.trackingPolicy === 'SERIAL') {
          if (!line.serialId) {
            throw new Error(`Item ${item.sku} requires serial tracking but no serial provided`)
          }
          if (Number(line.qtyReceived) !== 1) {
            throw new Error(`Serial-tracked items must have quantity of 1, got ${line.qtyReceived}`)
          }
        }

        // Get unit cost (from line or calculate average)
        const unitCost = line.unitCost || 0

        // Create FIFO cost layer if unit cost is provided
        if (unitCost > 0) {
          await valuationService.createCostLayer({
            itemId: item.id,
            locationId: location.id,
            lotId: line.lotId || null,
            qty: Number(line.qtyReceived),
            unitCost: unitCost,
            receivedAt: receipt.receivedAt,
          })
        }

        // Create ledger entry
        ledgerEntries.push({
          occurredAt: receipt.receivedAt,
          eventType: 'RECEIPT_POSTED',
          referenceType: 'GOODS_RECEIPT',
          referenceId: receiptId,
          itemId: item.id,
          toLocationId: location.id,
          qtyDelta: line.qtyReceived,
          uomId: item.uomId,
          lotId: line.lotId || null,
          serialId: line.serialId || null,
          unitCost: unitCost > 0 ? unitCost : null,
          idempotencyKey: `${idempotencyKey}-line-${line.id}`,
        })

        // Track balance update
        const balanceKey = `${item.id}-${location.id}`
        const existing = balanceUpdates.get(balanceKey)
        if (existing) {
          existing.qtyDelta += Number(line.qtyReceived)
        } else {
          balanceUpdates.set(balanceKey, {
            itemId: item.id,
            locationId: location.id,
            qtyDelta: Number(line.qtyReceived),
          })
        }
      }

      // Write all ledger entries
      await tx.inventoryLedger.createMany({
        data: ledgerEntries,
      })

      // Update balances
      for (const [key, update] of balanceUpdates.entries()) {
        await tx.inventoryBalance.upsert({
          where: {
            itemId_locationId: {
              itemId: update.itemId,
              locationId: update.locationId,
            },
          },
          update: {
            qtyOnHand: {
              increment: update.qtyDelta,
            },
            qtyAvailable: {
              increment: update.qtyDelta,
            },
          },
          create: {
            itemId: update.itemId,
            locationId: update.locationId,
            qtyOnHand: update.qtyDelta,
            qtyReserved: 0,
            qtyAvailable: update.qtyDelta,
          },
        })
      }

      // Update receipt status
      await tx.goodsReceipt.update({
        where: { id: receiptId },
        data: { status: 'Posted' },
      })

      // Update PO lines and status if applicable
      if (receipt.purchaseOrder) {
        for (const receiptLine of receipt.lines) {
          if (receiptLine.poLineId) {
            await tx.purchaseOrderLine.update({
              where: { id: receiptLine.poLineId },
              data: {
                qtyReceived: {
                  increment: receiptLine.qtyReceived,
                },
              },
            })
          }
        }

        // Check if PO is fully received
        const po = receipt.purchaseOrder
        const allLinesReceived = po.lines.every(
          (line) => Number(line.qtyReceived) >= Number(line.qtyOrdered)
        )

        if (allLinesReceived) {
          await tx.purchaseOrder.update({
            where: { id: po.id },
            data: { status: 'Received' },
          })
        } else {
          const someLinesReceived = po.lines.some(
            (line) => Number(line.qtyReceived) > 0
          )
          if (someLinesReceived) {
            await tx.purchaseOrder.update({
              where: { id: po.id },
              data: { status: 'PartiallyReceived' },
            })
          }
        }
      }

      // Write audit log
      await tx.inventoryAuditLog.create({
        data: {
          entityType: 'GOODS_RECEIPT',
          entityId: receiptId,
          action: 'POSTED',
          afterJson: JSON.stringify({ status: 'Posted', postedAt: new Date() }),
          correlationId: idempotencyKey,
        },
      })
    })
  }

  /**
   * Post a shipment to inventory
   * Decreases stock, releases reservations, updates SO status
   */
  async postShipment(params: PostShipmentParams): Promise<void> {
    const { shipmentId, idempotencyKey } = params

    // Check idempotency
    const existingLedger = await prisma.inventoryLedger.findUnique({
      where: { idempotencyKey },
    })

    if (existingLedger) {
      return // Already posted
    }

    // Get shipment with lines
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        lines: {
          include: {
            item: true,
            fromLocation: {
              include: {
                warehouse: true,
              },
            },
            lot: true,
            serial: true,
            soLine: true,
          },
        },
        salesOrder: {
          include: {
            lines: true,
          },
        },
      },
    })

    if (!shipment) {
      throw new Error(`Shipment ${shipmentId} not found`)
    }

    if (shipment.status === 'Posted') {
      throw new Error(`Shipment ${shipmentId} already posted`)
    }

    if (shipment.status === 'Cancelled') {
      throw new Error(`Cannot post cancelled shipment ${shipmentId}`)
    }

    // Begin transaction
    await prisma.$transaction(async (tx) => {
      const ledgerEntries: Prisma.InventoryLedgerCreateManyInput[] = []
      const balanceUpdates: Map<string, { itemId: string; locationId: string; qtyDelta: number }> = new Map()

      // Process each shipment line
      for (const line of shipment.lines) {
        const item = line.item
        const location = line.fromLocation
        const warehouse = location.warehouse

        // Validate tracking policy
        if (item.trackingPolicy === 'LOT' && !line.lotId) {
          throw new Error(`Item ${item.sku} requires lot tracking but no lot provided`)
        }

        if (item.trackingPolicy === 'SERIAL') {
          if (!line.serialId) {
            throw new Error(`Item ${item.sku} requires serial tracking but no serial provided`)
          }
          if (Number(line.qtyShipped) !== 1) {
            throw new Error(`Serial-tracked items must have quantity of 1, got ${line.qtyShipped}`)
          }
        }

        // Check negative stock policy
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            itemId_locationId: {
              itemId: item.id,
              locationId: location.id,
            },
          },
        })

        const currentQty = balance ? Number(balance.qtyOnHand) : 0
        const newQty = currentQty - Number(line.qtyShipped)

        if (newQty < 0) {
          if (warehouse.negativeStockPolicy === 'STRICT') {
            throw new Error(
              `Cannot ship ${line.qtyShipped} of ${item.sku} from ${location.code}: would result in negative stock (current: ${currentQty})`
            )
          } else {
            // ALLOW_WITH_WARNING - log warning but allow
            await tx.inventoryAuditLog.create({
              data: {
                entityType: 'SHIPMENT',
                entityId: shipmentId,
                action: 'NEGATIVE_STOCK_WARNING',
                beforeJson: JSON.stringify({ qtyOnHand: currentQty }),
                afterJson: JSON.stringify({ qtyOnHand: newQty }),
                correlationId: idempotencyKey,
              },
            })
          }
        }

        // Create ledger entry
        ledgerEntries.push({
          occurredAt: shipment.shippedAt || new Date(),
          eventType: 'SHIPMENT_POSTED',
          referenceType: 'SHIPMENT',
          referenceId: shipmentId,
          itemId: item.id,
          fromLocationId: location.id,
          qtyDelta: -line.qtyShipped, // Negative for outbound
          uomId: item.uomId,
          lotId: line.lotId || null,
          serialId: line.serialId || null,
          idempotencyKey: `${idempotencyKey}-line-${line.id}`,
        })

        // Track balance update
        const balanceKey = `${item.id}-${location.id}`
        const existing = balanceUpdates.get(balanceKey)
        if (existing) {
          existing.qtyDelta -= Number(line.qtyShipped)
        } else {
          balanceUpdates.set(balanceKey, {
            itemId: item.id,
            locationId: location.id,
            qtyDelta: -Number(line.qtyShipped),
          })
        }
      }

      // Write all ledger entries
      await tx.inventoryLedger.createMany({
        data: ledgerEntries,
      })

      // Update balances
      for (const [key, update] of balanceUpdates.entries()) {
        await tx.inventoryBalance.upsert({
          where: {
            itemId_locationId: {
              itemId: update.itemId,
              locationId: update.locationId,
            },
          },
          update: {
            qtyOnHand: {
              increment: update.qtyDelta,
            },
            qtyAvailable: {
              increment: update.qtyDelta,
            },
          },
          create: {
            itemId: update.itemId,
            locationId: update.locationId,
            qtyOnHand: update.qtyDelta,
            qtyReserved: 0,
            qtyAvailable: update.qtyDelta,
          },
        })
      }

      // Update SO lines and release reservations
      for (const shipmentLine of shipment.lines) {
        const soLine = shipmentLine.soLine

        // Update SO line shipped quantity
        await tx.salesOrderLine.update({
          where: { id: soLine.id },
          data: {
            qtyShipped: {
              increment: shipmentLine.qtyShipped,
            },
          },
        })

        // Release reservations for this SO line
        const reservations = await tx.reservation.findMany({
          where: {
            referenceType: 'SO_LINE',
            referenceId: soLine.id,
            status: 'active',
          },
        })

        for (const reservation of reservations) {
          const qtyToRelease = Math.min(Number(reservation.qtyReserved), Number(shipmentLine.qtyShipped))
          
          if (qtyToRelease > 0) {
            // Create ledger entry for reservation release
            await tx.inventoryLedger.create({
              data: {
                occurredAt: shipment.shippedAt || new Date(),
                eventType: 'RESERVATION_RELEASED',
                referenceType: 'RESERVATION',
                referenceId: reservation.id,
                itemId: reservation.itemId,
                fromLocationId: reservation.locationId || null,
                qtyDelta: qtyToRelease,
                uomId: shipmentLine.item.uomId,
                idempotencyKey: `${idempotencyKey}-reservation-${reservation.id}`,
              },
            })

            // Update reservation
            if (qtyToRelease >= Number(reservation.qtyReserved)) {
              await tx.reservation.update({
                where: { id: reservation.id },
                data: { status: 'fulfilled' },
              })
            } else {
              await tx.reservation.update({
                where: { id: reservation.id },
                data: {
                  qtyReserved: {
                    decrement: qtyToRelease,
                  },
                },
              })
            }

            // Update balance reserved quantity
            if (reservation.locationId) {
              await tx.inventoryBalance.update({
                where: {
                  itemId_locationId: {
                    itemId: reservation.itemId,
                    locationId: reservation.locationId,
                  },
                },
                data: {
                  qtyReserved: {
                    decrement: qtyToRelease,
                  },
                  qtyAvailable: {
                    increment: qtyToRelease,
                  },
                },
              })
            }
          }
        }
      }

      // Update SO status
      if (shipment.salesOrder) {
        const so = shipment.salesOrder
        const allLinesShipped = so.lines.every(
          (line) => Number(line.qtyShipped) >= Number(line.qtyOrdered)
        )

        if (allLinesShipped) {
          await tx.salesOrder.update({
            where: { id: so.id },
            data: { status: 'Shipped' },
          })
        } else {
          const someLinesShipped = so.lines.some(
            (line) => Number(line.qtyShipped) > 0
          )
          if (someLinesShipped) {
            await tx.salesOrder.update({
              where: { id: so.id },
              data: { status: 'PartiallyShipped' },
            })
          }
        }
      }

      // Update shipment status
      await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: 'Posted' },
      })

      // Write audit log
      await tx.inventoryAuditLog.create({
        data: {
          entityType: 'SHIPMENT',
          entityId: shipmentId,
          action: 'POSTED',
          afterJson: JSON.stringify({ status: 'Posted', postedAt: new Date() }),
          correlationId: idempotencyKey,
        },
      })
    })
  }

  /**
   * Post a transfer order
   * Moves stock from one location to another atomically
   */
  async postTransfer(params: PostTransferParams): Promise<void> {
    const { transferId, idempotencyKey } = params

    // Check idempotency
    const existingLedger = await prisma.inventoryLedger.findUnique({
      where: { idempotencyKey },
    })

    if (existingLedger) {
      return // Already posted
    }

    // Get transfer with lines
    const transfer = await prisma.transferOrder.findUnique({
      where: { id: transferId },
      include: {
        lines: {
          include: {
            item: true,
            fromLocation: {
              include: {
                warehouse: true,
              },
            },
            toLocation: {
              include: {
                warehouse: true,
              },
            },
            lot: true,
            serial: true,
          },
        },
      },
    })

    if (!transfer) {
      throw new Error(`Transfer order ${transferId} not found`)
    }

    if (transfer.status === 'Received' || transfer.status === 'InTransit') {
      // For InTransit, we might want separate ship/receive endpoints
      // For now, we'll do atomic transfer
    }

    if (transfer.status === 'Cancelled') {
      throw new Error(`Cannot post cancelled transfer ${transferId}`)
    }

    // Begin transaction
    await prisma.$transaction(async (tx) => {
      const ledgerEntries: Prisma.InventoryLedgerCreateManyInput[] = []
      const balanceUpdates: Map<string, { itemId: string; locationId: string; qtyDelta: number }> = new Map()

      // Process each transfer line
      for (const line of transfer.lines) {
        const item = line.item
        const fromLocation = line.fromLocation
        const toLocation = line.toLocation
        const fromWarehouse = fromLocation.warehouse

        // Validate tracking policy
        if (item.trackingPolicy === 'LOT' && !line.lotId) {
          throw new Error(`Item ${item.sku} requires lot tracking but no lot provided`)
        }

        if (item.trackingPolicy === 'SERIAL') {
          if (!line.serialId) {
            throw new Error(`Item ${item.sku} requires serial tracking but no serial provided`)
          }
          if (Number(line.qty) !== 1) {
            throw new Error(`Serial-tracked items must have quantity of 1, got ${line.qty}`)
          }
        }

        // Check negative stock policy for source location
        const fromBalance = await tx.inventoryBalance.findUnique({
          where: {
            itemId_locationId: {
              itemId: item.id,
              locationId: fromLocation.id,
            },
          },
        })

        const currentQty = fromBalance ? Number(fromBalance.qtyOnHand) : 0
        const newQty = currentQty - Number(line.qty)

        if (newQty < 0) {
          if (fromWarehouse.negativeStockPolicy === 'STRICT') {
            throw new Error(
              `Cannot transfer ${line.qty} of ${item.sku} from ${fromLocation.code}: would result in negative stock (current: ${currentQty})`
            )
          } else {
            // ALLOW_WITH_WARNING
            await tx.inventoryAuditLog.create({
              data: {
                entityType: 'TRANSFER_ORDER',
                entityId: transferId,
                action: 'NEGATIVE_STOCK_WARNING',
                beforeJson: JSON.stringify({ qtyOnHand: currentQty }),
                afterJson: JSON.stringify({ qtyOnHand: newQty }),
                correlationId: idempotencyKey,
              },
            })
          }
        }

        // Create ledger entry (single entry for atomic transfer)
        ledgerEntries.push({
          occurredAt: new Date(),
          eventType: 'TRANSFER_POSTED',
          referenceType: 'TRANSFER_ORDER',
          referenceId: transferId,
          itemId: item.id,
          fromLocationId: fromLocation.id,
          toLocationId: toLocation.id,
          qtyDelta: line.qty,
          uomId: item.uomId,
          lotId: line.lotId || null,
          serialId: line.serialId || null,
          idempotencyKey: `${idempotencyKey}-line-${line.id}`,
        })

        // Track balance updates (decrement from, increment to)
        const fromKey = `${item.id}-${fromLocation.id}`
        const toKey = `${item.id}-${toLocation.id}`

        const fromUpdate = balanceUpdates.get(fromKey)
        if (fromUpdate) {
          fromUpdate.qtyDelta -= Number(line.qty)
        } else {
          balanceUpdates.set(fromKey, {
            itemId: item.id,
            locationId: fromLocation.id,
            qtyDelta: -Number(line.qty),
          })
        }

        const toUpdate = balanceUpdates.get(toKey)
        if (toUpdate) {
          toUpdate.qtyDelta += Number(line.qty)
        } else {
          balanceUpdates.set(toKey, {
            itemId: item.id,
            locationId: toLocation.id,
            qtyDelta: Number(line.qty),
          })
        }

        // Update serial location if applicable
        if (line.serialId) {
          await tx.serialNumber.update({
            where: { id: line.serialId },
            data: { currentLocationId: toLocation.id },
          })
        }
      }

      // Write all ledger entries
      await tx.inventoryLedger.createMany({
        data: ledgerEntries,
      })

      // Update balances
      for (const [key, update] of balanceUpdates.entries()) {
        await tx.inventoryBalance.upsert({
          where: {
            itemId_locationId: {
              itemId: update.itemId,
              locationId: update.locationId,
            },
          },
          update: {
            qtyOnHand: {
              increment: update.qtyDelta,
            },
            qtyAvailable: {
              increment: update.qtyDelta,
            },
          },
          create: {
            itemId: update.itemId,
            locationId: update.locationId,
            qtyOnHand: update.qtyDelta,
            qtyReserved: 0,
            qtyAvailable: update.qtyDelta,
          },
        })
      }

      // Update transfer status
      await tx.transferOrder.update({
        where: { id: transferId },
        data: { status: 'Received' },
      })

      // Write audit log
      await tx.inventoryAuditLog.create({
        data: {
          entityType: 'TRANSFER_ORDER',
          entityId: transferId,
          action: 'POSTED',
          afterJson: JSON.stringify({ status: 'Received', postedAt: new Date() }),
          correlationId: idempotencyKey,
        },
      })
    })
  }

  /**
   * Post a stock adjustment
   * Manual stock changes (increases or decreases)
   */
  async postAdjustment(params: PostAdjustmentParams): Promise<void> {
    const { adjustmentId, idempotencyKey } = params

    // Check idempotency
    const existingLedger = await prisma.inventoryLedger.findUnique({
      where: { idempotencyKey },
    })

    if (existingLedger) {
      return // Already posted
    }

    // Get adjustment with lines
    const adjustment = await prisma.stockAdjustment.findUnique({
      where: { id: adjustmentId },
      include: {
        lines: {
          include: {
            item: true,
            location: {
              include: {
                warehouse: true,
              },
            },
            lot: true,
            serial: true,
          },
        },
      },
    })

    if (!adjustment) {
      throw new Error(`Stock adjustment ${adjustmentId} not found`)
    }

    if (adjustment.status === 'Posted') {
      throw new Error(`Stock adjustment ${adjustmentId} already posted`)
    }

    if (adjustment.status === 'Cancelled') {
      throw new Error(`Cannot post cancelled adjustment ${adjustmentId}`)
    }

    if (adjustment.status !== 'Approved') {
      throw new Error(`Stock adjustment ${adjustmentId} must be approved before posting`)
    }

    // Begin transaction
    await prisma.$transaction(async (tx) => {
      const ledgerEntries: Prisma.InventoryLedgerCreateManyInput[] = []
      const balanceUpdates: Map<string, { itemId: string; locationId: string; qtyDelta: number }> = new Map()

      // Process each adjustment line
      for (const line of adjustment.lines) {
        const item = line.item
        const location = line.location
        const warehouse = location.warehouse

        // Validate tracking policy
        if (item.trackingPolicy === 'LOT' && !line.lotId) {
          throw new Error(`Item ${item.sku} requires lot tracking but no lot provided`)
        }

        if (item.trackingPolicy === 'SERIAL') {
          if (!line.serialId) {
            throw new Error(`Item ${item.sku} requires serial tracking but no serial provided`)
          }
          if (Number(line.qtyDelta) !== 1 && Number(line.qtyDelta) !== -1) {
            throw new Error(`Serial-tracked items must have quantity delta of ±1, got ${line.qtyDelta}`)
          }
        }

        // Check negative stock policy for decreases
        if (Number(line.qtyDelta) < 0) {
          const balance = await tx.inventoryBalance.findUnique({
            where: {
              itemId_locationId: {
                itemId: item.id,
                locationId: location.id,
              },
            },
          })

          const currentQty = balance ? Number(balance.qtyOnHand) : 0
          const newQty = currentQty + Number(line.qtyDelta) // qtyDelta is already negative

          if (newQty < 0) {
            if (warehouse.negativeStockPolicy === 'STRICT') {
              throw new Error(
                `Cannot adjust ${line.qtyDelta} of ${item.sku} at ${location.code}: would result in negative stock (current: ${currentQty})`
              )
            } else {
              // ALLOW_WITH_WARNING
              await tx.inventoryAuditLog.create({
                data: {
                  entityType: 'STOCK_ADJUSTMENT',
                  entityId: adjustmentId,
                  action: 'NEGATIVE_STOCK_WARNING',
                  beforeJson: JSON.stringify({ qtyOnHand: currentQty }),
                  afterJson: JSON.stringify({ qtyOnHand: newQty }),
                  correlationId: idempotencyKey,
                },
              })
            }
          }
        }

        // Create ledger entry
        ledgerEntries.push({
          occurredAt: new Date(),
          eventType: 'ADJUSTMENT_POSTED',
          referenceType: 'STOCK_ADJUSTMENT',
          referenceId: adjustmentId,
          itemId: item.id,
          toLocationId: location.id,
          qtyDelta: line.qtyDelta,
          uomId: item.uomId,
          lotId: line.lotId || null,
          serialId: line.serialId || null,
          unitCost: line.unitCost || null,
          metadataJson: JSON.stringify({ reasonCode: adjustment.reasonCode }),
          idempotencyKey: `${idempotencyKey}-line-${line.id}`,
        })

        // Track balance update
        const balanceKey = `${item.id}-${location.id}`
        const existing = balanceUpdates.get(balanceKey)
        if (existing) {
          existing.qtyDelta += Number(line.qtyDelta)
        } else {
          balanceUpdates.set(balanceKey, {
            itemId: item.id,
            locationId: location.id,
            qtyDelta: Number(line.qtyDelta),
          })
        }
      }

      // Write all ledger entries
      await tx.inventoryLedger.createMany({
        data: ledgerEntries,
      })

      // Update balances
      for (const [key, update] of balanceUpdates.entries()) {
        await tx.inventoryBalance.upsert({
          where: {
            itemId_locationId: {
              itemId: update.itemId,
              locationId: update.locationId,
            },
          },
          update: {
            qtyOnHand: {
              increment: update.qtyDelta,
            },
            qtyAvailable: {
              increment: update.qtyDelta,
            },
          },
          create: {
            itemId: update.itemId,
            locationId: update.locationId,
            qtyOnHand: update.qtyDelta,
            qtyReserved: 0,
            qtyAvailable: update.qtyDelta,
          },
        })
      }

      // Update adjustment status
      await tx.stockAdjustment.update({
        where: { id: adjustmentId },
        data: { status: 'Posted' },
      })

      // Write audit log
      await tx.inventoryAuditLog.create({
        data: {
          entityType: 'STOCK_ADJUSTMENT',
          entityId: adjustmentId,
          action: 'POSTED',
          afterJson: JSON.stringify({ status: 'Posted', postedAt: new Date() }),
          correlationId: idempotencyKey,
        },
      })
    })
  }

  /**
   * Post a cycle count
   * Creates adjustments for discrepancies and posts them
   */
  async postCycleCount(params: PostCycleCountParams): Promise<void> {
    const { cycleCountId, idempotencyKey } = params

    // Check idempotency
    const existingLedger = await prisma.inventoryLedger.findUnique({
      where: { idempotencyKey },
    })

    if (existingLedger) {
      return // Already posted
    }

    // Get cycle count with lines
    const cycleCount = await prisma.cycleCount.findUnique({
      where: { id: cycleCountId },
      include: {
        lines: {
          include: {
            item: true,
            location: {
              include: {
                warehouse: true,
              },
            },
            lot: true,
            serial: true,
          },
        },
      },
    })

    if (!cycleCount) {
      throw new Error(`Cycle count ${cycleCountId} not found`)
    }

    if (cycleCount.status === 'Posted') {
      throw new Error(`Cycle count ${cycleCountId} already posted`)
    }

    if (cycleCount.status === 'Cancelled') {
      throw new Error(`Cannot post cancelled cycle count ${cycleCountId}`)
    }

    if (cycleCount.status !== 'Approved') {
      throw new Error(`Cycle count ${cycleCountId} must be approved before posting`)
    }

    // Filter lines with variances
    const varianceLines = cycleCount.lines.filter(
      (line) => Number(line.varianceQty) !== 0
    )

    if (varianceLines.length === 0) {
      // No variances, just mark as posted
      await prisma.cycleCount.update({
        where: { id: cycleCountId },
        data: { status: 'Posted' },
      })
      return
    }

    // Create adjustment for variances
    const adjustment = await prisma.stockAdjustment.create({
      data: {
        number: `ADJ-${Date.now()}`,
        status: 'Approved', // Auto-approved since cycle count was approved
        reasonCode: 'CYCLE_COUNT_VARIANCE',
        notes: `Auto-generated from cycle count ${cycleCount.number}`,
        idempotencyKey: `${idempotencyKey}-adjustment`,
        lines: {
          create: varianceLines.map((line) => ({
            itemId: line.itemId,
            locationId: line.locationId,
            qtyDelta: line.varianceQty, // Positive or negative
            lotId: line.lotId || null,
            serialId: line.serialId || null,
          })),
        },
      },
    })

    // Post the adjustment
    await this.postAdjustment({
      adjustmentId: adjustment.id,
      idempotencyKey: `${idempotencyKey}-adjustment-post`,
    })

    // Update cycle count status
    await prisma.cycleCount.update({
      where: { id: cycleCountId },
      data: { status: 'Posted' },
    })
  }
}

export const inventoryService = new InventoryService()
