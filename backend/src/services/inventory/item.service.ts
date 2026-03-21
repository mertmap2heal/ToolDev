import { prisma } from '../../lib/prisma'


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

export interface ItemFilters {
  sku?: string
  name?: string
  categoryId?: string
  trackingPolicy?: 'NONE' | 'LOT' | 'SERIAL'
  projectId?: string
  isActive?: boolean
  page?: number
  limit?: number
}

export class ItemService {
  async createItem(input: CreateItemInput) {
    // Check if SKU already exists
    const existing = await prisma.item.findUnique({
      where: { sku: input.sku },
    })

    if (existing) {
      throw new Error(`Item with SKU ${input.sku} already exists`)
    }

    return await prisma.item.create({
      data: {
        sku: input.sku,
        name: input.name,
        description: input.description,
        trackingPolicy: input.trackingPolicy,
        uomId: input.uomId,
        categoryId: input.categoryId,
        projectId: input.projectId,
        isActive: input.isActive ?? true,
      },
      include: {
        uom: true,
        category: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
  }

  async getItem(itemId: string) {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        uom: true,
        category: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        barcodes: true,
      },
    })

    if (!item) {
      throw new Error(`Item ${itemId} not found`)
    }

    return item
  }

  async getItems(filters: ItemFilters = {}) {
    const {
      sku,
      name,
      categoryId,
      trackingPolicy,
      projectId,
      isActive,
      page = 1,
      limit = 50,
    } = filters

    const where: any = {}

    if (sku) {
      where.sku = {
        contains: sku,
        mode: 'insensitive',
      }
    }

    if (name) {
      where.name = {
        contains: name,
        mode: 'insensitive',
      }
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (trackingPolicy) {
      where.trackingPolicy = trackingPolicy
    }

    if (projectId !== undefined) {
      where.projectId = projectId
    }

    if (isActive !== undefined) {
      where.isActive = isActive
    }

    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where,
        include: {
          uom: true,
          category: true,
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.item.count({ where }),
    ])

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async updateItem(itemId: string, input: UpdateItemInput) {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    })

    if (!item) {
      throw new Error(`Item ${itemId} not found`)
    }

    return await prisma.item.update({
      where: { id: itemId },
      data: input,
      include: {
        uom: true,
        category: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
  }

  async deleteItem(itemId: string) {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        balances: {
          where: {
            qtyOnHand: {
              gt: 0,
            },
          },
        },
      },
    })

    if (!item) {
      throw new Error(`Item ${itemId} not found`)
    }

    if (item.balances.length > 0) {
      throw new Error(`Cannot delete item ${item.sku}: has on-hand inventory`)
    }

    return await prisma.item.delete({
      where: { id: itemId },
    })
  }

  async getItemStock(itemId: string) {
    const balances = await prisma.inventoryBalance.findMany({
      where: { itemId },
      include: {
        location: {
          include: {
            warehouse: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: {
        location: {
          code: 'asc',
        },
      },
    })

    return balances.map((balance) => ({
      locationId: balance.locationId,
      locationCode: balance.location.code,
      locationName: balance.location.name,
      warehouseId: balance.location.warehouse.id,
      warehouseName: balance.location.warehouse.name,
      warehouseCode: balance.location.warehouse.code,
      qtyOnHand: Number(balance.qtyOnHand),
      qtyReserved: Number(balance.qtyReserved),
      qtyAvailable: Number(balance.qtyAvailable),
    }))
  }

  async getItemLedger(itemId: string, filters?: { fromDate?: Date; toDate?: Date; limit?: number }) {
    const { fromDate, toDate, limit = 100 } = filters || {}

    const where: any = {
      itemId,
    }

    if (fromDate || toDate) {
      where.occurredAt = {}
      if (fromDate) {
        where.occurredAt.gte = fromDate
      }
      if (toDate) {
        where.occurredAt.lte = toDate
      }
    }

    return await prisma.inventoryLedger.findMany({
      where,
      include: {
        fromLocation: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        toLocation: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        lot: {
          select: {
            id: true,
            lotCode: true,
          },
        },
        serial: {
          select: {
            id: true,
            serialCode: true,
          },
        },
        uom: {
          select: {
            code: true,
            name: true,
          },
        },
      } as any,
      orderBy: {
        occurredAt: 'desc',
      },
      take: limit,
    })
  }
}

export const itemService = new ItemService()
