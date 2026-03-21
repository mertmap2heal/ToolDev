import { prisma } from '../../lib/prisma'
import { inventoryService } from './inventory.service'


export interface CreateCustomerInput {
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
}

export interface CreateSalesOrderInput {
  customerId: string
  orderedAt?: Date
  requiredAt?: Date
  notes?: string
  lines: Array<{
    itemId: string
    qtyOrdered: number
    unitPrice: number
    uomId: string
  }>
}

export interface CreateShipmentInput {
  salesOrderId: string
  shippedAt?: Date
  notes?: string
  lines: Array<{
    soLineId: string
    qtyShipped: number
    fromLocationId: string
    lotId?: string
    serialId?: string
  }>
}

export class SalesService {
  async createCustomer(input: CreateCustomerInput) {
    const existing = await prisma.customer.findUnique({
      where: { code: input.code },
    })

    if (existing) {
      throw new Error(`Customer with code ${input.code} already exists`)
    }

    return await prisma.customer.create({
      data: {
        code: input.code,
        name: input.name,
        contactName: input.contactName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        city: input.city,
        state: input.state,
        zipCode: input.zipCode,
        country: input.country,
      },
    })
  }

  async getCustomers() {
    return await prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })
  }

  async getCustomer(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        salesOrders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!customer) {
      throw new Error(`Customer ${customerId} not found`)
    }

    return customer
  }

  async updateCustomer(customerId: string, input: Partial<CreateCustomerInput>) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    })

    if (!customer) {
      throw new Error(`Customer ${customerId} not found`)
    }

    return await prisma.customer.update({
      where: { id: customerId },
      data: input,
    })
  }

  async deleteCustomer(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        salesOrders: {
          where: {
            status: {
              not: 'Cancelled',
            },
          },
        },
      },
    })

    if (!customer) {
      throw new Error(`Customer ${customerId} not found`)
    }

    if (customer.salesOrders.length > 0) {
      throw new Error(
        `Cannot delete customer ${customer.name}: has ${customer.salesOrders.length} active sales orders`
      )
    }

    return await prisma.customer.update({
      where: { id: customerId },
      data: { isActive: false },
    })
  }

  async createSalesOrder(input: CreateSalesOrderInput) {
    const soNumber = `SO-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`

    return await prisma.salesOrder.create({
      data: {
        number: soNumber,
        customerId: input.customerId,
        orderedAt: input.orderedAt || new Date(),
        requiredAt: input.requiredAt,
        notes: input.notes,
        status: 'Draft',
        lines: {
          create: input.lines.map((line) => ({
            itemId: line.itemId,
            qtyOrdered: line.qtyOrdered,
            qtyAllocated: 0,
            qtyShipped: 0,
            unitPrice: line.unitPrice,
            uomId: line.uomId,
          })),
        },
      },
      include: {
        customer: true,
        lines: {
          include: {
            item: {
              include: {
                uom: true,
              },
            },
          },
        },
      },
    })
  }

  async getSalesOrders(filters?: {
    customerId?: string
    status?: string
    page?: number
    limit?: number
  }) {
    const page = filters?.page || 1
    const limit = filters?.limit || 50
    const skip = (page - 1) * limit

    const where: any = {}
    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.status) where.status = filters.status

    const [orders, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          lines: {
            include: {
              item: {
                include: {
                  uom: true,
                },
              },
            },
          },
        },
      }),
      prisma.salesOrder.count({ where }),
    ])

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getSalesOrder(soId: string) {
    const so = await prisma.salesOrder.findUnique({
      where: { id: soId },
      include: {
        customer: true,
        lines: {
          include: {
            item: {
              include: {
                uom: true,
              },
            },
          },
        },
        shipments: {
          include: {
            lines: true,
          },
        },
      },
    })

    if (!so) {
      throw new Error(`Sales order ${soId} not found`)
    }

    return so
  }

  async approveSalesOrder(soId: string) {
    const so = await prisma.salesOrder.findUnique({
      where: { id: soId },
    })

    if (!so) {
      throw new Error(`Sales order ${soId} not found`)
    }

    if (so.status !== 'Draft') {
      throw new Error(`Sales order ${so.number} is not in Draft status`)
    }

    return await prisma.salesOrder.update({
      where: { id: soId },
      data: { status: 'Approved' },
    })
  }

  async allocateReservations(soId: string) {
    const so = await prisma.salesOrder.findUnique({
      where: { id: soId },
      include: {
        lines: {
          include: {
            item: true,
          },
        },
      },
    })

    if (!so) {
      throw new Error(`Sales order ${soId} not found`)
    }

    if (so.status !== 'Approved') {
      throw new Error(`Sales order ${so.number} must be Approved before allocating`)
    }

    // Use inventory service to allocate reservations
    await (inventoryService as any).allocateReservations(soId)

    return await prisma.salesOrder.update({
      where: { id: soId },
      data: { status: 'Allocated' },
      include: {
        customer: true,
        lines: {
          include: {
            item: true,
          },
        },
      },
    })
  }

  async createShipment(input: CreateShipmentInput) {
    const shipmentNumber = `SHIP-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`

    return await prisma.shipment.create({
      data: {
        number: shipmentNumber,
        salesOrderId: input.salesOrderId,
        shippedAt: input.shippedAt || new Date(),
        notes: input.notes,
        status: 'Draft',
        lines: {
          create: input.lines.map((line) => ({
            soLineId: line.soLineId,
            qtyShipped: line.qtyShipped,
            fromLocationId: line.fromLocationId,
            lotId: line.lotId,
            serialId: line.serialId,
          })) as any,
        },
      },
      include: {
        salesOrder: {
          include: {
            customer: true,
          },
        },
        lines: {
          include: {
            soLine: {
              include: {
                item: true,
              },
            },
            fromLocation: true,
          },
        },
      },
    })
  }

  async getShipments(filters?: {
    salesOrderId?: string
    status?: string
    page?: number
    limit?: number
  }) {
    const page = filters?.page || 1
    const limit = filters?.limit || 50
    const skip = (page - 1) * limit

    const where: any = {}
    if (filters?.salesOrderId) where.salesOrderId = filters.salesOrderId
    if (filters?.status) where.status = filters.status

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          salesOrder: {
            include: {
              customer: true,
            },
          },
          lines: {
            include: {
              soLine: {
                include: {
                  item: true,
                },
              },
            },
          },
        },
      }),
      prisma.shipment.count({ where }),
    ])

    return {
      shipments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getShipment(shipmentId: string) {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        salesOrder: {
          include: {
            customer: true,
            lines: true,
          },
        },
        lines: {
          include: {
            soLine: {
              include: {
                item: true,
              },
            },
            fromLocation: true,
            lot: true,
            serial: true,
          } as any,
        },
      },
    })

    if (!shipment) {
      throw new Error(`Shipment ${shipmentId} not found`)
    }

    return shipment
  }

  async postShipment(shipmentId: string, idempotencyKey: string) {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        lines: {
          include: {
            soLine: {
              include: {
                item: true,
              },
            },
          },
        },
      },
    })

    if (!shipment) {
      throw new Error(`Shipment ${shipmentId} not found`)
    }

    if (shipment.status !== 'Draft') {
      throw new Error(`Shipment ${shipment.number} is not in Draft status`)
    }

    // Use inventory service to post shipment
    await inventoryService.postShipment({ shipmentId, idempotencyKey })

    // Update shipment status
    const updatedShipment = await prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: 'Posted' },
      include: {
        salesOrder: {
          include: {
            customer: true,
          },
        },
        lines: {
          include: {
            soLine: {
              include: {
                item: true,
              },
            },
          },
        },
      },
    })

    // Update SO line shipped quantities and SO status
    for (const line of shipment.lines) {
      await prisma.salesOrderLine.update({
        where: { id: line.soLineId },
        data: {
          qtyShipped: {
            increment: line.qtyShipped,
          },
        },
      })
    }

    // Check if SO is fully shipped
    const so = await prisma.salesOrder.findUnique({
      where: { id: shipment.salesOrderId },
      include: {
        lines: true,
      },
    })

    if (so) {
      const allShipped = so.lines.every(
        (line) => Number(line.qtyShipped) >= Number(line.qtyOrdered)
      )
      const someShipped = so.lines.some((line) => Number(line.qtyShipped) > 0)

      let newStatus = so.status
      if (allShipped) {
        newStatus = 'Shipped'
      } else if (someShipped) {
        newStatus = 'PartiallyShipped'
      }

      if (newStatus !== so.status) {
        await prisma.salesOrder.update({
          where: { id: so.id },
          data: { status: newStatus },
        })
      }
    }

    return updatedShipment
  }
}

export const salesService = new SalesService()
