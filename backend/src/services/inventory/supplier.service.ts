import { prisma } from '../../lib/prisma'


export interface CreateSupplierInput {
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

export class SupplierService {
  async createSupplier(input: CreateSupplierInput) {
    const existing = await prisma.supplier.findUnique({
      where: { code: input.code },
    })

    if (existing) {
      throw new Error(`Supplier with code ${input.code} already exists`)
    }

    return await prisma.supplier.create({
      data: input,
    })
  }

  async getSuppliers() {
    return await prisma.supplier.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    })
  }

  async getSupplier(supplierId: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        purchaseOrders: {
          take: 10,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })

    if (!supplier) {
      throw new Error(`Supplier ${supplierId} not found`)
    }

    return supplier
  }

  async updateSupplier(supplierId: string, input: Partial<CreateSupplierInput>) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    })

    if (!supplier) {
      throw new Error(`Supplier ${supplierId} not found`)
    }

    return await prisma.supplier.update({
      where: { id: supplierId },
      data: input,
    })
  }

  async deleteSupplier(supplierId: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        purchaseOrders: {
          where: {
            status: {
              not: 'Cancelled',
            },
          },
        },
      },
    })

    if (!supplier) {
      throw new Error(`Supplier ${supplierId} not found`)
    }

    if (supplier.purchaseOrders.length > 0) {
      throw new Error(
        `Cannot delete supplier ${supplier.name}: has ${supplier.purchaseOrders.length} active purchase orders`
      )
    }

    return await prisma.supplier.update({
      where: { id: supplierId },
      data: { isActive: false },
    })
  }
}

export const supplierService = new SupplierService()
