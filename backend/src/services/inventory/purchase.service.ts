import { prisma } from '../../lib/prisma'


export interface CreatePurchaseOrderInput {
  supplierId: string
  orderedAt?: Date
  expectedAt?: Date
  notes?: string
  lines: Array<{
    itemId: string
    qtyOrdered: number
    unitPrice: number
    uomId: string
    locationId: string
    trackingRequirements?: string
  }>
}

export interface CreateGoodsReceiptInput {
  purchaseOrderId?: string
  receivedAt?: Date
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
}

export class PurchaseService {
  async createPurchaseOrder(input: CreatePurchaseOrderInput) {
    // Generate PO number
    const poNumber = `PO-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`

    return await prisma.purchaseOrder.create({
      data: {
        number: poNumber,
        supplierId: input.supplierId,
        orderedAt: input.orderedAt || new Date(),
        expectedAt: input.expectedAt,
        notes: input.notes,
        status: 'Draft',
        lines: {
          create: input.lines.map((line) => ({
            itemId: line.itemId,
            qtyOrdered: line.qtyOrdered,
            unitPrice: line.unitPrice,
            uomId: line.uomId,
            locationId: line.locationId,
            trackingRequirements: line.trackingRequirements,
          })),
        },
      },
      include: {
        supplier: true,
        lines: {
          include: {
            item: {
              include: {
                uom: true,
              },
            },
            location: {
              include: {
                warehouse: true,
              },
            },
          },
        },
      },
    })
  }

  async getPurchaseOrders(filters?: {
    supplierId?: string
    status?: string
    page?: number
    limit?: number
  }) {
    const { supplierId, status, page = 1, limit = 50 } = filters || {}

    const where: any = {}
    if (supplierId) where.supplierId = supplierId
    if (status) where.status = status

    const skip = (page - 1) * limit

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          lines: {
            include: {
              item: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ])

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getPurchaseOrder(poId: string) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        supplier: true,
        lines: {
          include: {
            item: {
              include: {
                uom: true,
              },
            },
            location: {
              include: {
                warehouse: true,
              },
            },
          },
        },
        receipts: {
          include: {
            lines: true,
          },
        },
      },
    })

    if (!po) {
      throw new Error(`Purchase order ${poId} not found`)
    }

    return po
  }

  async approvePurchaseOrder(poId: string) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
    })

    if (!po) {
      throw new Error(`Purchase order ${poId} not found`)
    }

    if (po.status !== 'Draft') {
      throw new Error(`Purchase order ${po.number} is not in Draft status`)
    }

    return await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: 'Approved' },
    })
  }

  async createGoodsReceipt(input: CreateGoodsReceiptInput) {
    // Generate receipt number
    const receiptNumber = `GRN-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`

    return await prisma.goodsReceipt.create({
      data: {
        number: receiptNumber,
        purchaseOrderId: input.purchaseOrderId,
        receivedAt: input.receivedAt || new Date(),
        notes: input.notes,
        status: 'Draft',
        lines: {
          create: input.lines.map((line) => ({
            poLineId: line.poLineId,
            itemId: line.itemId,
            qtyReceived: line.qtyReceived,
            locationId: line.locationId,
            lotId: line.lotId,
            serialId: line.serialId,
            unitCost: line.unitCost,
          })),
        },
      },
      include: {
        purchaseOrder: {
          include: {
            supplier: true,
          },
        },
        lines: {
          include: {
            item: {
              include: {
                uom: true,
              },
            },
            location: {
              include: {
                warehouse: true,
              },
            },
            // `lot` relation removed — Lot model dropped from schema.
            serial: true,
          },
        },
      },
    })
  }

  async getGoodsReceipts(filters?: {
    purchaseOrderId?: string
    status?: string
    page?: number
    limit?: number
  }) {
    const { purchaseOrderId, status, page = 1, limit = 50 } = filters || {}

    const where: any = {}
    if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId
    if (status) where.status = status

    const skip = (page - 1) * limit

    const [receipts, total] = await Promise.all([
      prisma.goodsReceipt.findMany({
        where,
        include: {
          purchaseOrder: {
            include: {
              supplier: true,
            },
          },
          lines: {
            include: {
              item: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.goodsReceipt.count({ where }),
    ])

    return {
      receipts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getGoodsReceipt(receiptId: string) {
    const receipt = await prisma.goodsReceipt.findUnique({
      where: { id: receiptId },
      include: {
        purchaseOrder: {
          include: {
            supplier: true,
            lines: true,
          },
        },
        lines: {
          include: {
            item: {
              include: {
                uom: true,
              },
            },
            location: {
              include: {
                warehouse: true,
              },
            },
            // `lot` relation removed — Lot model dropped from schema.
            serial: true,
            poLine: true,
          },
        },
      },
    })

    if (!receipt) {
      throw new Error(`Goods receipt ${receiptId} not found`)
    }

    return receipt
  }
}

export const purchaseService = new PurchaseService()
